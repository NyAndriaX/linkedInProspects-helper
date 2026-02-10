import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { ALL_SOURCES } from "@/lib/job-sources";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/job-alerts/[id] — Update a job alert
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await context.params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.jobAlert.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return ApiResponse.notFound("Job alert not found");

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.keywords !== undefined) {
      updateData.keywords = body.keywords.map((k: string) => k.trim().toLowerCase()).filter(Boolean);
    }
    if (body.excludeKeywords !== undefined) {
      updateData.excludeKeywords = body.excludeKeywords.map((k: string) => k.trim().toLowerCase()).filter(Boolean);
    }
    if (body.sources !== undefined) {
      const sources = body.sources.filter((s: string) => ALL_SOURCES.includes(s));
      updateData.sources = sources.length > 0 ? sources : ALL_SOURCES;
    }
    if (body.maxPerDay !== undefined) updateData.maxPerDay = body.maxPerDay;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const alert = await prisma.jobAlert.update({
      where: { id },
      data: updateData,
    });

    return ApiResponse.success(alert);
  } catch (error) {
    console.error("[JobAlerts] Error updating:", error);
    return ApiResponse.error("Failed to update job alert");
  }
}

// DELETE /api/job-alerts/[id] — Delete a job alert and its matches
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await context.params;

    // Verify ownership
    const existing = await prisma.jobAlert.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return ApiResponse.notFound("Job alert not found");

    // Delete alert (cascades to matches)
    await prisma.jobAlert.delete({ where: { id } });

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    console.error("[JobAlerts] Error deleting:", error);
    return ApiResponse.error("Failed to delete job alert");
  }
}
