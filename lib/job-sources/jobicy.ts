import { NormalizedJob } from "./types";

const API_URL = "https://jobicy.com/api/v2/remote-jobs";

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobIndustry: string[];
  jobType: string[];
  jobGeo: string;
  jobLevel: string;
  jobExcerpt: string;
  pubDate: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}

interface JobicyResponse {
  jobs: JobicyJob[];
}

/**
 * Fetch remote jobs from Jobicy API.
 * Free, no API key required. Recommended: a few calls per day max.
 */
export async function fetchJobicyJobs(): Promise<NormalizedJob[]> {
  try {
    const response = await fetch(`${API_URL}?count=50`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[Jobicy] HTTP ${response.status}`);
      return [];
    }

    const data: JobicyResponse = await response.json();

    return (data.jobs || []).map((job) => ({
      externalId: `jobicy:${job.id}`,
      source: "jobicy",
      title: job.jobTitle,
      company: job.companyName || null,
      description: stripHtml(job.jobDescription || job.jobExcerpt || ""),
      url: job.url,
      contactEmail: extractEmail(job.jobDescription || ""),
      location: job.jobGeo || null,
      salary: formatSalary(job),
      tags: [...(job.jobIndustry || []), ...(job.jobType || []), job.jobLevel].filter(Boolean),
      publishedAt: new Date(job.pubDate),
    }));
  } catch (error) {
    console.error("[Jobicy] Fetch error:", error);
    return [];
  }
}

function formatSalary(job: JobicyJob): string | null {
  if (job.salaryMin && job.salaryMax && job.salaryCurrency) {
    return `${job.salaryMin}-${job.salaryMax} ${job.salaryCurrency}`;
  }
  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
}
