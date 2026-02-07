import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiResponse,
  getAuthenticatedSession,
  validateRequired,
} from "@/lib/api-utils";

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

    const { title, content, status = "draft", imageUrl } = body;

    const post = await prisma.post.create({
      data: {
        title,
        content,
        status,
        ...(imageUrl && { imageUrl }),
        userId: session.user.id,
      },
    });

    return ApiResponse.created(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return ApiResponse.error("Failed to create post");
  }
}
