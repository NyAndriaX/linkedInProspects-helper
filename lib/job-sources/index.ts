import { NormalizedJob } from "./types";
import { fetchRemotiveJobs } from "./remotive";
import { fetchJobicyJobs } from "./jobicy";
import { fetchArbeitnowJobs } from "./arbeitnow";
import { fetchRedditJobs } from "./reddit";
import { fetchHackerNewsJobs } from "./hackernews";

export type { NormalizedJob } from "./types";

/** Maximum number of jobs to keep per source (ensures diversity) */
export const MAX_PER_SOURCE = 2;

/** Only keep jobs published within the last 24 hours */
const FRESHNESS_HOURS = 24;

/**
 * Map of source name -> fetcher function.
 * Used by the cron job to selectively fetch from sources
 * based on each user's JobAlert configuration.
 */
export const SOURCE_FETCHERS: Record<string, () => Promise<NormalizedJob[]>> = {
  remotive: fetchRemotiveJobs,
  jobicy: fetchJobicyJobs,
  arbeitnow: fetchArbeitnowJobs,
  reddit: fetchRedditJobs,
  hackernews: fetchHackerNewsJobs,
};

/** All available source keys */
export const ALL_SOURCES = Object.keys(SOURCE_FETCHERS);

/**
 * Check if a job was published within the last N hours.
 */
function isFresh(job: NormalizedJob, maxHours: number): boolean {
  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
  return job.publishedAt >= cutoff;
}

/**
 * Fetch jobs from all sources (or a subset).
 *
 * Applies two critical filters:
 *  1. Freshness: only jobs published within the last 24 hours
 *  2. Per-source cap: max 2 jobs per source (sorted by newest first)
 *
 * This guarantees diversity across sources and only fresh content.
 * With 5 sources * 2 max each = 10 jobs max per fetch cycle.
 */
export async function fetchAllJobs(
  sources?: string[]
): Promise<NormalizedJob[]> {
  const activeSources = sources || ALL_SOURCES;
  const fetchers = activeSources
    .filter((s) => SOURCE_FETCHERS[s])
    .map((s) => ({ source: s, fn: SOURCE_FETCHERS[s] }));

  console.log(
    `[JobFetcher] Fetching from ${activeSources.length} sources: ${activeSources.join(", ")}`
  );

  // Fetch all sources in parallel
  const results = await Promise.allSettled(
    fetchers.map(async ({ source, fn }) => {
      const jobs = await fn();
      return { source, jobs };
    })
  );

  const allJobs: NormalizedJob[] = [];
  const seenIds = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("[JobFetcher] Source failed:", result.reason);
      continue;
    }

    const { source, jobs } = result.value;

    // 1. Filter: only jobs from the last 24 hours
    const freshJobs = jobs.filter((j) => isFresh(j, FRESHNESS_HOURS));

    // 2. Sort by newest first
    freshJobs.sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );

    // 3. Cap: keep only MAX_PER_SOURCE per source
    const capped = freshJobs.slice(0, MAX_PER_SOURCE);

    console.log(
      `[JobFetcher] ${source}: ${jobs.length} fetched -> ${freshJobs.length} fresh (<24h) -> ${capped.length} kept (max ${MAX_PER_SOURCE})`
    );

    for (const job of capped) {
      if (!seenIds.has(job.externalId)) {
        seenIds.add(job.externalId);
        allJobs.push(job);
      }
    }
  }

  console.log(
    `[JobFetcher] Total: ${allJobs.length} fresh unique jobs (max possible: ${activeSources.length * MAX_PER_SOURCE})`
  );
  return allJobs;
}
