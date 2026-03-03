import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiResponse,
  getAuthenticatedSession,
  validateRequired,
} from "@/lib/api-utils";

function isUnknownImageUrlsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown argument `imageUrls`") ||
    error.message.includes("Did you mean `imageUrl`")
  );
}

// GET /api/posts - Get all posts for the authenticated user
export async function GET() {
  try {
    const session = await getAuthenticatedSession();

    if (!session) {
      return ApiResponse.unauthorized();
    }

    const posts = await prisma.post.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return ApiResponse.success(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return ApiResponse.error("Failed to fetch posts");
  }
}

// POST /api/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();

    if (!session) {
      return ApiResponse.unauthorized();
    }

    const body = await request.json();
    const validationError = validateRequired(body, ["title", "content"]);

    if (validationError) {
      return ApiResponse.badRequest(validationError);
    }

    const { title, content, status = "draft", imageUrl, imageUrls } = body;
    const normalizedImageUrls = Array.isArray(imageUrls)
      ? imageUrls.filter((item: unknown) => typeof item === "string" && item.trim())
      : [];

    const createData = {
      title,
      content,
      status,
      ...(normalizedImageUrls.length > 0 && { imageUrls: normalizedImageUrls }),
      ...(imageUrl && { imageUrl }),
      userId: session.user.id,
    };

    try {
      const post = await prisma.post.create({
        data: createData,
      });
      return ApiResponse.created(post);
    } catch (error) {
      if (!isUnknownImageUrlsError(error)) throw error;

      // Fallback for stale Prisma client that doesn't know imageUrls yet.
      const fallbackPost = await prisma.post.create({
        data: {
          title,
          content,
          status,
          ...(normalizedImageUrls.length > 0 && {
            imageUrl: normalizedImageUrls[0],
          }),
          ...(imageUrl && { imageUrl }),
          userId: session.user.id,
        },
      });

      return ApiResponse.created({
        ...fallbackPost,
        warning:
          "Prisma client is outdated: only the first image was saved. Run `npx prisma db push && npx prisma generate`.",
      });
    }
  } catch (error) {
    console.error("Error creating post:", error);
    return ApiResponse.error("Failed to create post");
  }
}
