import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  linkedInClient,
  buildPostBody,
  buildPostBodyWithImage,
  buildPostBodyWithImages,
  prepareLinkedInImage,
  prepareLinkedInImages,
  handleLinkedInError,
} from "@/lib/linkedin";

interface PublishRequest {
  content: string;
  postId: string;
  imageUrl?: string | null;
  imageUrls?: string[];
}

const LINKEDIN_MAX_COMMENTARY_LENGTH = 3000;

function sanitizeLinkedInCommentary(content: string): string {
  let normalized = content;

  // Convert markdown links to plain text to avoid little-text parsing issues.
  normalized = normalized.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    "$1: $2"
  );

  // Convert markdown bullet style to plain bullets.
  normalized = normalized.replace(/^\s*\*\s+/gm, "- ");

  // Escape little-text reserved characters that can truncate rendering.
  normalized = normalized.replace(/([\\\[\]\(\)])/g, "\\$1");

  return normalized;
}

function normalizeLinkedInCommentary(content: string): {
  commentary: string;
  warning?: string;
} {
  const trimmed = sanitizeLinkedInCommentary(content).trim();
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

function getImageCandidates(imageUrl?: string | null, imageUrls?: string[]): string[] {
  const candidates = [
    imageUrl || "",
    ...(Array.isArray(imageUrls) ? imageUrls : []),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return Array.from(new Set(candidates));
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
    const imageCandidates = getImageCandidates(imageUrl, imageUrls);
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
    console.log(`[LinkedIn Publish] Image candidates: ${imageCandidates.length}`);

    const { commentary, warning: commentaryWarning } =
      normalizeLinkedInCommentary(content);
    if (commentaryWarning) warnings.push(commentaryWarning);
    // If there's an image, upload it to LinkedIn first
    let postBody;
    if (imageCandidates.length > 0) {
      const imageAssets = await prepareLinkedInImages(
        imageCandidates,
        session.linkedInId,
        session.accessToken
      );

      if (imageAssets.length >= 2) {
        postBody = buildPostBodyWithImages(
          session.linkedInId,
          commentary,
          imageAssets
        );
      } else if (imageAssets.length === 1) {
        postBody = buildPostBodyWithImage(
          session.linkedInId,
          commentary,
          imageAssets[0]
        );
        if (imageCandidates.length > 1) {
          warnings.push(
            "Only one image could be uploaded to LinkedIn. The post was published with one image."
          );
        }
      } else {
        console.warn("[LinkedIn Publish] All image candidates failed, publishing text-only");
        warnings.push(
          "No selected image could be uploaded to LinkedIn. The post was published as text-only."
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
