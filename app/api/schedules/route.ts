import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { syncScheduleJobs } from "@/lib/agenda";

interface CreateScheduleRequest {
  name: string;
  dayOfWeek: number;
  times: string[];
  timezone: string;
  isRecurring?: boolean;
}

// GET /api/schedules - List all schedules for the current user
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return ApiResponse.unauthorized();
    }

    const schedules = await prisma.schedule.findMany({
      where: { userId: session.user.id },
      orderBy: [{ dayOfWeek: "asc" }, { createdAt: "asc" }],
    });

    return ApiResponse.success(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return ApiResponse.error("Failed to fetch schedules");
  }
}

// POST /api/schedules - Create a new schedule
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return ApiResponse.unauthorized();
    }

    const body: CreateScheduleRequest = await request.json();
    const { name, dayOfWeek, times, timezone, isRecurring = true } = body;

    // Validation
    if (!name?.trim()) {
      return ApiResponse.badRequest("Name is required");
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return ApiResponse.badRequest("Invalid day of week (0-6)");
    }

    if (!times?.length) {
      return ApiResponse.badRequest("At least one time is required");
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const time of times) {
      if (!timeRegex.test(time)) {
        return ApiResponse.badRequest(`Invalid time format: ${time}. Use HH:mm format.`);
      }
    }

    if (!timezone?.trim()) {
      return ApiResponse.badRequest("Timezone is required");
    }

    // Create the schedule
    const schedule = await prisma.schedule.create({
      data: {
        name: name.trim(),
        dayOfWeek,
        times,
        timezone,
        isRecurring,
        userId: session.user.id,
      },
    });

    // Sync agenda jobs
    try {
      await syncScheduleJobs(schedule.id);
    } catch (agendaError) {
      console.error("Error syncing agenda jobs:", agendaError);
      // Don't fail the request, just log the error
    }

    return ApiResponse.success(schedule, 201);
  } catch (error) {
    console.error("Error creating schedule:", error);
    return ApiResponse.error("Failed to create schedule");
  }
}
