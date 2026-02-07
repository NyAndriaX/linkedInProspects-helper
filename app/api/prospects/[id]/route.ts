import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/prospects/[id] — Get a single prospect
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;

    const prospect = await prisma.prospect.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!prospect) return ApiResponse.notFound("Prospect not found");

    return ApiResponse.success(prospect);
  } catch (error) {
    console.error("[Prospects] Error fetching:", error);
    return ApiResponse.error("Failed to fetch prospect");
  }
}

// PUT /api/prospects/[id] — Update a prospect
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.prospect.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return ApiResponse.notFound("Prospect not found");

    const body = await request.json();

    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.linkedinUrl !== undefined && {
          linkedinUrl: body.linkedinUrl?.trim() || null,
        }),
        ...(body.email !== undefined && {
          email: body.email?.trim() || null,
        }),
        ...(body.company !== undefined && {
          company: body.company?.trim() || null,
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && {
          notes: body.notes?.trim() || null,
        }),
        ...(body.lastContactDate !== undefined && {
          lastContactDate: body.lastContactDate
            ? new Date(body.lastContactDate)
            : null,
        }),
        ...(body.followUpDate !== undefined && {
          followUpDate: body.followUpDate
            ? new Date(body.followUpDate)
            : null,
        }),
      },
    });

    return ApiResponse.success(prospect);
  } catch (error) {
    console.error("[Prospects] Error updating:", error);
    return ApiResponse.error("Failed to update prospect");
  }
}

// DELETE /api/prospects/[id] — Delete a prospect
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;

    const existing = await prisma.prospect.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return ApiResponse.notFound("Prospect not found");

    await prisma.prospect.delete({ where: { id } });

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    console.error("[Prospects] Error deleting:", error);
    return ApiResponse.error("Failed to delete prospect");
  }
}
