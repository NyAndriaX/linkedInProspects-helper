import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { groq, GROQ_MODEL } from "@/lib/groq";

interface PostIdea {
  hook: string;
  description: string;
  type: string;
  hashtags: string[];
}

function buildIdeasPrompt(profile: {
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  expertise?: string[];
  contentTopics?: string[];
  targetAudience?: string | null;
  preferredLanguage?: string | null;
}): string {
  const language = profile.preferredLanguage === "en" ? "English" : "French";
  const year = new Date().getFullYear();
  const weekNumber = Math.ceil(
    (Date.now() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return `You are an expert LinkedIn content strategist specializing in helping professionals create viral content.

## AUTHOR PROFILE
- Job Title: ${profile.jobTitle || "Full-stack Developer / Freelance"}
- Company: ${profile.company || "Freelance / Independent"}
- Industry: ${profile.industry || "Technology"}
- Expertise: ${profile.expertise?.join(", ") || "Next.js, React, Node.js, TypeScript"}
- Content Topics: ${profile.contentTopics?.join(", ") || "Freelancing, Web Development, AI, Remote Work"}
- Target Audience: ${profile.targetAudience || "Tech professionals, startups, businesses looking for developers"}

## CONTEXT
- Year: ${year}, Week ${weekNumber}
- Current trends: AI agents, LLMs in production, remote-first companies, African tech ecosystem growth, freelancing economy, Next.js/React innovations, B2B prospecting strategies, personal branding on LinkedIn

## YOUR TASK
Generate exactly 7 unique and creative LinkedIn post ideas. Each idea should be fresh, timely, and optimized for high engagement.

## RULES
1. **Variety**: Mix different post types — don't repeat the same format
2. **Hooks**: Each hook must be scroll-stopping (question, bold statement, number, controversy)
3. **Relevance**: Ideas must be relevant to the author's profile and ${year} trends
4. **Actionable**: Each description should give enough direction to write a full post
5. **Language**: Write everything in ${language}

## POST TYPES (use a mix)
- "text" — Classic text post with storytelling or insights
- "carousel" — Multi-slide educational content (3-5 key points)
- "question" — Open question to spark debate in comments
- "story" — Personal experience / behind-the-scenes
- "tips" — Numbered list of actionable tips
- "hot_take" — Controversial or contrarian opinion
- "case_study" — Real project or client example breakdown

## OUTPUT FORMAT
Return a JSON array of exactly 7 objects:
[
  {
    "hook": "The scroll-stopping first line / title (max 100 chars)",
    "description": "2-4 sentences describing what the post should cover, the angle, and the CTA",
    "type": "text|carousel|question|story|tips|hot_take|case_study",
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
  }
]

IMPORTANT: Return ONLY valid JSON, no markdown, no comments. Include exactly 3-5 hashtags per idea.

Generate the ideas now:`;
}

function parseIdeas(content: string): PostIdea[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map(
        (idea: {
          hook?: string;
          description?: string;
          type?: string;
          hashtags?: string[];
        }) => ({
          hook: idea.hook || "Post idea",
          description: idea.description || "",
          type: idea.type || "text",
          hashtags: Array.isArray(idea.hashtags) ? idea.hashtags : [],
        })
      );
    }
    throw new Error("No JSON array found");
  } catch {
    return [
      {
        hook: content.slice(0, 100),
        description: content,
        type: "text",
        hashtags: [],
      },
    ];
  }
}

// GET /api/suggest-ideas
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    // Fetch user profile for personalized suggestions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        jobTitle: true,
        company: true,
        industry: true,
        expertise: true,
        contentTopics: true,
        targetAudience: true,
        preferredLanguage: true,
      },
    });

    const prompt = buildIdeasPrompt(user || {});

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert LinkedIn content strategist. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 3000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return ApiResponse.error("No response from AI");
    }

    const ideas = parseIdeas(responseContent);

    return ApiResponse.success({
      ideas,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[SuggestIdeas] Error:", error);
    if (error instanceof Error && error.message.includes("rate limit")) {
      return ApiResponse.error(
        "Rate limit exceeded. Please try again later.",
        429
      );
    }
    return ApiResponse.error("Failed to generate ideas");
  }
}
