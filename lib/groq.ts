import OpenAI from "openai";

// Groq API client (compatible with OpenAI SDK)
// Lazy initialization to avoid build-time errors when env vars are not set
let _groq: OpenAI | null = null;

export function getGroqClient(): OpenAI {
  if (!_groq) {
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _groq;
}

// Model to use (Llama 3.3 70B - best for content generation)
export const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Build a prompt for generating LinkedIn posts
 */
export function buildPostGenerationPrompt(
  profile: ProfileData,
  count: number,
  existingTitles: string[] = [],
  options?: GenerationOptions
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

  const tone = options?.toneOverride
    ? (toneDescriptions[options.toneOverride] || options.toneOverride)
    : profile.preferredTone 
      ? (toneDescriptions[profile.preferredTone] || profile.preferredTone)
      : "professional";

  // Build the list of topics to avoid
  const avoidTopicsSection = existingTitles.length > 0
    ? `\n## TOPICS TO AVOID (Already Generated)
The following topics have already been covered. DO NOT generate posts on the same or very similar subjects:
${existingTitles.map((title) => `- ${title}`).join("\n")}

Generate posts on DIFFERENT and FRESH topics.\n`
    : "";

  // Topic section (when user specifies a specific topic)
  const topicSection = options?.topic
    ? `\n## SPECIFIC TOPIC\nWrite about the following topic/theme: ${options.topic}\nMake sure the content is deeply focused on this subject.\n`
    : "";

  const commonThemeSection =
    options?.topicSource === "common" && options?.selectedTheme
      ? `\n## COMMON THEME MODE (HIGH PRIORITY)
Selected theme: ${options.selectedTheme}

For this mode, strictly follow these rules:
1. Identify current, trending, and relevant subtopics within this selected theme.
2. Pick an interesting angle: recent updates, best practices, real feedback, comparisons, performance, security, or architecture.
3. Write a professional LinkedIn post that shares clear know-how and practical value.
4. You may reference recent updates/news if relevant, but keep it concise and understandable.
5. Keep the tone professional, modern, accessible, and suitable for an IT developer profile.
6. Prefer a natural human style (not robotic).
7. Write in 8 to 15 short lines.
8. End with an engaging question when relevant to spark comments.
`
      : "";

  // Style section (when user picks a specific post format)
  const postStyleDescriptions: Record<string, string> = {
    tips_list: "Write as a numbered list of practical tips or lessons (e.g., '5 things I learned about X'). Use clear numbering and actionable points.",
    personal_story: "Write as a personal narrative sharing a real experience. Include specific details, emotions, and a clear lesson learned.",
    contrarian: "Write as a bold, controversial take that challenges conventional wisdom. Start with a provocative statement and back it up with reasoning.",
    how_to: "Write as a step-by-step practical guide. Include clear instructions that readers can follow immediately.",
    question_driven: "Open with a thought-provoking question that stops the scroll. Build the post around answering that question with insights.",
    case_study: "Write about a specific example, project, or situation. Include context, actions taken, and results/lessons.",
    myth_busting: "Identify and debunk a common misconception in the industry. Present the myth, then reveal the truth with evidence.",
  };

  const styleSection = options?.style && postStyleDescriptions[options.style]
    ? `\n## POST STYLE\n${postStyleDescriptions[options.style]}\n`
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

${topicSection}${commonThemeSection}${styleSection}## YOUR TASK
Generate ${count} unique, high-engagement LinkedIn post(s) that:

1. **Hook**: Start with a powerful hook (question, bold statement, or surprising fact) in the very first line
2. **Storytelling**: Weave a narrative arc - setup, challenge, resolution/insight
3. **Value**: Provide genuine value, insights, or actionable advice
4. **Personal Touch**: Include personal experience or perspective when relevant
5. **Engagement**: End with a thought-provoking question to encourage comments
6. **Format**: Use line breaks, emojis sparingly (2-4 max), and easy-to-read structure
7. **Length**: 150-250 words each, maximum 1300 characters (optimal for LinkedIn algorithm)
8. **Authenticity**: Write as if the author is sharing genuinely, not selling

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
- "content": The full post content ready to publish (use \\n for line breaks in JSON). Do NOT include hashtags in the content.
- "hashtags": An array of exactly 5 relevant hashtags as strings (include the # symbol, e.g., "#freelance")

IMPORTANT: In the JSON content field, use \\n for line breaks, NOT actual newlines. Hashtags MUST be in the separate "hashtags" array only, NOT in the content.

Example format:
[
  {
    "title": "Leadership Lessons from Failure",
    "content": "First paragraph here.\\n\\nSecond paragraph here.\\n\\nWhat do you think?",
    "hashtags": ["#leadership", "#failure", "#lessons", "#growth", "#mindset"]
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
  phone?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  linkedInProfileUrl?: string;
}

/**
 * Generation options for customizing AI output
 */
export interface GenerationOptions {
  topic?: string;
  topicSource?: "auto" | "common";
  selectedTheme?: string;
  toneOverride?: string;
  style?: string;
  includeContactCta?: boolean;
}

/**
 * Parsed post structure with hashtags
 */
export interface ParsedPost {
  title: string;
  content: string;
  hashtags: string[];
}

/**
 * Parse generated posts from Groq response
 */
export function parseGeneratedPosts(content: string): ParsedPost[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure each post has the expected structure including hashtags
      return parsed.map((post: { title?: string; content?: string; hashtags?: string[] }) => ({
        title: post.title || "Generated Post",
        content: post.content || "",
        hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
      }));
    }
    throw new Error("No JSON array found in response");
  } catch {
    // If parsing fails, create a single post from the content
    return [{
      title: "Generated Post",
      content: content.trim(),
      hashtags: [],
    }];
  }
}
