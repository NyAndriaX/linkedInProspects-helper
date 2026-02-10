import { prisma } from "@/lib/prisma";
import { fetchAllJobs, ALL_SOURCES, NormalizedJob } from "@/lib/job-sources";
import { matchJobs } from "@/lib/job-matcher";
import { JobAlert } from "@prisma/client";

export interface AlertFetchResult {
  alertName: string;
  keywords: string[];
  sources: string[];
  jobsFetched: number;
  jobsMatched: number;
  matchesSaved: number;
  matchedJobs: {
    title: string;
    company: string | null;
    source: string;
    url: string;
    publishedAt: Date;
  }[];
}

export interface FetchRunResult {
  totalSourcesFetched: string[];
  totalJobsFetched: number;
  totalListingsSaved: number;
  alertsProcessed: number;
  alerts: AlertFetchResult[];
}

/**
 * Run the full fetch + match pipeline for a set of alerts.
 *
 * This is the core logic used by:
 * - The daily cron job (all active alerts)
 * - The manual trigger endpoint (user's alerts)
 * - The initial fetch after creating a new alert
 *
 * @param alerts - The alerts to process
 * @param userId - The user ID that owns these alerts
 */
export async function runFetchForAlerts(
  alerts: JobAlert[],
  userId: string
): Promise<FetchRunResult> {
  // 1. Determine needed sources across all alerts
  const neededSources = new Set<string>();
  for (const alert of alerts) {
    const sources = alert.sources.length > 0 ? alert.sources : ALL_SOURCES;
    sources.forEach((s) => neededSources.add(s));
  }

  // 2. Fetch jobs from needed sources (24h freshness + 2/source cap)
  const allJobs = await fetchAllJobs(Array.from(neededSources));

  // 3. Upsert job listings to DB
  const totalListingsSaved = await upsertListings(allJobs);

  // 4. For each alert, run matcher and create matches
  const alertResults: AlertFetchResult[] = [];

  for (const alert of alerts) {
    const result = await matchAndSaveForAlert(alert, allJobs, userId);
    alertResults.push(result);
  }

  return {
    totalSourcesFetched: Array.from(neededSources),
    totalJobsFetched: allJobs.length,
    totalListingsSaved,
    alertsProcessed: alerts.length,
    alerts: alertResults,
  };
}

/**
 * Upsert normalized jobs into the JobListing collection.
 * Returns the number of successfully upserted records.
 */
async function upsertListings(jobs: NormalizedJob[]): Promise<number> {
  let count = 0;
  for (const job of jobs) {
    try {
      await prisma.jobListing.upsert({
        where: { externalId: job.externalId },
        update: {},
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
      count++;
    } catch {
      // Duplicate or DB error, skip
    }
  }
  return count;
}

/**
 * Match jobs against a single alert's criteria and save matches to DB.
 */
async function matchAndSaveForAlert(
  alert: JobAlert,
  allJobs: NormalizedJob[],
  userId: string
): Promise<AlertFetchResult> {
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

  // Update alert lastFetchAt
  await prisma.jobAlert.update({
    where: { id: alert.id },
    data: { lastFetchAt: new Date() },
  });

  return {
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
  };
}
