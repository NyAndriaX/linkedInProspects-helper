import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";

type CacheEntry = { data: string[]; expiresAt: number };
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const themeCache = new Map<string, CacheEntry>();

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

async function fetchAiThemes(params: {
  language: "fr" | "en";
  industry?: string;
  specialties?: string[];
}): Promise<string[]> {
  const industryLabel = params.industry?.trim() || "Technology / IT";
  const specialtiesLabel =
    params.specialties && params.specialties.length > 0
      ? params.specialties.join(", ")
      : "N/A";
  const prompt =
    params.language === "fr"
      ? `Retourne uniquement un tableau JSON de 12 thématiques actuelles, courantes et pertinentes pour LinkedIn, dans ce secteur: ${industryLabel}.
Spécialités du profil: ${specialtiesLabel}.
Exemples attendus pour IT: ["React","Node.js","DevOps","IA","Cloud"].
Règles:
- sortie strictement JSON array de strings
- thèmes courts et professionnels
- sans doublons
- en français`
      : `Return only a JSON array of 12 current, common and relevant LinkedIn themes for this industry: ${industryLabel}.
Profile specialties: ${specialtiesLabel}.
Expected examples for IT: ["React","Node.js","DevOps","AI","Cloud"].
Rules:
- output strictly as JSON array of strings
- short professional themes
- no duplicates
- in English`;

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
    max_tokens: 900,
  });

  return parseStringArray(completion.choices[0]?.message?.content || "");
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const industryFromQuery = request.nextUrl.searchParams.get("industry") || "";

    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredLanguage: true, industry: true, specialties: true } as any,
    })) as { preferredLanguage?: string | null; industry?: string | null; specialties?: string[] } | null;

    const language: "fr" | "en" = user?.preferredLanguage === "en" ? "en" : "fr";
    const industry = industryFromQuery || user?.industry || "";
    const specialties = user?.specialties || [];
    const cacheKey = `${language}:${industry.toLowerCase()}:${specialties
      .slice()
      .sort()
      .join("|")
      .toLowerCase()}`;

    const cached = themeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ApiResponse.success({ options: cached.data });
    }

    const options = await fetchAiThemes({ language, industry, specialties });
    if (options.length === 0) {
      return ApiResponse.error("Failed to build common themes list");
    }

    themeCache.set(cacheKey, {
      data: options,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return ApiResponse.success({ options });
  } catch (error) {
    console.error("Error fetching themes options:", error);
    return ApiResponse.error("Failed to fetch themes options");
  }
}
