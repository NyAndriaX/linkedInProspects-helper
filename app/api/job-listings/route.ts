import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

// GET /api/job-listings — Get matched job listings for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "new";
    const alertId = searchParams.get("alertId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Build filter for matches
    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (status !== "all") {
      where.status = status;
    }

    if (alertId) {
      where.alertId = alertId;
    }

    // Fetch matches with associated job listing data
    const [matches, total] = await Promise.all([
      prisma.jobAlertMatch.findMany({
        where,
        include: {
          jobListing: true,
          alert: {
            select: { name: true, id: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.jobAlertMatch.count({ where }),
    ]);

    // Also get counts by status for the UI tabs
    const statusCounts = await prisma.jobAlertMatch.groupBy({
      by: ["status"],
      where: { userId: session.user.id },
      _count: true,
    });

    const counts: Record<string, number> = {};
    for (const group of statusCounts) {
      counts[group.status] = group._count;
    }

    return ApiResponse.success({
      matches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts,
    });
  } catch (error) {
    console.error("[JobListings] Error listing:", error);
    return ApiResponse.error("Failed to list job listings");
  }
}
