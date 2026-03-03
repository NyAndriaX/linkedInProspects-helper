import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  linkedInClient,
  buildPostBody,
  buildPostBodyWithImage,
  prepareLinkedInImage,
  handleLinkedInError,
} from "@/lib/linkedin";
import { toAbsolutePostImageUrl } from "@/lib/post-image-url";

interface PublishRequest {
  content: string;
  postId: string;
  imageUrl?: string | null;
  imageUrls?: string[];
}

const LINKEDIN_MAX_COMMENTARY_LENGTH = 3000;

function normalizeLinkedInCommentary(content: string): {
  commentary: string;
  warning?: string;
} {
  const trimmed = content.trim();
  if (trimmed.length <= LINKEDIN_MAX_COMMENTARY_LENGTH) {
    return { commentary: trimmed };
  }

  const shortened = `${trimmed.slice(0, LINKEDIN_MAX_COMMENTARY_LENGTH - 3)}...`;
  return {
    commentary: shortened,
    warning:
      "Your post exceeded LinkedIn's 3000-character limit and was automatically shortened.",
  };
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
    const { content, postId, imageUrl, imageUrls }: PublishRequest = await request.json();
    const primaryImageUrl =
      imageUrl ||
      (Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : null);
    const warnings: string[] = [];

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
    console.log(`[LinkedIn Publish] Image URL: ${primaryImageUrl || "none"}`);

    const { commentary, warning: commentaryWarning } =
      normalizeLinkedInCommentary(content);
    if (commentaryWarning) warnings.push(commentaryWarning);
    if (Array.isArray(imageUrls) && imageUrls.length > 1) {
      warnings.push("LinkedIn supports one image per post in this flow. Only the first image was used.");
    }

    // If there's an image, upload it to LinkedIn first
    let postBody;
    if (primaryImageUrl) {
      const normalizedImageUrl = toAbsolutePostImageUrl(
        primaryImageUrl,
        request.nextUrl.origin
      );
      const imageAsset = await prepareLinkedInImage(
        normalizedImageUrl,
        session.linkedInId,
        session.accessToken
      );

      if (imageAsset) {
        console.log(`[LinkedIn Publish] Image asset ready: ${imageAsset}`);
        postBody = buildPostBodyWithImage(session.linkedInId, commentary, imageAsset);
      } else {
        // Image upload failed, fall back to text-only post
        console.warn("[LinkedIn Publish] Image upload failed, publishing text-only");
        warnings.push(
          "The image could not be uploaded to LinkedIn. The post was published as text-only."
        );
        postBody = buildPostBody(session.linkedInId, commentary);
      }
    } else {
      postBody = buildPostBody(session.linkedInId, commentary);
    }

    // Publish to LinkedIn using the new REST Posts API
    const response = await linkedInClient.post(
      "/posts",
      postBody,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    // Log response for debugging
    console.log(`[LinkedIn Publish] Response status: ${response.status}`);
    console.log(`[LinkedIn Publish] Response headers:`, JSON.stringify(response.headers, null, 2));

    // Extract post URN from response headers (201 response)
    // The x-restli-id header contains: urn:li:share:{id} or urn:li:ugcPost:{id}
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
      warnings,
    });
  } catch (error) {
    console.error("LinkedIn publish error:", error);
    const { message, status } = handleLinkedInError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
