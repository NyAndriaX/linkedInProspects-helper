import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

// GET /api/prospects — List all prospects for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build filter
    const where: Record<string, unknown> = { userId: session.user.id };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const prospects = await prisma.prospect.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    // Also return stats for the dashboard
    const allProspects = await prisma.prospect.findMany({
      where: { userId: session.user.id },
      select: { status: true, followUpDate: true },
    });

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: allProspects.length,
      new: allProspects.filter((p) => p.status === "new").length,
      contacted: allProspects.filter((p) => p.status === "contacted").length,
      replied: allProspects.filter((p) => p.status === "replied").length,
      interested: allProspects.filter((p) => p.status === "interested").length,
      converted: allProspects.filter((p) => p.status === "converted").length,
      lost: allProspects.filter((p) => p.status === "lost").length,
      followUpThisWeek: allProspects.filter(
        (p) => p.followUpDate && new Date(p.followUpDate) <= weekFromNow && new Date(p.followUpDate) >= now
      ).length,
      overdueFollowUps: allProspects.filter(
        (p) => p.followUpDate && new Date(p.followUpDate) < now
      ).length,
    };

    return ApiResponse.success({ prospects, stats });
  } catch (error) {
    console.error("[Prospects] Error listing:", error);
    return ApiResponse.error("Failed to list prospects");
  }
}

// POST /api/prospects — Create a new prospect
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const body = await request.json();

    if (!body.name?.trim()) {
      return ApiResponse.badRequest("Prospect name is required");
    }

    const prospect = await prisma.prospect.create({
      data: {
        userId: session.user.id,
        name: body.name.trim(),
        linkedinUrl: body.linkedinUrl?.trim() || null,
        email: body.email?.trim() || null,
        company: body.company?.trim() || null,
        status: body.status || "new",
        notes: body.notes?.trim() || null,
        lastContactDate: body.lastContactDate
          ? new Date(body.lastContactDate)
          : null,
        followUpDate: body.followUpDate
          ? new Date(body.followUpDate)
          : null,
      },
    });

    return ApiResponse.created(prospect);
  } catch (error) {
    console.error("[Prospects] Error creating:", error);
    return ApiResponse.error("Failed to create prospect");
  }
}
