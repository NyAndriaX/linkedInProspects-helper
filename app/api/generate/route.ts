import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { groq, GROQ_MODEL, buildPostGenerationPrompt, parseGeneratedPosts, ProfileData } from "@/lib/groq";

interface GenerateRequest {
  count: number;
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
    const { count = 1 }: GenerateRequest = await request.json();

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

    const prompt = buildPostGenerationPrompt(profile, count, existingTitles);

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

    // Save posts to database as ready
    const createdPosts = await Promise.all(
      generatedPosts.map((post) =>
        prisma.post.create({
          data: {
            title: post.title,
            content: post.content,
            status: "ready",
            userId: session.user.id,
          },
        })
      )
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
