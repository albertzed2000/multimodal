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
    "alternateLives",
    "strengths",
    "unfinishedBusiness",
    "dragons",
    "destinyThreads",
    "reflections",
    "quests",
    "companion",
  ],
  properties: {
    archetype: { type: "string" },
    summary: { type: "string" },
    alternateLives: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    unfinishedBusiness: { type: "array", items: { type: "string" } },
    dragons: { type: "array", items: { type: "string" } },
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
              "You are Pathfinder, a perceptive but grounded AI life coach. Analyze ChatGPT user-message history and return only valid JSON. Make insights specific, meaningful, kind, and action-oriented. Avoid therapy, diagnosis, and generic personality-test language.",
          },
          {
            role: "user",
            content: `Create a playable life-quest profile from these ChatGPT user messages.\n\nRules:\n- Output concise strings; no markdown.\n- Quests must be real-world, doable in 1-7 days, and aligned with recurring interests.\n- Dragons are obstacles or avoidance patterns, phrased with game flavor but practical meaning.\n- Reflections should feel like world nodes the user can discover.\n- Companion should be symbolic and evolve through quest completion.\n\nMessages:\n${corpus}`,
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
