import { NormalizedJob } from "./types";

const HN_API = "https://hacker-news.firebaseio.com/v0";
const HN_SEARCH_API = "https://hn.algolia.com/api/v1";

/**
 * Fetch jobs from the latest "Who is hiring?" thread on Hacker News.
 * Uses Algolia search API to find the thread, then fetches individual comments.
 * Completely free, no key required.
 */
export async function fetchHackerNewsJobs(): Promise<NormalizedJob[]> {
  try {
    // Find the latest "Who is hiring?" thread via Algolia
    const searchResponse = await fetch(
      `${HN_SEARCH_API}/search?query="Ask HN: Who is hiring"&tags=story&hitsPerPage=1`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!searchResponse.ok) {
      console.warn(`[HN] Search HTTP ${searchResponse.status}`);
      return [];
    }

    const searchData = await searchResponse.json();
    const threadId = searchData.hits?.[0]?.objectID;

    if (!threadId) {
      console.warn("[HN] No 'Who is hiring?' thread found");
      return [];
    }

    // Fetch the thread to get comment IDs
    const threadResponse = await fetch(`${HN_API}/item/${threadId}.json`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!threadResponse.ok) {
      console.warn(`[HN] Thread HTTP ${threadResponse.status}`);
      return [];
    }

    const thread = await threadResponse.json();
    const commentIds: number[] = (thread.kids || []).slice(0, 40); // Limit to 40 top-level comments

    // Fetch comments in parallel (batched)
    const jobs: NormalizedJob[] = [];
    const batchSize = 10;

    for (let i = 0; i < commentIds.length; i += batchSize) {
      const batch = commentIds.slice(i, i + batchSize);
      const comments = await Promise.all(
        batch.map(async (id) => {
          try {
            const res = await fetch(`${HN_API}/item/${id}.json`, {
              signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) return null;
            return res.json();
          } catch {
            return null;
          }
        })
      );

      for (const comment of comments) {
        if (!comment || comment.deleted || !comment.text) continue;

        const text = stripHtml(comment.text);
        // HN "Who is hiring" comments typically start with the company name
        const firstLine = text.split("\n")[0] || text.slice(0, 100);

        jobs.push({
          externalId: `hackernews:${comment.id}`,
          source: "hackernews",
          title: firstLine.slice(0, 200),
          company: extractCompany(firstLine),
          description: text.slice(0, 2000),
          url: `https://news.ycombinator.com/item?id=${comment.id}`,
          contactEmail: extractEmail(text),
          location: extractLocation(text),
          salary: null,
          tags: ["hackernews", "who-is-hiring"],
          publishedAt: new Date(comment.time * 1000),
        });
      }
    }

    return jobs;
  } catch (error) {
    console.error("[HN] Fetch error:", error);
    return [];
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
}

function extractCompany(firstLine: string): string | null {
  // HN format often: "Company Name | Role | Location | ..."
  const parts = firstLine.split("|").map((p) => p.trim());
  return parts[0] && parts[0].length < 80 ? parts[0] : null;
}

function extractLocation(text: string): string | null {
  const patterns = [
    /\b(?:remote|onsite|hybrid)\b/i,
    /\b(?:san francisco|new york|berlin|london|paris|worldwide)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}
