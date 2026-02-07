import { NextRequest } from "next/server";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";
import { groq, GROQ_MODEL } from "@/lib/groq";

interface OutreachRequest {
  prospectName: string;
  prospectDetails: string;
  messageType: "connection" | "inmail" | "followup";
  myExpertise?: string;
  tone?: string;
}

const TYPE_CONFIG = {
  connection: {
    label: "LinkedIn Connection Request Note",
    maxChars: 300,
    instructions:
      "This is a connection request note. MUST be under 300 characters total. Be very concise and punchy.",
  },
  inmail: {
    label: "LinkedIn InMail / Direct Message",
    maxChars: 800,
    instructions:
      "This is a LinkedIn InMail. Can be more detailed. Also generate a compelling subject line. MUST be under 800 characters.",
  },
  followup: {
    label: "Follow-up Message",
    maxChars: 800,
    instructions:
      "This is a follow-up to a previous outreach. Reference the initial contact naturally. MUST be under 800 characters.",
  },
} as const;

const TONE_MAP: Record<string, string> = {
  pro: "Professional but warm — like a respected colleague, not a salesperson",
  friendly: "Friendly and casual — like messaging a friend of a friend",
  direct: "Direct and to-the-point — no fluff, straight to value proposition",
};

function buildOutreachPrompt(params: OutreachRequest): string {
  const config = TYPE_CONFIG[params.messageType] || TYPE_CONFIG.connection;
  const toneDesc = TONE_MAP[params.tone || "pro"] || TONE_MAP.pro;

  return `You are an expert LinkedIn outreach copywriter helping a freelance developer land clients.

## MESSAGE TYPE: ${config.label}
${config.instructions}

## TONE
${toneDesc}

## PROSPECT
- Name: ${params.prospectName}
- Details: ${params.prospectDetails}

## MY BACKGROUND
${params.myExpertise || "Freelance developer specializing in Next.js & React, based in Antananarivo, Madagascar"}

## RULES
1. **Hook**: Open with something specific to the prospect (their role, company, a recent post, industry trend)
2. **Value**: Clearly show what value I bring — be specific, not generic
3. **Human**: Sound like a real person. No corporate jargon, no "J'ai vu votre profil impressionnant"
4. **CTA**: End with a soft call-to-action ("On échange 10 min ?", "Ça vous dirait d'en discuter ?")
5. **No spam**: No excessive flattery, no pushy sales language
6. **Language**: Write entirely in French
7. **Length**: STRICTLY under ${config.maxChars} characters

## OUTPUT FORMAT
Return a JSON object with:
- "message": The full message text ready to paste into LinkedIn
- "suggestedSubject": ${params.messageType === "inmail" ? "A short compelling subject line (max 60 chars)" : "null"}

Example:
{
  "message": "Bonjour [Name],\\n\\n...",
  "suggestedSubject": ${params.messageType === "inmail" ? '"Subject here"' : "null"}
}

Generate the message now:`;
}

// POST /api/generate-outreach
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const body: OutreachRequest = await request.json();

    if (!body.prospectName?.trim() || !body.prospectDetails?.trim()) {
      return ApiResponse.badRequest(
        "Prospect name and details are required"
      );
    }

    const prompt = buildOutreachPrompt(body);

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert LinkedIn outreach copywriter. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return ApiResponse.error("No response from AI");

    // Parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const msg = (parsed.message || content).trim();
        return ApiResponse.success({
          message: msg,
          suggestedSubject: parsed.suggestedSubject || null,
          length: msg.length,
        });
      }
    } catch {
      // Fallback: return raw content
    }

    return ApiResponse.success({
      message: content.trim(),
      suggestedSubject: null,
      length: content.trim().length,
    });
  } catch (error) {
    console.error("Error generating outreach message:", error);
    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return ApiResponse.error(
          "Rate limit exceeded. Please try again later.",
          429
        );
      }
    }
    return ApiResponse.error("Failed to generate outreach message");
  }
}
