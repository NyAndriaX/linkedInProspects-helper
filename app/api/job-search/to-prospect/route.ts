import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

/**
 * POST /api/job-search/to-prospect
 *
 * Create a CRM prospect directly from a search result.
 * Unlike the alert-based flow, search results are ephemeral and not in DB,
 * so we accept the job data in the request body.
 *
 * Body:
 *   - externalId: string
 *   - source: string
 *   - title: string
 *   - company: string | null
 *   - url: string
 *   - contactEmail: string | null
 *   - location: string | null
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const body = await request.json();

    if (!body.title || !body.url) {
      return ApiResponse.badRequest("Title and URL are required");
    }

    // Create a prospect from the search result data
    const prospect = await prisma.prospect.create({
      data: {
        userId: session.user.id,
        name: body.company || body.title,
        email: body.contactEmail || null,
        company: body.company || null,
        status: "new",
        notes: [
          `Source: ${body.source || "search"}`,
          `Job: ${body.title}`,
          body.location ? `Location: ${body.location}` : null,
          `URL: ${body.url}`,
        ]
          .filter(Boolean)
          .join("\n"),
        website: body.url,
      },
    });

    return ApiResponse.created(prospect);
  } catch (error) {
    console.error("[JobSearch] Error creating prospect:", error);
    return ApiResponse.error("Failed to create prospect from search result");
  }
}
