import { NextRequest, NextResponse } from "next/server";
import {
  ConversationChunkSummary,
  ConversationChunkSummarySchema,
  PathfinderProfileSchema,
  buildChunkCorpus,
  buildConversationChunks,
  buildParseStats,
  extractUserMessages,
  fallbackProfile,
  normalizeConversationPayload,
} from "@/lib/pathfinder";

export const runtime = "nodejs";
export const maxDuration = 300;

type JsonSchema = Record<string, unknown>;

const chunkSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "label",
    "timeRange",
    "recurringInterests",
    "activeProjects",
    "goalsAndAspirations",
    "strengths",
    "openLoops",
    "emotionalTone",
    "questSeeds",
    "memorableSignals",
  ],
  properties: {
    label: { type: "string", description: "Short label for this conversation period." },
    timeRange: { type: "string", description: "Approximate date range for this chunk." },
    recurringInterests: { type: "array", items: { type: "string" } },
    activeProjects: { type: "array", items: { type: "string" } },
    goalsAndAspirations: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    openLoops: { type: "array", items: { type: "string" } },
    emotionalTone: { type: "array", items: { type: "string" } },
    questSeeds: { type: "array", items: { type: "string" } },
    memorableSignals: { type: "array", items: { type: "string" } },
  },
} satisfies JsonSchema;

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
} satisfies JsonSchema;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const conversations = normalizeConversationPayload(body.conversations ?? body);
    const messages = extractUserMessages(conversations);
    const chunks = buildConversationChunks(messages);
    const stats = buildParseStats(conversations.length, messages, chunks);

    if (!messages.length) {
      return NextResponse.json(
        { error: "No user messages found in the uploaded export." },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        profile: fallbackProfile(messages),
        stats,
        source: "mock",
      });
    }

    try {
      const summaries = await runWithConcurrency(chunks, 3, async (chunk) => {
        const summary = await summarizeChunkWithGemini(
          `${chunk.label} (${chunk.timeRange})`,
          buildChunkCorpus(chunk),
        );
        return {
          ...summary,
          label: summary.label || chunk.label,
          timeRange: summary.timeRange || chunk.timeRange,
        };
      });
      const profile = await synthesizeProfileWithGemini(summaries);

      return NextResponse.json({ profile, stats, source: "gemini" });
    } catch (error) {
      return NextResponse.json(
        {
          error: "Gemini analysis failed.",
          details: error instanceof Error ? error.message : "Unknown Gemini error.",
          profile: fallbackProfile(messages),
          stats,
          source: "mock-after-error",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown analysis error.",
      },
      { status: 500 },
    );
  }
}

async function summarizeChunkWithGemini(label: string, corpus: string) {
  const text = await generateGeminiJson({
    schema: chunkSummaryJsonSchema,
    prompt: `Summarize this chronological slice of a person's ChatGPT user-message history.

Chunk: ${label}

Rules:
- Return only the structured JSON object.
- Extract durable signal, not one-off trivia.
- Be specific about projects, repeated questions, skills, and goals.
- Keep every array to 3-7 concise strings.
- Tone should be warm, grounded, and useful.
- Avoid diagnosis, therapy claims, fantasy combat language, bosses, dragons, and regret framing.

Messages:
${corpus}`,
  });

  return ConversationChunkSummarySchema.parse(parseJsonText(text));
}

async function synthesizeProfileWithGemini(summaries: ConversationChunkSummary[]) {
  const text = await generateGeminiJson({
    schema: profileJsonSchema,
    prompt: `Create the final Pathfinder profile from these chunk summaries.

Product direction:
- Pathfinder is a gamified AI life coach, but this version should feel cute, uplifting, and practical.
- The output powers a dashboard with an archetype card, companion card, highlights, strengths, destiny threads, gentle nudges, and small-win quests.
- Keep the profile personal and specific to the recurring signals in the summaries.

Rules:
- Return only the structured JSON object.
- Quests must be real-world actions doable in 1-7 days.
- Strengths should be concrete behaviors, not generic compliments.
- Unfinished business should feel like friendly next chapters, not criticism.
- Reflections should be delightful discoveries the user can revisit.
- Companion should be cute, symbolic, and tied to small wins.
- Avoid fantasy combat language, bosses, dragons, alternate-life regret framing, diagnosis, and therapy-speak.

Chunk summaries:
${JSON.stringify(summaries, null, 2)}`,
  });

  return PathfinderProfileSchema.parse(parseJsonText(text));
}

async function generateGeminiJson({
  schema,
  prompt,
}: {
  schema: JsonSchema;
  prompt: string;
}) {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseFormat: {
            text: {
              mimeType: "application/json",
              schema,
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed with ${response.status}: ${details}`);
  }

  const data = await response.json();
  return extractGeminiText(data);
}

function extractGeminiText(data: unknown) {
  if (!data || typeof data !== "object" || !("candidates" in data)) {
    throw new Error("Malformed Gemini response.");
  }

  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    throw new Error("Gemini response did not include candidates.");
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || !("content" in candidate)) {
      continue;
    }

    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object" || !("parts" in content)) {
      continue;
    }

    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    const text = parts
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? (part as { text?: unknown }).text
          : "",
      )
      .filter((part): part is string => typeof part === "string")
      .join("");

    if (text.trim()) {
      return text;
    }
  }

  throw new Error("Gemini response did not include text output.");
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(withoutFence);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );

  return results;
}
