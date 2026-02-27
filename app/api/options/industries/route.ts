import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";

type CacheEntry = { data: string[]; expiresAt: number };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const industryCache = new Map<string, CacheEntry>();

function parseStringArray(content: string): string[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchAiIndustries(language: "fr" | "en"): Promise<string[]> {
  const prompt =
    language === "fr"
      ? `Retourne uniquement un tableau JSON (array) de 20 secteurs d'activité professionnels courants pour LinkedIn.
Exemples de format: ["Technologie / IT","Finance / Banque"].
Règles:
- seulement un array JSON de strings
- labels courts, clairs, sans doublons
- langue française`
      : `Return only a JSON array of 20 common professional LinkedIn industries.
Example format: ["Technology / IT","Finance / Banking"].
Rules:
- output must be a JSON array of strings only
- short, clear labels, no duplicates
- English language`;

  const completion = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: "You return valid JSON arrays only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return parseStringArray(completion.choices[0]?.message?.content || "");
}

export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredLanguage: true },
    });
    const language: "fr" | "en" = user?.preferredLanguage === "en" ? "en" : "fr";
    const cacheKey = language;

    const cached = industryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ApiResponse.success({ options: cached.data });
    }

    // Base options from existing user data (real platform usage)
    const dbIndustries = await prisma.user.findMany({
      where: { industry: { not: null } },
      select: { industry: true },
      take: 200,
    });
    const fromDb = Array.from(
      new Set(
        dbIndustries
          .map((entry) => entry.industry?.trim() || "")
          .filter(Boolean)
      )
    );

    // Enrich with AI-generated list for completeness
    const fromAi = await fetchAiIndustries(language);

    const merged = Array.from(new Set([...fromDb, ...fromAi])).slice(0, 30);
    if (merged.length === 0) {
      return ApiResponse.error("Failed to build industries list");
    }

    industryCache.set(cacheKey, {
      data: merged,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return ApiResponse.success({ options: merged });
  } catch (error) {
    console.error("Error fetching industries options:", error);
    return ApiResponse.error("Failed to fetch industries options");
  }
}
