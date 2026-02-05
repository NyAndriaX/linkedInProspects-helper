import OpenAI from "openai";

// Groq API client (compatible with OpenAI SDK)
export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Model to use (Llama 3.3 70B - best for content generation)
export const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Build a prompt for generating LinkedIn posts
 */
export function buildPostGenerationPrompt(
  profile: ProfileData,
  count: number,
  existingTitles: string[] = []
): string {
  const language = profile.preferredLanguage === "fr" ? "French" : "English";
  
  const toneDescriptions: Record<string, string> = {
    professional: "formal and business-oriented",
    casual: "friendly and approachable",
    inspirational: "motivating and uplifting",
    educational: "informative and instructive",
    storytelling: "narrative and personal with real experiences",
    provocative: "bold and thought-provoking",
    humorous: "light-hearted with clever wit",
  };

  const goalDescriptions: Record<string, string> = {
    thought_leadership: "positioning as an industry expert",
    lead_generation: "attracting potential clients",
    brand_awareness: "increasing visibility",
    network_growth: "expanding professional connections",
    recruitment: "attracting talent",
    education: "sharing valuable knowledge",
    engagement: "sparking conversations and interactions",
  };

  const goals = (profile.contentGoals || [])
    .map((g) => goalDescriptions[g] || g)
    .join(", ");

  const tone = profile.preferredTone 
    ? (toneDescriptions[profile.preferredTone] || profile.preferredTone)
    : "professional";

  // Build the list of topics to avoid
  const avoidTopicsSection = existingTitles.length > 0
    ? `\n## TOPICS TO AVOID (Already Generated)
The following topics have already been covered. DO NOT generate posts on the same or very similar subjects:
${existingTitles.map((title) => `- ${title}`).join("\n")}

Generate posts on DIFFERENT and FRESH topics.\n`
    : "";

  return `You are an expert LinkedIn content strategist who creates viral, engaging posts.
${avoidTopicsSection}
## AUTHOR PROFILE
- Job Title: ${profile.jobTitle || "Professional"}${profile.company ? `\n- Company: ${profile.company}` : "\n- Status: Independent / Freelance / Entrepreneur"}
- Industry: ${profile.industry || "General"}
- Years of Experience: ${profile.yearsOfExperience || "Several years"}
- Expertise Areas: ${profile.expertise?.join(", ") || "Various fields"}
- Unique Value Proposition: ${profile.uniqueValue || "Professional insights"}
- Personal Brand: ${profile.personalBrand || "Authentic professional voice"}

## TARGET AUDIENCE
- Primary Audience: ${profile.targetAudience || "Professionals"}
- Target Industries: ${profile.targetIndustries?.join(", ") || "Various industries"}

## CONTENT PREFERENCES
- Topics to cover: ${profile.contentTopics?.join(", ") || "Industry insights, professional growth"}
- Content Goals: ${goals || "engagement and thought leadership"}
- Tone: ${tone}
- Language: ${language}

## YOUR TASK
Generate ${count} unique, high-engagement LinkedIn post(s) that:

1. **Hook**: Start with a powerful hook (question, bold statement, or surprising fact)
2. **Value**: Provide genuine value, insights, or actionable advice
3. **Personal Touch**: Include personal experience or perspective when relevant
4. **Engagement**: End with a question or call-to-action to encourage comments
5. **Format**: Use line breaks, emojis sparingly (2-4 max), and easy-to-read structure
6. **Length**: 150-300 words each (optimal for LinkedIn algorithm)
7. **Authenticity**: Write as if the author is sharing genuinely, not selling

## VIRAL POST PATTERNS TO USE
- Contrarian takes on common industry beliefs
- "X things I learned from Y" lists
- Personal failure stories with lessons
- Industry predictions or trends
- Behind-the-scenes insights
- Myth-busting in the industry
- Celebrating others' success stories

## OUTPUT FORMAT
Return a JSON array with exactly ${count} object(s), each containing:
- "title": A short internal title for the post (not displayed on LinkedIn)
- "content": The full post content ready to publish (use \\n for line breaks in JSON)

IMPORTANT: In the JSON content field, use \\n for line breaks, NOT actual newlines.

Example format:
[
  {
    "title": "Leadership Lessons from Failure",
    "content": "First paragraph here.\\n\\nSecond paragraph here.\\n\\nCall to action?"
  }
]

Generate the posts now in ${language}:`;
}

/**
 * Profile data interface for generation
 */
export interface ProfileData {
  jobTitle?: string;
  company?: string;
  industry?: string;
  yearsOfExperience?: string;
  targetAudience?: string;
  targetIndustries?: string[];
  contentGoals?: string[];
  preferredTone?: string;
  preferredLanguage?: string;
  contentTopics?: string[];
  uniqueValue?: string;
  expertise?: string[];
  personalBrand?: string;
}

/**
 * Parse generated posts from Groq response
 */
export function parseGeneratedPosts(content: string): { title: string; content: string }[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON array found in response");
  } catch {
    // If parsing fails, create a single post from the content
    return [{
      title: "Generated Post",
      content: content.trim(),
    }];
  }
}
