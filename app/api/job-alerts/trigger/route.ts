import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { runFetchForAlerts } from "@/lib/job-fetch-runner";

/**
 * POST /api/job-alerts/trigger
 *
 * Manually trigger the job alerts fetch & match process for the current user.
 * Uses the shared fetch runner (same logic as the daily cron).
 */
export async function POST() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const userId = session.user.id;

    // Get active alerts for this user
    const activeAlerts = await prisma.jobAlert.findMany({
      where: { userId, isActive: true },
    });

    if (activeAlerts.length === 0) {
      return ApiResponse.badRequest(
        "No active job alerts found. Create and activate at least one alert first."
      );
    }

    const result = await runFetchForAlerts(activeAlerts, userId);

    return ApiResponse.success({
      message: "Job alerts fetch triggered successfully",
      summary: {
        totalSourcesFetched: result.totalSourcesFetched,
        totalJobsFetched: result.totalJobsFetched,
        totalListingsSaved: result.totalListingsSaved,
        alertsProcessed: result.alertsProcessed,
      },
      alerts: result.alerts,
    });
  } catch (error) {
    console.error("[JobAlerts Trigger] Error:", error);
    return ApiResponse.error("Failed to trigger job alerts fetch");
  }
}
