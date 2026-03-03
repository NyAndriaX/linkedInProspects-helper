import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import axios from "axios";
import { deleteLinkedInPost, handleLinkedInError } from "@/lib/linkedin";
import {
  cleanupOrphanedLocalPostImages,
  deleteLocalPostImage,
  deleteLocalPostImages,
} from "@/lib/post-images";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isUnknownImageUrlsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown argument `imageUrls`") ||
    error.message.includes("Did you mean `imageUrl`")
  );
}

/**
 * Get post by ID for the authenticated user
 */
async function getPostForUser(id: string, userId: string) {
  return prisma.post.findFirst({
    where: { id, userId },
  });
}

// GET /api/posts/[id] - Get a specific post
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;
    const post = await getPostForUser(id, session.user.id);

    if (!post) return ApiResponse.notFound("Post not found");

    return ApiResponse.success(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    return ApiResponse.error("Failed to fetch post");
  }
}

// PUT /api/posts/[id] - Update a post
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;
    const existingPost = await getPostForUser(id, session.user.id);

    if (!existingPost) return ApiResponse.notFound("Post not found");

    const { title, content, status, imageUrl, imageUrls, publishedAt } = await request.json();
    const normalizedImageUrls = Array.isArray(imageUrls)
      ? imageUrls.filter((item: unknown) => typeof item === "string" && item.trim())
      : undefined;

    if (
      imageUrl !== undefined &&
      existingPost.imageUrl &&
      existingPost.imageUrl !== imageUrl
    ) {
      await deleteLocalPostImage(existingPost.imageUrl);
    }
    if (normalizedImageUrls !== undefined) {
      const existingImages = Array.isArray((existingPost as { imageUrls?: string[] }).imageUrls)
        ? ((existingPost as { imageUrls?: string[] }).imageUrls as string[])
        : [];
      const removedImages = existingImages.filter(
        (existingImage) => !normalizedImageUrls.includes(existingImage)
      );
      await deleteLocalPostImages(removedImages);
    }

    const updateData = {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(status !== undefined && { status }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(normalizedImageUrls !== undefined && { imageUrls: normalizedImageUrls }),
      ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
    };

    try {
      const post = await prisma.post.update({
        where: { id },
        data: updateData,
      });
      await cleanupOrphanedLocalPostImages({ gracePeriodMs: 0, limit: 300 });
      return ApiResponse.success(post);
    } catch (error) {
      if (!isUnknownImageUrlsError(error)) throw error;

      // Fallback for stale Prisma client that doesn't know imageUrls yet.
      const fallbackPost = await prisma.post.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(status !== undefined && { status }),
          ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
          ...(normalizedImageUrls !== undefined && {
            imageUrl: normalizedImageUrls[0] || null,
          }),
          ...(imageUrl !== undefined && { imageUrl }),
        },
      });
      await cleanupOrphanedLocalPostImages({ gracePeriodMs: 0, limit: 300 });

      return ApiResponse.success({
        ...fallbackPost,
        warning:
          "Prisma client is outdated: only the first image was saved. Run `npx prisma db push && npx prisma generate`.",
      });
    }
  } catch (error) {
    console.error("Error updating post:", error);
    return ApiResponse.error("Failed to update post");
  }
}

// DELETE /api/posts/[id] - Delete a post
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { id } = await params;
    const existingPost = await getPostForUser(id, session.user.id);

    if (!existingPost) return ApiResponse.notFound("Post not found");

    if (existingPost.status === "published" && existingPost.linkedInUrn) {
      const accessToken = session.accessToken;
      if (!accessToken) {
        return ApiResponse.unauthorized(
          "LinkedIn session expired. Please sign in again before deleting this published post."
        );
      }

      try {
        await deleteLinkedInPost(existingPost.linkedInUrn, accessToken);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // Post already removed on LinkedIn, continue local cleanup.
        } else {
          const linkedInError = handleLinkedInError(error);
          return ApiResponse.error(
            `Failed to delete LinkedIn post: ${linkedInError.message}`,
            linkedInError.status
          );
        }
      }
    }

    await prisma.post.delete({ where: { id } });
    await deleteLocalPostImages(
      Array.isArray((existingPost as { imageUrls?: string[] }).imageUrls)
        ? ((existingPost as { imageUrls?: string[] }).imageUrls as string[])
        : []
    );
    await deleteLocalPostImage(existingPost.imageUrl);
    await cleanupOrphanedLocalPostImages({ gracePeriodMs: 0, limit: 300 });

    return ApiResponse.success({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    return ApiResponse.error("Failed to delete post");
  }
}
