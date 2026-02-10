import { NormalizedJob } from "./types";

const API_URL = "https://www.arbeitnow.com/api/job-board-api";

interface ArbeitnowJob {
  slug: string;
  title: string;
  company_name: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number; // Unix timestamp
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
}

/**
 * Fetch jobs from Arbeitnow API (Europe + Remote focus).
 * Free, no API key required.
 */
export async function fetchArbeitnowJobs(): Promise<NormalizedJob[]> {
  try {
    const response = await fetch(API_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[Arbeitnow] HTTP ${response.status}`);
      return [];
    }

    const data: ArbeitnowResponse = await response.json();

    return (data.data || []).slice(0, 50).map((job) => ({
      externalId: `arbeitnow:${job.slug}`,
      source: "arbeitnow",
      title: job.title,
      company: job.company_name || null,
      description: stripHtml(job.description || ""),
      url: job.url,
      contactEmail: extractEmail(job.description || ""),
      location: job.location || (job.remote ? "Remote" : null),
      salary: null,
      tags: [...(job.tags || []), ...(job.job_types || [])].filter(Boolean),
      publishedAt: new Date(job.created_at * 1000),
    }));
  } catch (error) {
    console.error("[Arbeitnow] Fetch error:", error);
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
}
