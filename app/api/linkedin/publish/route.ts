import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  linkedInClient,
  buildPostBody,
  handleLinkedInError,
} from "@/lib/linkedin";

interface PublishRequest {
  content: string;
  postId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);

    if (!session?.accessToken || !session?.linkedInId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in again." },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const { content, postId }: PublishRequest = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Check if post exists and is not a draft
    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { status: true },
      });

      if (post?.status === "draft") {
        return NextResponse.json(
          { error: "Cannot publish a draft post. Please mark it as ready first." },
          { status: 400 }
        );
      }
    }

    console.log(`[LinkedIn Publish] Starting publication for postId: ${postId}`);
    console.log(`[LinkedIn Publish] LinkedIn ID: ${session.linkedInId}`);

    // Publish to LinkedIn
    const response = await linkedInClient.post(
      "/ugcPosts",
      buildPostBody(session.linkedInId, content),
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    // Log all response headers to debug URN extraction
    console.log(`[LinkedIn Publish] Response status: ${response.status}`);
    console.log(`[LinkedIn Publish] Response headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`[LinkedIn Publish] Response data:`, JSON.stringify(response.data, null, 2));

    // Extract post URN from response headers
    // The URN format is: urn:li:ugcPost:123456789 or urn:li:share:123456789
    const linkedInPostId = response.headers["x-restli-id"] || response.data?.id || null;
    
    console.log(`[LinkedIn Publish] Extracted URN: ${linkedInPostId}`);

    // Update the post with the LinkedIn URN, status, and publishedAt
    if (postId && linkedInPostId) {
      console.log(`[LinkedIn Publish] Updating post ${postId} with URN: ${linkedInPostId}`);
      await prisma.post.update({
        where: { id: postId },
        data: {
          linkedInUrn: linkedInPostId,
          status: "published",
          publishedAt: new Date(),
        },
      });
      console.log(`[LinkedIn Publish] Successfully saved URN to post ${postId}`);
    } else {
      console.warn(`[LinkedIn Publish] WARNING: Could not save URN. postId=${postId}, linkedInPostId=${linkedInPostId}`);
    }

    return NextResponse.json({
      success: true,
      linkedInPostId,
      postId,
    });
  } catch (error) {
    console.error("LinkedIn publish error:", error);
    const { message, status } = handleLinkedInError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
