import { NormalizedJob } from "./types";

const SUBREDDITS = ["forhire", "remotejs", "hiring"];
const USER_AGENT = "Mozilla/5.0 (compatible; JobAlertBot/1.0)";

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    url: string;
    permalink: string;
    link_flair_text: string | null;
    created_utc: number;
    subreddit: string;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

/**
 * Fetch job-related posts from Reddit subreddits.
 * Free JSON API, no key required. Rate limit: 100 req/min.
 */
export async function fetchRedditJobs(): Promise<NormalizedJob[]> {
  const allJobs: NormalizedJob[] = [];

  for (const subreddit of SUBREDDITS) {
    try {
      const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        console.warn(`[Reddit] r/${subreddit} HTTP ${response.status}`);
        continue;
      }

      const data: RedditListing = await response.json();

      const posts = (data.data?.children || [])
        // Only keep "Hiring" posts (not "For Hire")
        .filter((post) => {
          const flair = (post.data.link_flair_text || "").toLowerCase();
          const title = post.data.title.toLowerCase();
          return (
            flair.includes("hiring") ||
            title.includes("[hiring]") ||
            title.includes("looking for")
          );
        })
        .map((post) => ({
          externalId: `reddit:${post.data.id}`,
          source: "reddit",
          title: post.data.title,
          company: null,
          description: (post.data.selftext || "").slice(0, 2000),
          url: `https://www.reddit.com${post.data.permalink}`,
          contactEmail: extractEmail(post.data.selftext || ""),
          location: null,
          salary: extractSalary(post.data.title + " " + post.data.selftext),
          tags: [`r/${post.data.subreddit}`, post.data.link_flair_text].filter(
            Boolean
          ) as string[],
          publishedAt: new Date(post.data.created_utc * 1000),
        }));

      allJobs.push(...posts);

      // Small delay between subreddits to respect rate limits
      await sleep(500);
    } catch (error) {
      console.error(`[Reddit] r/${subreddit} fetch error:`, error);
    }
  }

  return allJobs;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
}

function extractSalary(text: string): string | null {
  // Match patterns like "$50/hr", "$80k-$120k", "$100,000"
  const match = text.match(
    /\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\s*\/?\s*(?:hr|hour|yr|year|month|mo|week|wk|k))?/i
  );
  return match ? match[0] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
