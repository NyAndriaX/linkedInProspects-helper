import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { syncScheduleJobs, deleteScheduleJobs } from "@/lib/agenda";

interface UpdateScheduleRequest {
  name?: string;
  dayOfWeek?: number;
  times?: string[];
  timezone?: string;
  isRecurring?: boolean;
  isActive?: boolean;
}

// GET /api/schedules/[id] - Get a specific schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return ApiResponse.unauthorized();
    }

    const { id } = await params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      return ApiResponse.notFound("Schedule not found");
    }

    if (schedule.userId !== session.user.id) {
      return ApiResponse.forbidden("Access denied");
    }

    return ApiResponse.success(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return ApiResponse.error("Failed to fetch schedule");
  }
}

// PUT /api/schedules/[id] - Update a schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return ApiResponse.unauthorized();
    }

    const { id } = await params;

    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return ApiResponse.notFound("Schedule not found");
    }

    if (existingSchedule.userId !== session.user.id) {
      return ApiResponse.forbidden("Access denied");
    }

    const body: UpdateScheduleRequest = await request.json();
    const { name, dayOfWeek, times, timezone, isRecurring, isActive } = body;

    // Validation
    if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
      return ApiResponse.badRequest("Invalid day of week (0-6)");
    }

    if (times !== undefined) {
      if (!times.length) {
        return ApiResponse.badRequest("At least one time is required");
      }

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      for (const time of times) {
        if (!timeRegex.test(time)) {
          return ApiResponse.badRequest(`Invalid time format: ${time}. Use HH:mm format.`);
        }
      }
    }

    // Update the schedule
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(times !== undefined && { times }),
        ...(timezone !== undefined && { timezone }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Sync agenda jobs
    try {
      await syncScheduleJobs(schedule.id);
    } catch (agendaError) {
      console.error("Error syncing agenda jobs:", agendaError);
    }

    return ApiResponse.success(schedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return ApiResponse.error("Failed to update schedule");
  }
}

// DELETE /api/schedules/[id] - Delete a schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return ApiResponse.unauthorized();
    }

    const { id } = await params;

    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return ApiResponse.notFound("Schedule not found");
    }

    if (existingSchedule.userId !== session.user.id) {
      return ApiResponse.forbidden("Access denied");
    }

    // Delete agenda jobs first
    try {
      await deleteScheduleJobs(id);
    } catch (agendaError) {
      console.error("Error deleting agenda jobs:", agendaError);
    }

    // Delete the schedule
    await prisma.schedule.delete({
      where: { id },
    });

    return ApiResponse.success({ message: "Schedule deleted" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return ApiResponse.error("Failed to delete schedule");
  }
}
