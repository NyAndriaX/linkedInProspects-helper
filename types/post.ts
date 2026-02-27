/**
 * Post status enum
 */
export type PostStatus = "draft" | "ready" | "published";

/**
 * Post interface
 */
export interface Post {
  id: string;
  title: string;
  content: string;
  status: PostStatus;
  imageUrl?: string | null;
  linkedInUrn?: string | null;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

/**
 * Post form data
 */
export interface PostFormData {
  title: string;
  content: string;
  status: PostStatus;
  imageUrl?: string | null;
}

/**
 * Post statistics
 */
export interface PostStats {
  total: number;
  draft: number;
  ready: number;
  published: number;
}

/**
 * Status colors configuration
 * Labels are now managed via i18n in messages/[locale].json under "postStatus"
 */
export const postStatusConfig: Record<
  PostStatus,
  { color: string; bgColor: string }
> = {
  draft: { color: "default", bgColor: "#f5f5f5" },
  ready: { color: "blue", bgColor: "#e6f4ff" },
  published: { color: "green", bgColor: "#f6ffed" },
};

/**
 * Post status keys for translation lookup
 */
export const postStatusKeys: PostStatus[] = ["draft", "ready", "published"];

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new post with defaults
 */
export function createPost(
  title: string,
  content: string,
  status: PostStatus = "draft"
): Post {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
    content,
    status,
    createdAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : null,
  };
}
