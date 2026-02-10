import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/job-listings/[id] — Update a job match status (save, dismiss, etc.)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await context.params;
    const body = await request.json();

    const validStatuses = ["new", "saved", "dismissed", "added_to_crm"];
    if (!body.status || !validStatuses.includes(body.status)) {
      return ApiResponse.badRequest(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    // Verify ownership
    const existing = await prisma.jobAlertMatch.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return ApiResponse.notFound("Job match not found");

    const updated = await prisma.jobAlertMatch.update({
      where: { id },
      data: { status: body.status },
    });

    return ApiResponse.success(updated);
  } catch (error) {
    console.error("[JobListings] Error updating match:", error);
    return ApiResponse.error("Failed to update job match");
  }
}
