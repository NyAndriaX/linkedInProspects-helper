import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ stepId: string }>;
}

// PUT /api/sequence-steps/[stepId] — Update a sequence step (status, notes, sentAt)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { stepId } = await params;
    const body = await request.json();

    // Find the step and verify ownership through sequence -> prospect
    const step = await prisma.sequenceStep.findFirst({
      where: { id: stepId },
      include: {
        sequence: {
          select: { userId: true, prospectId: true },
        },
      },
    });

    if (!step) return ApiResponse.notFound("Step not found");
    if (step.sequence.userId !== session.user.id) {
      return ApiResponse.forbidden("Not authorized");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const validStatuses = ["pending", "sent", "responded", "skipped"];
      if (!validStatuses.includes(body.status)) {
        return ApiResponse.badRequest(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        );
      }
      updateData.status = body.status;

      // Auto-set sentAt when marking as sent
      if (body.status === "sent" && !step.sentAt) {
        updateData.sentAt = new Date();
      }
      if (body.status === "responded" && !step.sentAt) {
        updateData.sentAt = new Date();
      }
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes?.trim() || null;
    }

    if (body.content !== undefined) {
      updateData.content = body.content?.trim() || null;
    }

    if (body.sentAt !== undefined) {
      updateData.sentAt = body.sentAt ? new Date(body.sentAt) : null;
    }

    const updatedStep = await prisma.sequenceStep.update({
      where: { id: stepId },
      data: updateData,
    });

    // Update the prospect's followUpDate to the next pending step's due date
    const nextPendingStep = await prisma.sequenceStep.findFirst({
      where: {
        sequence: { prospectId: step.sequence.prospectId },
        status: "pending",
        dueDate: { not: null },
      },
      orderBy: { dueDate: "asc" },
    });

    if (nextPendingStep?.dueDate) {
      await prisma.prospect.update({
        where: { id: step.sequence.prospectId },
        data: { followUpDate: nextPendingStep.dueDate },
      });
    }

    // If marking as responded, optionally update prospect status
    if (body.status === "responded") {
      await prisma.prospect.update({
        where: { id: step.sequence.prospectId },
        data: {
          status: "replied",
          lastContactDate: new Date(),
        },
      });
    }

    return ApiResponse.success(updatedStep);
  } catch (error) {
    console.error("[SequenceSteps] Error updating:", error);
    return ApiResponse.error("Failed to update step");
  }
}
