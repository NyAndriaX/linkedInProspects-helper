import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { groq, GROQ_MODEL, buildPostGenerationPrompt, parseGeneratedPosts, ProfileData, GenerationOptions } from "@/lib/groq";

interface GenerateRequest {
  count: number;
  topic?: string;
  toneOverride?: string;
  style?: string;
  preview?: boolean;
  includeImage?: boolean;
}

/**
 * Fetch a relevant image from Unsplash based on a search query
 */
async function fetchUnsplashImage(query: string, page = 1): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("[Unsplash] No UNSPLASH_ACCESS_KEY configured, skipping image fetch");
    return null;
  }

  try {
    console.log(`[Unsplash] Fetching image for query: "${query}" (page ${page})`);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=landscape&client_id=${accessKey}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      console.warn("[Unsplash] API returned status:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.results?.[0]?.urls?.regular || null;
    console.log("[Unsplash] Image result:", imageUrl ? "found" : "no results");
    return imageUrl;
  } catch (error) {
    console.error("[Unsplash] Failed to fetch image:", error instanceof Error ? error.message : error);
    return null;
  }
}

// POST /api/generate - Generate posts with AI
export async function POST(request: NextRequest) {
  try {
    // Validate session
    const session = await getAuthenticatedSession();
    if (!session) {
      return ApiResponse.unauthorized();
    }

    // Parse request body
    const { count = 1, topic, toneOverride, style, preview = false, includeImage = false }: GenerateRequest = await request.json();

    // Validate count
    if (count < 1 || count > 10) {
      return ApiResponse.badRequest("Count must be between 1 and 10");
    }

    // Get user profile from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        jobTitle: true,
        company: true,
        industry: true,
        yearsOfExperience: true,
        targetAudience: true,
        targetIndustries: true,
        contentGoals: true,
        preferredTone: true,
        preferredLanguage: true,
        contentTopics: true,
        uniqueValue: true,
        expertise: true,
        personalBrand: true,
      },
    });

    if (!user) {
      return ApiResponse.notFound("User profile not found");
    }

    // Check if profile is complete enough
    if (!user.jobTitle || !user.industry || !user.contentGoals?.length) {
      return ApiResponse.badRequest(
        "Please complete your profile settings before generating posts"
      );
    }

    // Get existing post titles to avoid duplicate topics
    const existingPosts = await prisma.post.findMany({
      where: { userId: session.user.id },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to last 50 posts to keep prompt size manageable
    });
    const existingTitles = existingPosts.map((post) => post.title);

    // Build prompt
    const profile: ProfileData = {
      jobTitle: user.jobTitle || undefined,
      company: user.company || undefined,
      industry: user.industry || undefined,
      yearsOfExperience: user.yearsOfExperience || undefined,
      targetAudience: user.targetAudience || undefined,
      targetIndustries: user.targetIndustries || undefined,
      contentGoals: user.contentGoals || undefined,
      preferredTone: user.preferredTone || undefined,
      preferredLanguage: user.preferredLanguage || undefined,
      contentTopics: user.contentTopics || undefined,
      uniqueValue: user.uniqueValue || undefined,
      expertise: user.expertise || undefined,
      personalBrand: user.personalBrand || undefined,
    };

    // Build generation options from request
    const generationOptions: GenerationOptions = {};
    if (topic) generationOptions.topic = topic;
    if (toneOverride) generationOptions.toneOverride = toneOverride;
    if (style) generationOptions.style = style;

    const prompt = buildPostGenerationPrompt(profile, count, existingTitles, generationOptions);

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert LinkedIn content creator. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 4000,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      return ApiResponse.error("No response from AI");
    }

    // Parse generated posts
    const generatedPosts = parseGeneratedPosts(responseContent);

    // Fetch Unsplash images if requested (one per post, based on title)
    let postsWithImages = generatedPosts.map((post) => ({
      ...post,
      imageUrl: null as string | null,
    }));

    console.log("[Generate] includeImage:", includeImage, "| posts count:", generatedPosts.length);

    if (includeImage) {
      const imagePromises = generatedPosts.map((post, index) => {
        // Use post title for unique queries; fall back to topic + index variation
        const query = post.title || topic || "technology";
        // Use different pages so each post gets a distinct image
        return fetchUnsplashImage(query, index + 1);
      });
      const images = await Promise.all(imagePromises);
      console.log("[Generate] Unsplash images fetched:", images.map((img) => img ? "OK" : "null"));
      postsWithImages = postsWithImages.map((post, i) => ({
        ...post,
        imageUrl: images[i],
      }));
    }

    // Preview mode: return generated content without saving to DB
    if (preview) {
      return ApiResponse.success({
        success: true,
        count: postsWithImages.length,
        posts: postsWithImages,
      });
    }

    // Save posts to database as ready (include hashtags in content)
    const createdPosts = await Promise.all(
      postsWithImages.map((post) => {
        const fullContent = post.hashtags.length > 0
          ? post.content + "\n\n" + post.hashtags.join(" ")
          : post.content;
        return prisma.post.create({
          data: {
            title: post.title,
            content: fullContent,
            status: "ready",
            userId: session.user.id,
          },
        });
      })
    );

    return ApiResponse.success({
      success: true,
      count: createdPosts.length,
      posts: createdPosts,
    });
  } catch (error) {
    console.error("Error generating posts:", error);

    // Handle specific API errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return ApiResponse.error("AI service configuration error", 503);
      }
      if (error.message.includes("rate limit")) {
        return ApiResponse.error("Rate limit exceeded. Please try again later.", 429);
      }
    }

    return ApiResponse.error("Failed to generate posts");
  }
}
