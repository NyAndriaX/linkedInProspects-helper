import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";

type CacheEntry = { data: string[]; expiresAt: number };
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const specialtiesCache = new Map<string, CacheEntry>();

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

async function fetchAiSpecialties(params: {
  language: "fr" | "en";
  industry: string;
}): Promise<string[]> {
  const prompt =
    params.language === "fr"
      ? `Retourne uniquement un tableau JSON de 15 spécialités professionnelles pertinentes pour le secteur "${params.industry}".
Format attendu: ["React","DevOps","Cloud Architecture"].
Règles:
- seulement un array JSON de strings
- spécialités courtes et concrètes
- sans doublons
- en français`
      : `Return only a JSON array of 15 relevant professional specialties for the "${params.industry}" industry.
Expected format: ["React","DevOps","Cloud Architecture"].
Rules:
- JSON array of strings only
- short concrete specialties
- no duplicates
- in English`;

  const completion = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: "Return valid JSON arrays only." },
      { role: "user", content: prompt },
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredLanguage: true, industry: true },
    });

    const language: "fr" | "en" = user?.preferredLanguage === "en" ? "en" : "fr";
    const industry = industryFromQuery || user?.industry || "";
    if (!industry.trim()) {
      return ApiResponse.success({ options: [] });
    }

    const cacheKey = `${language}:${industry.toLowerCase()}`;
    const cached = specialtiesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ApiResponse.success({ options: cached.data });
    }

    const dbUsers = (await prisma.user.findMany({
      where: {
        industry: industry,
      },
      select: { specialties: true, expertise: true } as unknown as never,
      take: 250,
    })) as Array<{ specialties?: string[]; expertise?: string[] }>;

    const dbOptions = Array.from(
      new Set(
        dbUsers
          .flatMap((entry) => [...(entry.specialties || []), ...(entry.expertise || [])])
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    const aiOptions = await fetchAiSpecialties({ language, industry });
    const merged = Array.from(new Set([...dbOptions, ...aiOptions])).slice(0, 30);

    specialtiesCache.set(cacheKey, {
      data: merged,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return ApiResponse.success({ options: merged });
  } catch (error) {
    console.error("Error fetching specialties options:", error);
    return ApiResponse.error("Failed to fetch specialties options");
  }
}
