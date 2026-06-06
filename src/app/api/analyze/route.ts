import { NextRequest, NextResponse } from "next/server";
import {
  PathfinderProfileSchema,
  buildAnalysisCorpus,
  extractUserMessages,
  fallbackProfile,
  normalizeConversationPayload,
} from "@/lib/pathfinder";

export const runtime = "nodejs";
export const maxDuration = 60;

const profileJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "archetype",
    "summary",
    "strengths",
    "unfinishedBusiness",
    "destinyThreads",
    "reflections",
    "quests",
    "companion",
  ],
  properties: {
    archetype: { type: "string" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    unfinishedBusiness: { type: "array", items: { type: "string" } },
    destinyThreads: { type: "array", items: { type: "string" } },
    reflections: { type: "array", items: { type: "string" } },
    quests: { type: "array", items: { type: "string" } },
    companion: {
      type: "object",
      additionalProperties: false,
      required: ["baseType", "evolutionItems"],
      properties: {
        baseType: { type: "string" },
        evolutionItems: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const conversations = normalizeConversationPayload(body.conversations ?? body);
    const messages = extractUserMessages(conversations);
    const { corpus, stats } = buildAnalysisCorpus(messages, conversations.length);

    if (!messages.length) {
      return NextResponse.json(
        { error: "No user messages found in the uploaded export." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        profile: fallbackProfile(messages),
        stats,
        source: "mock",
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are Pathfinder, an uplifting and playful AI cheerleader. Analyze ChatGPT user-message history and return only valid JSON. Make insights specific, warm, kind, and action-oriented. Celebrate strengths, frame open loops gently, and keep the tone cute and motivating — never combat-themed, never boss-battle flavored, and never diagnostic.",
          },
          {
            role: "user",
            content: `Create an encouraging personal dashboard profile from these ChatGPT user messages.\n\nRules:\n- Output concise strings; no markdown.\n- Quests must be real-world, doable in 1-7 days, and aligned with recurring interests.\n- Unfinished business should feel like friendly next chapters, not criticism.\n- Reflections should feel like delightful discoveries the user can revisit.\n- Companion should be cute, symbolic, and tied to small wins.\n- Avoid fantasy combat language, bosses, dragons, or alternate-life regret framing.\n\nMessages:\n${corpus}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pathfinder_profile",
            schema: profileJsonSchema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        {
          error: "OpenAI analysis failed.",
          details,
          profile: fallbackProfile(messages),
          stats,
          source: "mock-after-error",
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    const text = extractResponseText(data);
    const profile = PathfinderProfileSchema.parse(JSON.parse(text));

    return NextResponse.json({ profile, stats, source: "openai" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown analysis error.",
      },
      { status: 500 },
    );
  }
}

function extractResponseText(data: unknown) {
  if (!data || typeof data !== "object") {
    throw new Error("Malformed OpenAI response.");
  }

  const maybeText = data as { output_text?: unknown; output?: unknown };
  if (typeof maybeText.output_text === "string") {
    return maybeText.output_text;
  }

  if (Array.isArray(maybeText.output)) {
    for (const item of maybeText.output) {
      if (!item || typeof item !== "object" || !("content" in item)) {
        continue;
      }

      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          if (typeof text === "string") {
            return text;
          }
        }
      }
    }
  }

  throw new Error("OpenAI response did not include text output.");
}
