import path from "path";
import { unlink } from "fs/promises";

const LOCAL_POST_IMAGE_PREFIX = "/uploads/posts/";

function getLocalPostImagePath(imageUrl: string): string | null {
  if (!imageUrl.startsWith(LOCAL_POST_IMAGE_PREFIX)) {
    return null;
  }

  const relativePath = imageUrl.replace(/^\/+/, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePath);
  const allowedRoot = path.resolve(process.cwd(), "public", "uploads", "posts");

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
