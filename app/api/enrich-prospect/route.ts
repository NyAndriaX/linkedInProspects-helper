import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

const HUNTER_API_BASE = "https://api.hunter.io/v2";
const OWNER_LIMIT = 100;
const FREE_LIMIT = 10;

/**
 * Extract domain from an email address
 */
function extractDomain(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
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

// POST /api/enrich-prospect
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const userId = session.user.id;
    const userEmail = session.user.email;
    const { prospectId, domain: overrideDomain } = await request.json();

    if (!prospectId) {
      return ApiResponse.badRequest("Prospect ID is required");
    }

    const hunterKey = process.env.HUNTER_API_KEY;
    if (!hunterKey) {
      return ApiResponse.error("Hunter.io API key not configured", 503);
    }

    // Verify prospect ownership
    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, userId },
    });

    if (!prospect) return ApiResponse.notFound("Prospect not found");

    // Determine domain to search
    let domain: string | null = overrideDomain?.trim() || null;

    if (!domain && prospect.email) {
      domain = extractDomain(prospect.email);
    }

    if (!domain && prospect.company) {
      domain = deriveDomain(prospect.company);
    }

    if (!domain) {
      return ApiResponse.badRequest(
        "Cannot enrich: no email, company, or domain available"
      );
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

    // ── Call Hunter Domain Search ──
    console.log(`[Enrich] Searching domain: ${domain} for prospect: ${prospect.name}`);

    const searchUrl = new URL(`${HUNTER_API_BASE}/domain-search`);
    searchUrl.searchParams.set("domain", domain);
    searchUrl.searchParams.set("api_key", hunterKey);

    const response = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const status = response.status;
      await prisma.usage.update({
        where: { id: usage.id },
        data: { count: { increment: 1 } },
      });

      if (status === 402) {
        return ApiResponse.error("Hunter.io credits exceeded", 402);
      }

      console.warn(`[Enrich] Hunter returned status ${status}`);
      return ApiResponse.success({
        success: false,
        notFound: true,
        remaining: limit - (usage.count + 1),
        limit,
      });
    }

    const hunterData = await response.json();
    const companyData = hunterData?.data;

    // Extract enrichment fields
    const enrichment = {
      companySize: companyData?.organization?.company_size || null,
      companyIndustry: companyData?.organization?.industry || null,
      companyDescription: companyData?.organization?.description || null,
      website: companyData?.organization?.website || companyData?.webmail ? null : `https://${domain}`,
      enrichedAt: new Date(),
    };

    // Also update company name if we got a better one
    const companyName = companyData?.organization?.company_name || null;

    // Update prospect
    const updatedProspect = await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        ...enrichment,
        ...(companyName && !prospect.company && { company: companyName }),
      },
    });

    // Increment usage
    await prisma.usage.update({
      where: { id: usage.id },
      data: { count: { increment: 1 } },
    });

    console.log(
      `[Enrich] Success for ${prospect.name}: industry=${enrichment.companyIndustry}, size=${enrichment.companySize}`
    );

    return ApiResponse.success({
      success: true,
      prospect: updatedProspect,
      enrichment,
      remaining: limit - (usage.count + 1),
      limit,
    });
  } catch (error) {
    console.error("[Enrich] Error:", error);
    if (error instanceof Error && error.message.includes("timeout")) {
      return ApiResponse.error("Request timed out", 504);
    }
    return ApiResponse.error("Failed to enrich prospect");
  }
}
