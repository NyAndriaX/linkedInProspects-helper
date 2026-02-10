import { NormalizedJob } from "./types";

const API_URL = "https://remotive.com/api/remote-jobs";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

/**
 * Fetch remote jobs from Remotive API.
 * Free, no API key required.
 */
export async function fetchRemotiveJobs(): Promise<NormalizedJob[]> {
  try {
    const response = await fetch(`${API_URL}?limit=50`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[Remotive] HTTP ${response.status}`);
      return [];
    }

    const data: RemotiveResponse = await response.json();

    return data.jobs.map((job) => ({
      externalId: `remotive:${job.id}`,
      source: "remotive",
      title: job.title,
      company: job.company_name || null,
      description: stripHtml(job.description || ""),
      url: job.url,
      contactEmail: extractEmail(job.description || ""),
      location: job.candidate_required_location || null,
      salary: job.salary || null,
      tags: [...(job.tags || []), job.category].filter(Boolean),
      publishedAt: new Date(job.publication_date),
    }));
  } catch (error) {
    console.error("[Remotive] Fetch error:", error);
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
