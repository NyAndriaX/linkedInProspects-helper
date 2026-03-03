import path from "path";
import { readdir, stat, unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";

const LOCAL_POST_IMAGE_PREFIX = "/uploads/posts/";
const POSTS_UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads", "posts");

function getLocalPostImagePath(imageUrl: string): string | null {
  if (!imageUrl.startsWith(LOCAL_POST_IMAGE_PREFIX)) {
    return null;
  }

  const relativePath = imageUrl.replace(/^\/+/, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePath);
  const allowedRoot = POSTS_UPLOADS_ROOT;

  if (!absolutePath.startsWith(allowedRoot)) {
    return null;
  }

  return absolutePath;
}

export async function deleteLocalPostImage(imageUrl?: string | null) {
  if (!imageUrl) return;

  const localPath = getLocalPostImagePath(imageUrl);
  if (!localPath) return;

  try {
    await unlink(localPath);
  } catch {
    // Ignore file deletion failures (already removed, missing file, etc.)
  }
}

export async function deleteLocalPostImages(imageUrls?: string[] | null) {
  if (!imageUrls || imageUrls.length === 0) return;
  await Promise.all(imageUrls.map((imageUrl) => deleteLocalPostImage(imageUrl)));
}

interface CleanupOptions {
  gracePeriodMs?: number;
  limit?: number;
}

export async function cleanupOrphanedLocalPostImages(
  options: CleanupOptions = {}
) {
  const gracePeriodMs = options.gracePeriodMs ?? 2 * 60 * 60 * 1000; // 2 hours
  const limit = options.limit ?? 200;
  const now = Date.now();

  let fileNames: string[] = [];
  try {
    fileNames = await readdir(POSTS_UPLOADS_ROOT);
  } catch {
    // uploads/posts might not exist yet
    return { deletedCount: 0, checkedCount: 0 };
  }

  const posts = await prisma.post.findMany({
    select: {
      imageUrl: true,
      imageUrls: true,
    },
  });

  const referencedPaths = new Set<string>();
  for (const post of posts) {
    if (post.imageUrl) {
      const localPath = getLocalPostImagePath(post.imageUrl);
      if (localPath) referencedPaths.add(localPath);
    }
    if (Array.isArray((post as { imageUrls?: string[] }).imageUrls)) {
      for (const imageUrl of (post as { imageUrls?: string[] }).imageUrls || []) {
        const localPath = getLocalPostImagePath(imageUrl);
        if (localPath) referencedPaths.add(localPath);
      }
    }
  }

  let deletedCount = 0;
  let checkedCount = 0;

  for (const fileName of fileNames) {
    if (checkedCount >= limit) break;
    checkedCount += 1;

    const absolutePath = path.resolve(POSTS_UPLOADS_ROOT, fileName);
    if (!absolutePath.startsWith(POSTS_UPLOADS_ROOT)) continue;
    if (referencedPaths.has(absolutePath)) continue;

    try {
      const fileStats = await stat(absolutePath);
      if (!fileStats.isFile()) continue;
      if (now - fileStats.mtimeMs < gracePeriodMs) continue;
      await unlink(absolutePath);
      deletedCount += 1;
    } catch {
      // Ignore file race conditions or delete failures
    }
  }

  return { deletedCount, checkedCount };
}
