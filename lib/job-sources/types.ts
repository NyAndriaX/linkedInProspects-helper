/**
 * Normalized job listing used across all sources.
 * Each fetcher maps its API response to this shape.
 */
export interface NormalizedJob {
  externalId: string; // Unique: "source:originalId"
  source: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  contactEmail: string | null;
  location: string | null;
  salary: string | null;
  tags: string[];
  publishedAt: Date;
}
