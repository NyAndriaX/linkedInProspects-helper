import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/job-listings/[id]/to-prospect — Create a CRM prospect from a job listing
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await context.params;

    // Find the match and its job listing
    const match = await prisma.jobAlertMatch.findFirst({
      where: { id, userId: session.user.id },
      include: { jobListing: true },
    });

    if (!match) return ApiResponse.notFound("Job match not found");

    const listing = match.jobListing;

    // Create a prospect from the job listing data
    const prospect = await prisma.prospect.create({
      data: {
        userId: session.user.id,
        name: listing.company || listing.title,
        email: listing.contactEmail,
        company: listing.company,
        status: "new",
        notes: [
          `Source: ${listing.source}`,
          `Job: ${listing.title}`,
          listing.location ? `Location: ${listing.location}` : null,
          listing.salary ? `Salary: ${listing.salary}` : null,
          `URL: ${listing.url}`,
        ]
          .filter(Boolean)
          .join("\n"),
        website: listing.url,
      },
    });

    // Update match status
    await prisma.jobAlertMatch.update({
      where: { id },
      data: { status: "added_to_crm" },
    });

    return ApiResponse.created(prospect);
  } catch (error) {
    console.error("[JobListings] Error creating prospect:", error);
    return ApiResponse.error("Failed to create prospect from job listing");
  }
}
