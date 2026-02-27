import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import {
  getGroqClient,
  GROQ_MODEL,
  buildPostGenerationPrompt,
  parseGeneratedPosts,
  ProfileData,
  GenerationOptions,
} from "@/lib/groq";

interface GenerateRequest {
  count: number;
  topic?: string;
  topicSource?: "auto" | "common";
  selectedTheme?: string;
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

interface ThemeBrief {
  trends: string[];
  tools: string[];
  angles: string[];
}

type GenerationOptionsWithThemeBrief = GenerationOptions & {
  commonThemeBrief?: ThemeBrief;
};

function countLines(content: string): number {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function includesAnyKeyword(content: string, keywords: string[]): boolean {
  const text = content.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function isPostSpecificEnough(params: {
  content: string;
  selectedTheme?: string;
  themeBrief?: ThemeBrief;
}): boolean {
  const { content, selectedTheme, themeBrief } = params;
  const lines = countLines(content);
  const hasTargetedQuestion = content.includes("?") && !/qu[' ]en pensez-vous/i.test(content);
  const hasThemeSignal = selectedTheme
    ? includesAnyKeyword(content, [selectedTheme])
    : true;
  const hasConcreteReference = themeBrief
    ? includesAnyKeyword(content, [...themeBrief.tools, ...themeBrief.trends])
    : true;
  const text = content.toLowerCase();
  const hasIncoherentMix =
    text.includes("create react app") &&
    (text.includes("next.js") || text.includes("nextjs"));

  return (
    lines >= 8 &&
    lines <= 16 &&
    hasTargetedQuestion &&
    hasThemeSignal &&
    hasConcreteReference &&
    !hasIncoherentMix
  );
}

async function rewritePostForSpecificity(params: {
  post: { title: string; content: string; hashtags: string[] };
  selectedTheme: string;
  language: "fr" | "en";
  themeBrief?: ThemeBrief;
}): Promise<{ title: string; content: string; hashtags: string[] }> {
  const brief = params.themeBrief
    ? `Trends: ${params.themeBrief.trends.join(", ")}
Tools: ${params.themeBrief.tools.join(", ")}
Angles: ${params.themeBrief.angles.join(", ")}`
    : "No additional brief";

  const prompt =
    params.language === "fr"
      ? `Réécris ce post LinkedIn pour qu'il soit plus concret et plus expert sur "${params.selectedTheme}".
Post actuel:
Titre: ${params.post.title}
Contenu: ${params.post.content}
Hashtags: ${params.post.hashtags.join(", ")}

Contexte:
${brief}

Règles strictes:
- 8 à 15 lignes
- inclure au moins 2 références concrètes (outils, frameworks, updates)
- inclure une recommandation actionnable claire
- finir avec une question ciblée (pas générique)
- structure claire: Contexte -> Action -> Résultat
- si un chiffre/% est mentionné, ajouter baseline/scope/période; sinon ne pas inventer de chiffre
- garder la cohérence technique (pas de mélange incohérent d'outils dans une même affirmation)
- première ligne = hook fort (max 12 mots)
- paragraphes très courts (1-2 lignes), avec sauts de ligne lisibles
- inclure une mini liste de 2 à 4 puces ("- ")
- privilégier les nouveautés récentes (features, hooks, updates, articles)
- éviter les versions obsolètes si des versions plus récentes existent
- si la version exacte est incertaine, ne pas inventer de numéro de version
- ne jamais inventer de nom de hook/API
- ton pro, moderne, accessible
- retourner uniquement un JSON objet:
{"title":"...","content":"...","hashtags":["#...","#...","#...","#...","#..."]}`
      : `Rewrite this LinkedIn post to be more specific and expert-level on "${params.selectedTheme}".
Current post:
Title: ${params.post.title}
Content: ${params.post.content}
Hashtags: ${params.post.hashtags.join(", ")}

Context:
${brief}

Strict rules:
- 8 to 15 lines
- include at least 2 concrete references (tools, frameworks, updates)
- include one clear actionable recommendation
- end with a targeted question (not generic)
- clear structure: Context -> Action -> Result
- if a number/% is used, include baseline/scope/timeframe; otherwise avoid invented numbers
- keep technical coherence (no incoherent tool mixing in one implementation claim)
- first line = strong hook (max 12 words)
- very short paragraphs (1-2 lines), with clear line breaks
- include one mini-list of 2 to 4 bullet points ("- ")
- prefer recent updates/features/articles in the ecosystem
- avoid outdated version references when newer releases exist
- if exact version is uncertain, avoid explicit version numbers
- never invent hook/API names
- professional, modern, accessible tone
- return only one JSON object:
{"title":"...","content":"...","hashtags":["#...","#...","#...","#...","#..."]}`;

  const completion = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: "Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  });

  const responseText = completion.choices[0]?.message?.content || "";
  try {
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (!objectMatch) return params.post;
    const parsed = JSON.parse(objectMatch[0]) as {
      title?: string;
      content?: string;
      hashtags?: string[];
    };
    return {
      title: parsed.title || params.post.title,
      content: parsed.content || params.post.content,
      hashtags: Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0
        ? parsed.hashtags
        : params.post.hashtags,
    };
  } catch {
    return params.post;
  }
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

function parseThemeBrief(content: string): ThemeBrief | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ThemeBrief>;

    const trends = Array.isArray(parsed.trends)
      ? parsed.trends.filter((item): item is string => typeof item === "string")
      : [];
    const tools = Array.isArray(parsed.tools)
      ? parsed.tools.filter((item): item is string => typeof item === "string")
      : [];
    const angles = Array.isArray(parsed.angles)
      ? parsed.angles.filter((item): item is string => typeof item === "string")
      : [];

    if (trends.length === 0 && tools.length === 0 && angles.length === 0) {
      return null;
    }
    return { trends, tools, angles };
  } catch {
    return null;
  }
}

async function buildThemeBrief(params: {
  selectedTheme: string;
  industry: string;
  specialties: string[];
  language: "fr" | "en";
}): Promise<ThemeBrief | null> {
  const specialtiesText = params.specialties.length
    ? params.specialties.join(", ")
    : "none specified";
  const prompt =
    params.language === "fr"
      ? `Crée un brief ultra concret pour un post LinkedIn sur la thématique "${params.selectedTheme}" dans le secteur "${params.industry}".
Spécialités du profil: ${specialtiesText}.
Retourne STRICTEMENT un objet JSON:
{
  "trends": ["...","...","..."],
  "tools": ["...","...","..."],
  "angles": ["...","...","..."]
}
Règles:
- trends: 3 tendances / nouveautés récentes et réalistes
- tools: 3 technologies/frameworks/outils concrets liés au thème
- angles: 3 angles de contenu utiles (comparaison, perf, sécurité, bonnes pratiques, retour d'expérience...)
- français, court, précis, sans blabla, sans markdown`
      : `Create a very concrete brief for a LinkedIn post on "${params.selectedTheme}" in the "${params.industry}" industry.
Profile specialties: ${specialtiesText}.
Return STRICTLY a JSON object:
{
  "trends": ["...","...","..."],
  "tools": ["...","...","..."],
  "angles": ["...","...","..."]
}
Rules:
- trends: 3 realistic recent trends/updates
- tools: 3 concrete technologies/frameworks/tools related to the theme
- angles: 3 practical content angles (comparison, performance, security, best practices, field feedback...)
- concise, no markdown`;

  const completion = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: "Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return parseThemeBrief(completion.choices[0]?.message?.content || "");
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
  pickIndex = 0,
  relevanceKeywords: string[] = [],
  strictTopicMatch = false
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

      const blockedWords = [
        "car",
        "cars",
        "vehicle",
        "automobile",
        "phone",
        "smartphone",
        "samsung",
      ];

      const lowerKeywords = relevanceKeywords
        .map((keyword) => keyword.toLowerCase())
        .filter(Boolean);

      const scored = results
        .map((item: { alt_description?: string; description?: string }) => {
          const text = `${item.alt_description || ""} ${item.description || ""}`.toLowerCase();
          const blocked = blockedWords.some((word) => text.includes(word));
          const keywordMatches = lowerKeywords.filter((keyword) => text.includes(keyword)).length;
          return { item, blocked, keywordMatches };
        })
        .filter((entry: { blocked: boolean }) => !entry.blocked)
        .sort((a: { keywordMatches: number }, b: { keywordMatches: number }) => b.keywordMatches - a.keywordMatches);

      const candidates =
        scored.length > 0
          ? scored.map((entry: { item: unknown }) => entry.item as { urls?: { regular?: string } })
          : results;

      if (strictTopicMatch && candidates.length === 0) {
        console.log(`[Unsplash] Strict mode rejected query "${query}" (no clean candidate)`);
        continue;
      }
      // Pick a different image for each post to avoid duplicates
      const picked = candidates[pickIndex % candidates.length];
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
      topicSource,
      selectedTheme,
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
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        jobTitle: true,
        company: true,
        industry: true,
        specialties: true,
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
      } as unknown as never,
    })) as
      | (Record<string, unknown> & {
          jobTitle?: string | null;
          company?: string | null;
          industry?: string | null;
          specialties?: string[];
          yearsOfExperience?: string | null;
          targetAudience?: string | null;
          targetIndustries?: string[];
          contentGoals?: string[];
          preferredTone?: string | null;
          preferredLanguage?: string | null;
          contentTopics?: string[];
          uniqueValue?: string | null;
          expertise?: string[];
          personalBrand?: string | null;
          phone?: string | null;
          githubUrl?: string | null;
          portfolioUrl?: string | null;
          linkedInProfileUrl?: string | null;
        })
      | null;

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
    const userSpecialties = Array.isArray(user.specialties)
      ? user.specialties
      : [];

    const profile: ProfileData = {
      jobTitle: user.jobTitle || undefined,
      company: user.company || undefined,
      industry: user.industry || undefined,
      specialties: userSpecialties,
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
    const generationOptions: GenerationOptionsWithThemeBrief = {};
    if (topic) generationOptions.topic = topic;
    if (topicSource) generationOptions.topicSource = topicSource;
    if (selectedTheme) generationOptions.selectedTheme = selectedTheme;
    if (topicSource === "common" && selectedTheme) {
      const language = user.preferredLanguage === "en" ? "en" : "fr";
      const themeBrief = await buildThemeBrief({
        selectedTheme,
        industry: user.industry || "Technology / IT",
        specialties: userSpecialties,
        language,
      });
      if (themeBrief) {
        generationOptions.commonThemeBrief = themeBrief;
      }
    }
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

    const language = user.preferredLanguage === "en" ? "en" : "fr";

    const postsWithContact = generatedPosts.map((post) => ({
      ...post,
      content: shouldAppendContactCta
        ? `${post.content}\n\n${buildContactCta(
            contactData,
            language
          )}`
        : post.content,
    }));

    let finalizedPosts = postsWithContact;

    // Quality enforcement for common-theme mode: rewrite weak posts.
    if (topicSource === "common" && selectedTheme) {
      finalizedPosts = await Promise.all(
        postsWithContact.map(async (post) => {
          if (
            isPostSpecificEnough({
              content: post.content,
              selectedTheme,
              themeBrief: generationOptions.commonThemeBrief,
            })
          ) {
            return post;
          }
          return rewritePostForSpecificity({
            post,
            selectedTheme,
            language,
            themeBrief: generationOptions.commonThemeBrief,
          });
        })
      );
    }

    const shouldRunQualityRewrite =
      finalizedPosts.length > 0 && Boolean(selectedTheme || topic);

    if (shouldRunQualityRewrite) {
      const qualityTheme = selectedTheme || String(topic || "").trim() || "technical topic";
      finalizedPosts = await Promise.all(
        finalizedPosts.map(async (post) => {
          if (
            isPostSpecificEnough({
              content: post.content,
              selectedTheme: qualityTheme,
              themeBrief: generationOptions.commonThemeBrief,
            })
          ) {
            return post;
          }
          return rewritePostForSpecificity({
            post,
            selectedTheme: qualityTheme,
            language,
            themeBrief: generationOptions.commonThemeBrief,
          });
        })
      );
    }

    // Fetch Unsplash images if requested (one per post, with smart keyword extraction)
    let postsWithImages = finalizedPosts.map((post) => ({
      ...post,
      imageUrl: null as string | null,
    }));

    console.log("[Generate] includeImage:", includeImage, "| posts count:", generatedPosts.length);

    if (includeImage) {
      // Build fallback query chain from user profile context
      const industryKeyword = user.industry || "";
      const topicKeyword = topic || "";

      const themeKeyword = selectedTheme || "";
      const themeTools = generationOptions.commonThemeBrief?.tools || [];
      const strictImageMatching = topicSource === "common" && Boolean(themeKeyword);

      const imagePromises = finalizedPosts.map((post, index) => {
        // Build a cascade of queries from most specific to most generic:
        // 1. Keywords extracted from the post title
        // 2. The user-provided topic (if any)
        // 3. The user's industry
        // 4. A generic fallback
        const titleKeywords = extractSearchKeywords(post.title || "");
        const realismSuffix = realisticImage ? " realistic photo" : "";
        const queries = [
          `${themeKeyword}${realismSuffix}`.trim(),
          ...themeTools.slice(0, 2).map((tool) => `${tool}${realismSuffix}`.trim()),
          themeKeyword
            ? `software developer ${themeKeyword} coding ${realismSuffix}`.trim()
            : "",
          `${titleKeywords}${realismSuffix}`.trim(),
          `${topicKeyword}${realismSuffix}`.trim(),
          `${industryKeyword}${realismSuffix}`.trim(),
          ...(strictImageMatching
            ? []
            : [
                realisticImage
                  ? "professional business workplace realistic photo"
                  : "professional business technology",
              ]),
        ].filter(Boolean);

        return fetchUnsplashImage(
          queries,
          index,
          [themeKeyword, ...themeTools, titleKeywords, topicKeyword, industryKeyword],
          strictImageMatching
        );
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
