import { NextRequest } from "next/server";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";

interface AssistEditRequest {
  title?: string;
  content?: string;
  instruction?: string;
}

function extractEditedContent(rawResponse: string): string | null {
  try {
    const match = rawResponse.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { content?: string };
    if (typeof parsed.content !== "string") return null;
    const normalized = parsed.content.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

// POST /api/posts/assist-edit - AI assist to rewrite post content with user instruction
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const { title = "", content, instruction }: AssistEditRequest =
      await request.json();

    const normalizedContent = content?.trim() || "";
    const normalizedInstruction = instruction?.trim() || "";

    if (!normalizedContent) {
      return ApiResponse.badRequest("Post content is required");
    }
    if (!normalizedInstruction) {
      return ApiResponse.badRequest("Instruction is required");
    }

    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferredLanguage: true,
        githubUrl: true,
        portfolioUrl: true,
        linkedInProfileUrl: true,
      },
    })) as {
      preferredLanguage?: string | null;
      githubUrl?: string | null;
      portfolioUrl?: string | null;
      linkedInProfileUrl?: string | null;
    } | null;

    const language = user?.preferredLanguage === "en" ? "English" : "French";
    const profileLinks = [
      user?.portfolioUrl?.trim()
        ? `Portfolio: ${user.portfolioUrl.trim()}`
        : null,
      user?.githubUrl?.trim() ? `GitHub: ${user.githubUrl.trim()}` : null,
      user?.linkedInProfileUrl?.trim()
        ? `LinkedIn: ${user.linkedInProfileUrl.trim()}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const prompt = `You are a senior LinkedIn writing assistant.
Language: ${language}

Task:
- Rewrite the post content by applying the user's instruction exactly.
- Keep the post's meaning and style unless the instruction asks for a change.
- Keep line breaks and LinkedIn readability.
- If the instruction asks to add a project URL, use a relevant URL from profile links when available.
- Do not invent fake URLs.
- Keep total content under 3000 characters.
- Return valid JSON only, in this format:
{"content":"..."}

Current title:
${title || "Untitled"}

Current content:
${normalizedContent}

User instruction:
${normalizedInstruction}

Available profile links:
${profileLinks || "No profile links available"}`;

    const completion = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1800,
    });

    const rawResponse = completion.choices[0]?.message?.content || "";
    const editedContent = extractEditedContent(rawResponse);

    if (!editedContent) {
      return ApiResponse.error("Failed to parse AI edit response", 502);
    }

    return ApiResponse.success({
      content: editedContent,
    });
  } catch (error) {
    console.error("Error assisting post edit:", error);
    return ApiResponse.error("Failed to edit post with AI");
  }
}
