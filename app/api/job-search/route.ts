import { NextRequest } from "next/server";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import {
  searchJobs,
  ALL_SOURCES,
  FRESHNESS_PRESETS,
  NormalizedJob,
} from "@/lib/job-sources";
import { matchJobs } from "@/lib/job-matcher";

/**
 * Simple in-memory cache to avoid hammering free APIs on repeated searches.
 * Key: serialized search params, Value: { results, timestamp }
 */
const searchCache = new Map<
  string,
  { results: NormalizedJob[]; timestamp: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(
  keywords: string[],
  sources: string[],
  freshness: string
): string {
  return JSON.stringify({
    k: [...keywords].sort(),
    s: [...sources].sort(),
    f: freshness,
  });
}

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of searchCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      searchCache.delete(key);
    }
  }
}

/**
 * POST /api/job-search
 *
 * On-demand job search across free sources.
 * Returns ranked results based on keyword matching.
 * Results are ephemeral (not saved to DB).
 *
 * Body:
 *   - keywords: string[] (required, at least 1)
 *   - sources?: string[] (defaults to all)
 *   - freshness?: "24h" | "3d" | "7d" | "30d" | "all" (defaults to "7d")
 *   - excludeKeywords?: string[]
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const body = await request.json();

    // Validate keywords
    const keywords: string[] = (body.keywords || [])
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean);

    if (keywords.length === 0) {
      return ApiResponse.badRequest("At least one keyword is required");
    }

    // Validate sources
    const sources: string[] = (body.sources || []).filter((s: string) =>
      ALL_SOURCES.includes(s)
    );
    const activeSources = sources.length > 0 ? sources : ALL_SOURCES;

    // Validate freshness
    const freshness: string = body.freshness || "7d";
    if (!FRESHNESS_PRESETS.hasOwnProperty(freshness)) {
      return ApiResponse.badRequest(
        `Invalid freshness. Valid values: ${Object.keys(FRESHNESS_PRESETS).join(", ")}`
      );
    }
    const freshnessHours = FRESHNESS_PRESETS[freshness];

    const excludeKeywords: string[] = (body.excludeKeywords || [])
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean);

    // Check cache
    cleanExpiredCache();
    const cacheKey = getCacheKey(keywords, activeSources, freshness);
    const cached = searchCache.get(cacheKey);

    let allJobs: NormalizedJob[];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log("[JobSearch] Cache hit");
      allJobs = cached.results;
    } else {
      // Fetch from sources
      allJobs = await searchJobs(activeSources, freshnessHours);
      // Cache the raw results (before keyword matching)
      searchCache.set(cacheKey, { results: allJobs, timestamp: Date.now() });
    }

    // Run keyword matcher (no per-source cap, generous limit)
    const matched = matchJobs(allJobs, keywords, excludeKeywords, 50);

    return ApiResponse.success({
      results: matched.map((job) => ({
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
      })),
      total: matched.length,
      totalFetched: allJobs.length,
      freshness,
      sources: activeSources,
      keywords,
    });
  } catch (error) {
    console.error("[JobSearch] Error:", error);
    return ApiResponse.error("Failed to search jobs");
  }
}
