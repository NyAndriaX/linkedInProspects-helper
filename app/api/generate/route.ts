import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { getGroqClient, GROQ_MODEL, buildPostGenerationPrompt, parseGeneratedPosts, ProfileData, GenerationOptions } from "@/lib/groq";

interface GenerateRequest {
  count: number;
  topic?: string;
  toneOverride?: string;
  style?: string;
  preview?: boolean;
  includeImage?: boolean;
  realisticImage?: boolean;
  includeContactCta?: boolean;
}

interface ContactData {
  phone?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  linkedInProfileUrl?: string | null;
}

function hasAnyContact(contact: ContactData): boolean {
  return Boolean(
    contact.phone?.trim() ||
      contact.githubUrl?.trim() ||
      contact.portfolioUrl?.trim() ||
      contact.linkedInProfileUrl?.trim()
  );
}

function buildContactCta(contact: ContactData, language: "fr" | "en"): string {
  const parts: string[] = [];

  if (contact.phone?.trim()) {
    parts.push(
      language === "fr"
        ? `WhatsApp: ${contact.phone.trim()}`
        : `WhatsApp: ${contact.phone.trim()}`
    );
  }
  if (contact.portfolioUrl?.trim()) {
    parts.push(
      language === "fr"
        ? `portfolio: ${contact.portfolioUrl.trim()}`
        : `portfolio: ${contact.portfolioUrl.trim()}`
    );
  }
  if (contact.githubUrl?.trim()) {
    parts.push(`GitHub: ${contact.githubUrl.trim()}`);
  }
  if (contact.linkedInProfileUrl?.trim()) {
    parts.push(`LinkedIn: ${contact.linkedInProfileUrl.trim()}`);
  }

  if (parts.length === 0) return "";

  const intro =
    language === "fr"
      ? "📩 Si vous souhaitez collaborer avec moi, contactez-moi:"
      : "📩 If you would like to collaborate with me, contact me:";
  return `${intro} ${parts.join(" | ")}`;
}

/**
 * Common stop words to strip from search queries (French + English)
 */
const STOP_WORDS = new Set([
  // French
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "est", "que",
  "qui", "dans", "pour", "pas", "sur", "ce", "il", "ne", "se", "son", "sa",
  "au", "aux", "avec", "par", "mon", "ma", "mes", "j", "d", "l", "n", "s",
  "nous", "vous", "leur", "leurs", "jai", "cest", "sont", "être", "avoir",
  "comment", "pourquoi", "quand", "votre", "cette", "ces", "tout", "plus",
  // English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "is", "it", "my", "your", "i", "we", "you", "how", "what", "why", "when",
  "from", "with", "that", "this", "was", "are", "were", "been", "have", "has",
  "things", "learned", "about",
]);

/**
 * Extract short, meaningful keywords from a title for Unsplash search.
 * Removes stop words and special characters, keeps 2-4 meaningful words.
 */
function extractSearchKeywords(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/['']/g, " ")           // Smart quotes → spaces
    .replace(/[^a-zà-ÿ0-9\s]/g, "") // Remove punctuation
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Keep at most 3 meaningful words for a focused query
  return words.slice(0, 3).join(" ");
}

/**
 * Fetch a relevant image from Unsplash, with fallback queries.
 * Tries the primary query first, then each fallback in order.
 */
async function fetchUnsplashImage(
  queries: string[],
  pickIndex = 0
): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("[Unsplash] No UNSPLASH_ACCESS_KEY configured, skipping image fetch");
    return null;
  }

  for (const query of queries) {
    if (!query.trim()) continue;

    try {
      console.log(`[Unsplash] Searching: "${query}" (pickIndex: ${pickIndex})`);

      const response = await fetch(
        `https://api.unsplash.com/search/photos?` +
        `query=${encodeURIComponent(query)}&per_page=10&page=1&orientation=landscape` +
        `&client_id=${accessKey}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!response.ok) {
        console.warn(`[Unsplash] API returned ${response.status} for query "${query}"`);
        continue;
      }

      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        console.log(`[Unsplash] No results for "${query}", trying next fallback…`);
        continue;
      }

      // Pick a different image for each post to avoid duplicates
      const picked = results[pickIndex % results.length];
      const imageUrl = picked?.urls?.regular || null;

      if (imageUrl) {
        console.log(`[Unsplash] Found image for "${query}" (picked ${pickIndex % results.length}/${results.length})`);
        return imageUrl;
      }
    } catch (error) {
      console.error(`[Unsplash] Error for "${query}":`, error instanceof Error ? error.message : error);
    }
  }

  console.warn("[Unsplash] All queries exhausted, no image found");
  return null;
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
    const {
      count = 1,
      topic,
      toneOverride,
      style,
      preview = false,
      includeImage = false,
      realisticImage = true,
      includeContactCta = false,
    }: GenerateRequest = await request.json();

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
        phone: true,
        githubUrl: true,
        portfolioUrl: true,
        linkedInProfileUrl: true,
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
      phone: user.phone || undefined,
      githubUrl: user.githubUrl || undefined,
      portfolioUrl: user.portfolioUrl || undefined,
      linkedInProfileUrl: user.linkedInProfileUrl || undefined,
    };

    // Build generation options from request
    const generationOptions: GenerationOptions = {};
    if (topic) generationOptions.topic = topic;
    if (toneOverride) generationOptions.toneOverride = toneOverride;
    if (style) generationOptions.style = style;
    generationOptions.includeContactCta = includeContactCta;

    const prompt = buildPostGenerationPrompt(profile, count, existingTitles, generationOptions);

    // Call Groq API
    const completion = await getGroqClient().chat.completions.create({
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

    const contactData: ContactData = {
      phone: user.phone,
      githubUrl: user.githubUrl,
      portfolioUrl: user.portfolioUrl,
      linkedInProfileUrl: user.linkedInProfileUrl,
    };

    const shouldAppendContactCta = includeContactCta && hasAnyContact(contactData);

    const postsWithContact = generatedPosts.map((post) => ({
      ...post,
      content: shouldAppendContactCta
        ? `${post.content}\n\n${buildContactCta(
            contactData,
            user.preferredLanguage === "en" ? "en" : "fr"
          )}`
        : post.content,
    }));

    // Fetch Unsplash images if requested (one per post, with smart keyword extraction)
    let postsWithImages = postsWithContact.map((post) => ({
      ...post,
      imageUrl: null as string | null,
    }));

    console.log("[Generate] includeImage:", includeImage, "| posts count:", generatedPosts.length);

    if (includeImage) {
      // Build fallback query chain from user profile context
      const industryKeyword = user.industry || "";
      const topicKeyword = topic || "";

      const imagePromises = postsWithContact.map((post, index) => {
        // Build a cascade of queries from most specific to most generic:
        // 1. Keywords extracted from the post title
        // 2. The user-provided topic (if any)
        // 3. The user's industry
        // 4. A generic fallback
        const titleKeywords = extractSearchKeywords(post.title || "");
        const realismSuffix = realisticImage ? " realistic photo" : "";
        const queries = [
          `${titleKeywords}${realismSuffix}`.trim(),
          `${topicKeyword}${realismSuffix}`.trim(),
          `${industryKeyword}${realismSuffix}`.trim(),
          realisticImage
            ? "professional business workplace realistic photo"
            : "professional business technology",
        ].filter(Boolean);

        return fetchUnsplashImage(queries, index);
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
