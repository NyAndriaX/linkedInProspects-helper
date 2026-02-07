import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface FindEmailRequest {
  name: string;
  company: string;
  domain?: string;
  linkedinUrl?: string;
}

const HUNTER_API_BASE = "https://api.hunter.io/v2";
const OWNER_LIMIT = 100;
const FREE_LIMIT = 10;

/**
 * Parse a full name into first and last name
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Derive a probable domain from a company name
 */
function deriveDomain(company: string): string {
  return (
    company
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "") + ".com"
  );
}

// POST /api/find-email
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const userId = session.user.id;
    const userEmail = session.user.email;
    const body: FindEmailRequest = await request.json();

    if (!body.name?.trim() || !body.company?.trim()) {
      return ApiResponse.badRequest("Name and company are required");
    }

    const hunterKey = process.env.HUNTER_API_KEY;
    if (!hunterKey) {
      return ApiResponse.error("Hunter.io API key not configured", 503);
    }

    // ── Usage limit check ──
    const month = new Date().toISOString().slice(0, 7);

    const usage = await prisma.usage.upsert({
      where: {
        userId_month_type: { userId, month, type: "email_search" },
      },
      update: {},
      create: { userId, month, type: "email_search", count: 0 },
    });

    const isOwner =
      userEmail === process.env.OWNER_EMAIL ||
      userId === process.env.OWNER_USER_ID;
    const limit = isOwner ? OWNER_LIMIT : FREE_LIMIT;

    if (usage.count >= limit) {
      return ApiResponse.success({
        success: false,
        limitReached: true,
        remaining: 0,
        limit,
      });
    }

    // ── Prepare Hunter.io request ──
    const { firstName, lastName } = parseName(body.name);
    const domain = body.domain?.trim() || deriveDomain(body.company);

    console.log(
      `[EmailFinder] Searching for ${firstName} ${lastName} @ ${domain}`
    );

    // ── Call Hunter.io Email Finder ──
    const finderUrl = new URL(`${HUNTER_API_BASE}/email-finder`);
    finderUrl.searchParams.set("domain", domain);
    finderUrl.searchParams.set("first_name", firstName);
    if (lastName) finderUrl.searchParams.set("last_name", lastName);
    finderUrl.searchParams.set("api_key", hunterKey);

    const finderResponse = await fetch(finderUrl.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    // Handle Hunter errors
    if (!finderResponse.ok) {
      const status = finderResponse.status;

      // Increment count even on not-found
      await prisma.usage.update({
        where: { id: usage.id },
        data: { count: { increment: 1 } },
      });

      if (status === 402) {
        return ApiResponse.error(
          "Hunter.io credits exceeded globally. Contact admin.",
          402
        );
      }

      // 404 or similar → no email found
      console.warn(`[EmailFinder] Hunter returned ${status}`);
      return ApiResponse.success({
        success: false,
        notFound: true,
        remaining: limit - (usage.count + 1),
        limit,
      });
    }

    const finderData = await finderResponse.json();
    const email: string | null = finderData?.data?.email || null;
    const confidence: number = finderData?.data?.score || 0;
    const position: string | null = finderData?.data?.position || null;

    if (!email) {
      await prisma.usage.update({
        where: { id: usage.id },
        data: { count: { increment: 1 } },
      });
      return ApiResponse.success({
        success: false,
        notFound: true,
        remaining: limit - (usage.count + 1),
        limit,
      });
    }

    // ── Verify email with Hunter.io ──
    let verification: {
      result: string;
      score: number;
      mxRecords: boolean;
      smtpCheck: boolean;
      disposable: boolean;
      webmail: boolean;
    } | null = null;

    try {
      const verifierUrl = new URL(`${HUNTER_API_BASE}/email-verifier`);
      verifierUrl.searchParams.set("email", email);
      verifierUrl.searchParams.set("api_key", hunterKey);

      const verifierResponse = await fetch(verifierUrl.toString(), {
        signal: AbortSignal.timeout(15000),
      });

      if (verifierResponse.ok) {
        const verifierData = await verifierResponse.json();
        verification = {
          result: verifierData?.data?.result || "unknown",
          score: verifierData?.data?.score || 0,
          mxRecords: verifierData?.data?.mx_records || false,
          smtpCheck: verifierData?.data?.smtp_check || false,
          disposable: verifierData?.data?.disposable || false,
          webmail: verifierData?.data?.webmail || false,
        };
      }
    } catch (verifyError) {
      console.error("[EmailFinder] Verification failed:", verifyError);
    }

    // ── Update usage count ──
    await prisma.usage.update({
      where: { id: usage.id },
      data: { count: { increment: 1 } },
    });

    console.log(
      `[EmailFinder] Found: ${email} (confidence: ${confidence}%, verified: ${verification?.result || "n/a"})`
    );

    return ApiResponse.success({
      success: true,
      email,
      confidence,
      position,
      domain,
      company: body.company,
      name: body.name,
      verification,
      remaining: limit - (usage.count + 1),
      limit,
    });
  } catch (error) {
    console.error("[EmailFinder] Error:", error);
    if (error instanceof Error && error.message.includes("timeout")) {
      return ApiResponse.error("Request timed out. Please try again.", 504);
    }
    return ApiResponse.error("Failed to find email");
  }
}
