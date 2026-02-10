import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { ALL_SOURCES } from "@/lib/job-sources";

// GET /api/job-alerts — List all job alerts for the authenticated user
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const alerts = await prisma.jobAlert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    return ApiResponse.success(alerts);
  } catch (error) {
    console.error("[JobAlerts] Error listing:", error);
    return ApiResponse.error("Failed to list job alerts");
  }
}

// POST /api/job-alerts — Create a new job alert
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const body = await request.json();

    if (!body.name?.trim()) {
      return ApiResponse.badRequest("Alert name is required");
    }

    if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
      return ApiResponse.badRequest("At least one keyword is required");
    }

    // Validate sources
    const sources = (body.sources || []).filter((s: string) =>
      ALL_SOURCES.includes(s)
    );

    const alert = await prisma.jobAlert.create({
      data: {
        userId: session.user.id,
        name: body.name.trim(),
        keywords: body.keywords.map((k: string) => k.trim().toLowerCase()).filter(Boolean),
        excludeKeywords: (body.excludeKeywords || []).map((k: string) => k.trim().toLowerCase()).filter(Boolean),
        sources: sources.length > 0 ? sources : ALL_SOURCES,
        maxPerDay: body.maxPerDay || 5,
        isActive: body.isActive !== false,
      },
    });

    return ApiResponse.created(alert);
  } catch (error) {
    console.error("[JobAlerts] Error creating:", error);
    return ApiResponse.error("Failed to create job alert");
  }
}
