import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
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

    const { title, content, status, imageUrl, publishedAt } = await request.json();

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
      },
    });

    return ApiResponse.success(post);
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

    await prisma.post.delete({ where: { id } });

    return ApiResponse.success({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    return ApiResponse.error("Failed to delete post");
  }
}
