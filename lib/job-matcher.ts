import { NormalizedJob } from "./job-sources/types";

interface MatchResult {
  job: NormalizedJob;
  score: number;
}

/** Maximum number of matched jobs per source to ensure diversity */
const MAX_PER_SOURCE_IN_MATCH = 2;

/**
 * Score and rank jobs against a user's keyword preferences.
 *
 * Scoring rules:
 * - +3 points per keyword found in the title (most relevant signal)
 * - +1 point per keyword found in the description or tags
 * - Excluded if any excludeKeyword is found in title or description
 * - Jobs with score 0 are excluded
 * - Results sorted by score DESC, limited to maxResults
 *
 * Diversity rules:
 * - Maximum 2 jobs per source in the final result
 * - Ensures the user gets offers from varied sources
 * - Minimum 1 result if any match exists (even if score is low)
 */
export function matchJobs(
  jobs: NormalizedJob[],
  keywords: string[],
  excludeKeywords: string[],
  maxResults: number = 5
): NormalizedJob[] {
  if (keywords.length === 0) return [];

  const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());
  const normalizedExcludes = excludeKeywords.map((k) => k.toLowerCase().trim());

  const scored: MatchResult[] = [];

  for (const job of jobs) {
    const titleLower = (job.title || "").toLowerCase();
    const descLower = (job.description || "").toLowerCase();
    const tagsLower = (job.tags || []).map((t) => t.toLowerCase()).join(" ");
    const fullText = `${titleLower} ${descLower} ${tagsLower}`;

    // Check exclusions first
    const isExcluded = normalizedExcludes.some(
      (ex) => ex && fullText.includes(ex)
    );
    if (isExcluded) continue;

    // Calculate score
    let score = 0;

    for (const keyword of normalizedKeywords) {
      if (!keyword) continue;

      // Title match = +3 (strong signal)
      if (titleLower.includes(keyword)) {
        score += 3;
      }

      // Description match = +1
      if (descLower.includes(keyword)) {
        score += 1;
      }

      // Tags match = +1
      if (tagsLower.includes(keyword)) {
        score += 1;
      }
    }

    if (score > 0) {
      scored.push({ job, score });
    }
  }

  // Sort by score descending, then by publishedAt descending (newest first)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.job.publishedAt.getTime() - a.job.publishedAt.getTime();
  });

  // Apply per-source cap: max MAX_PER_SOURCE_IN_MATCH per source
  const sourceCounts = new Map<string, number>();
  const diversified: NormalizedJob[] = [];

  for (const { job } of scored) {
    const count = sourceCounts.get(job.source) || 0;
    if (count >= MAX_PER_SOURCE_IN_MATCH) continue;

    sourceCounts.set(job.source, count + 1);
    diversified.push(job);

    if (diversified.length >= maxResults) break;
  }

  // Guarantee minimum 1 result if any match exists
  if (diversified.length === 0 && scored.length > 0) {
    diversified.push(scored[0].job);
  }

  return diversified;
}
