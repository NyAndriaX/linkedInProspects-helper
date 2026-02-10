import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { fetchAllJobs, ALL_SOURCES } from "@/lib/job-sources";
import { matchJobs } from "@/lib/job-matcher";

/**
 * POST /api/job-alerts/trigger
 *
 * Manually trigger the job alerts fetch & match process for the current user.
 * This is the same logic as the daily cron, but scoped to the authenticated user
 * and triggered on demand (useful for testing).
 */
export async function POST() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const userId = session.user.id;

    // 1. Get active alerts for this user
    const activeAlerts = await prisma.jobAlert.findMany({
      where: { userId, isActive: true },
    });

    if (activeAlerts.length === 0) {
      return ApiResponse.badRequest(
        "No active job alerts found. Create and activate at least one alert first."
      );
    }

    // 2. Determine needed sources across all alerts
    const neededSources = new Set<string>();
    for (const alert of activeAlerts) {
      const sources = alert.sources.length > 0 ? alert.sources : ALL_SOURCES;
      sources.forEach((s) => neededSources.add(s));
    }

    // 3. Fetch jobs from needed sources (with 24h freshness filter + 2/source cap)
    const allJobs = await fetchAllJobs(Array.from(neededSources));

    // 4. Upsert job listings to DB
    let newListingsCount = 0;
    for (const job of allJobs) {
      try {
        await prisma.jobListing.upsert({
          where: { externalId: job.externalId },
          update: {}, // Already exists, don't overwrite
          create: {
            externalId: job.externalId,
            source: job.source,
            title: job.title,
            company: job.company,
            description: job.description,
            url: job.url,
            contactEmail: job.contactEmail,
            location: job.location,
            salary: job.salary,
            tags: job.tags,
            publishedAt: job.publishedAt,
          },
        });
        newListingsCount++;
      } catch {
        // Duplicate or DB error, skip
      }
    }

    // 5. For each alert, run matcher and create matches
    const alertResults = [];

    for (const alert of activeAlerts) {
      const sourcesForAlert =
        alert.sources.length > 0 ? alert.sources : ALL_SOURCES;
      const jobsForAlert = allJobs.filter((j) =>
        sourcesForAlert.includes(j.source)
      );

      const matched = matchJobs(
        jobsForAlert,
        alert.keywords,
        alert.excludeKeywords,
        alert.maxPerDay
      );

      let matchCount = 0;
      for (const mJob of matched) {
        try {
          const dbListing = await prisma.jobListing.findUnique({
            where: { externalId: mJob.externalId },
          });
          if (!dbListing) continue;

          await prisma.jobAlertMatch.upsert({
            where: {
              userId_jobListingId: {
                userId,
                jobListingId: dbListing.id,
              },
            },
            update: {},
            create: {
              userId,
              alertId: alert.id,
              jobListingId: dbListing.id,
              status: "new",
            },
          });
          matchCount++;
        } catch {
          // Skip duplicates
        }
      }

      await prisma.jobAlert.update({
        where: { id: alert.id },
        data: { lastFetchAt: new Date() },
      });

      alertResults.push({
        alertName: alert.name,
        keywords: alert.keywords,
        sources: sourcesForAlert,
        jobsFetched: jobsForAlert.length,
        jobsMatched: matched.length,
        matchesSaved: matchCount,
        matchedJobs: matched.map((j) => ({
          title: j.title,
          company: j.company,
          source: j.source,
          url: j.url,
          publishedAt: j.publishedAt,
        })),
      });
    }

    return ApiResponse.success({
      message: "Job alerts fetch triggered successfully",
      summary: {
        totalSourcesFetched: Array.from(neededSources),
        totalJobsFetched: allJobs.length,
        totalListingsSaved: newListingsCount,
        alertsProcessed: activeAlerts.length,
      },
      alerts: alertResults,
    });
  } catch (error) {
    console.error("[JobAlerts Trigger] Error:", error);
    return ApiResponse.error("Failed to trigger job alerts fetch");
  }
}
