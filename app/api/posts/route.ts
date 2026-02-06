import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiResponse,
  getAuthenticatedSession,
  validateRequired,
} from "@/lib/api-utils";
import { getPostStats } from "@/lib/linkedin";

/**
 * Fetch reactions for a single post with timeout
 */
async function fetchReactionsWithTimeout(
  accessToken: string,
  postId: string,
  linkedInUrn: string,
  timeoutMs: number = 5000
): Promise<{ id: string; reactions: number } | null> {
  try {
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), timeoutMs)
    );
    
    const reactionsPromise = getPostStats(accessToken, linkedInUrn).then((reactions) => ({
      id: postId,
      reactions,
    }));

    return await Promise.race([reactionsPromise, timeoutPromise]);
  } catch (error) {
    console.error(`[Posts API] Error fetching reactions for post ${postId}:`, error);
    return null;
  }
}

/**
 * Fetch and update LinkedIn reactions for published posts
 * Returns posts with updated reactions count
 */
async function refreshLinkedInReactions(
  posts: { id: string; linkedInUrn: string | null }[],
  accessToken: string
): Promise<Map<string, number>> {
  const reactionsMap = new Map<string, number>();
  
  // Filter posts that have a LinkedIn URN
  const publishedPosts = posts.filter((p) => p.linkedInUrn);

  if (publishedPosts.length === 0) {
    return reactionsMap;
  }

  console.log(`[Posts API] Refreshing reactions for ${publishedPosts.length} published posts`);

  // Fetch reactions for each post in parallel with timeout
  const results = await Promise.all(
    publishedPosts.map((post) =>
      fetchReactionsWithTimeout(accessToken, post.id, post.linkedInUrn!, 5000)
    )
  );

  // Process results and update database
  const updatePromises: Promise<void>[] = [];
  
  for (const result of results) {
    if (result) {
      reactionsMap.set(result.id, result.reactions);
      
      // Update database
      updatePromises.push(
        prisma.post.update({
          where: { id: result.id },
          data: { reactions: result.reactions },
        }).then(() => {
          console.log(`[Posts API] Updated reactions for post ${result.id}: ${result.reactions}`);
        }).catch((error) => {
          console.error(`[Posts API] Failed to save reactions for post ${result.id}:`, error);
        })
      );
    }
  }

  // Wait for all database updates to complete
  await Promise.all(updatePromises);
  
  console.log(`[Posts API] Finished refreshing LinkedIn reactions`);
  return reactionsMap;
}

// GET /api/posts - Get all posts for the authenticated user
export async function GET() {
  try {
    const session = await getAuthenticatedSession();

    if (!session) {
      return ApiResponse.unauthorized();
    }

    const accessToken = session.accessToken as string | undefined;

    // Fetch posts from database
    let posts = await prisma.post.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    // If we have an access token, refresh LinkedIn reactions
    if (accessToken) {
      const reactionsMap = await refreshLinkedInReactions(
        posts.map((p) => ({ id: p.id, linkedInUrn: p.linkedInUrn })),
        accessToken
      );

      // Merge fresh reactions into posts response
      posts = posts.map((post) => {
        const freshReactions = reactionsMap.get(post.id);
        if (freshReactions !== undefined) {
          return { ...post, reactions: freshReactions };
        }
        return post;
      });
    }

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

    const { title, content, status = "draft" } = body;

    const post = await prisma.post.create({
      data: {
        title,
        content,
        status,
        userId: session.user.id,
      },
    });

    return ApiResponse.created(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return ApiResponse.error("Failed to create post");
  }
}
