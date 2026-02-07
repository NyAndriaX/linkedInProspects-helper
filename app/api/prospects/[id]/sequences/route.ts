import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/prospects/[id]/sequences — List all sequences for a prospect
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;

    // Verify ownership
    const prospect = await prisma.prospect.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!prospect) return ApiResponse.notFound("Prospect not found");

    const sequences = await prisma.sequence.findMany({
      where: { prospectId: id, userId: session.user.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ApiResponse.success({ sequences, prospect });
  } catch (error) {
    console.error("[Sequences] Error listing:", error);
    return ApiResponse.error("Failed to list sequences");
  }
}

// POST /api/prospects/[id]/sequences — Create a new sequence for a prospect
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;

    // Verify ownership
    const prospect = await prisma.prospect.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!prospect) return ApiResponse.notFound("Prospect not found");

    const body = await request.json();

    if (!body.name?.trim()) {
      return ApiResponse.badRequest("Sequence name is required");
    }

    if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return ApiResponse.badRequest("At least one step is required");
    }

    // Determine the base date for calculating due dates
    const baseDate = prospect.firstContactDate || prospect.lastContactDate || new Date();

    // If prospect doesn't have a firstContactDate, set it now
    if (!prospect.firstContactDate) {
      await prisma.prospect.update({
        where: { id },
        data: { firstContactDate: baseDate },
      });
    }

    // Create the sequence with its steps
    const sequence = await prisma.sequence.create({
      data: {
        prospectId: id,
        userId: session.user.id,
        name: body.name.trim(),
        steps: {
          create: body.steps.map(
            (
              step: {
                relativeDays: number;
                actionType: string;
                content?: string;
              },
              index: number
            ) => {
              const dueDate = new Date(baseDate);
              dueDate.setDate(dueDate.getDate() + (step.relativeDays || 0));

              return {
                order: index + 1,
                relativeDays: step.relativeDays || 0,
                actionType: step.actionType || "message",
                content: step.content?.trim() || null,
                status: "pending",
                dueDate,
              };
            }
          ),
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Also update the prospect's followUpDate to the first pending step's due date
    const firstStep = sequence.steps[0];
    if (firstStep?.dueDate) {
      await prisma.prospect.update({
        where: { id },
        data: { followUpDate: firstStep.dueDate },
      });
    }

    console.log(
      `[Sequences] Created "${sequence.name}" with ${sequence.steps.length} steps for prospect ${prospect.name}`
    );

    return ApiResponse.created(sequence);
  } catch (error) {
    console.error("[Sequences] Error creating:", error);
    return ApiResponse.error("Failed to create sequence");
  }
}

// DELETE /api/prospects/[id]/sequences — Delete a specific sequence (pass sequenceId in body)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const sequenceId = body.sequenceId;

    if (!sequenceId) {
      return ApiResponse.badRequest("Sequence ID is required");
    }

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, prospectId: id, userId: session.user.id },
    });

    if (!sequence) return ApiResponse.notFound("Sequence not found");

    await prisma.sequence.delete({ where: { id: sequenceId } });

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    console.error("[Sequences] Error deleting:", error);
    return ApiResponse.error("Failed to delete sequence");
  }
}
