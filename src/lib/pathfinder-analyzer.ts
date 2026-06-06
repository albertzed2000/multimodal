import {
  ConversationChunk,
  ConversationChunkSummary,
  ConversationChunkSummarySchema,
  PathfinderProfile,
  PathfinderProfileSchema,
  PathfinderDestination,
  PathfinderTask,
  ParsedMessage,
  buildChunkCorpus,
  buildFallbackWorld,
  fallbackProfile,
} from "@/lib/pathfinder";

type JsonSchema = Record<string, unknown>;

const chunkSummaryConcurrency = 5;

export type AnalysisSource = "gemini" | "mock" | "mock-after-error";

export type AnalyzeProgress = {
  phase: "parsing" | "summarizing" | "synthesizing" | "persisting" | "complete";
  message: string;
  completedChunks: number;
  totalChunks: number;
};

export type AnalysisResult = {
  profile: PathfinderProfile;
  source: AnalysisSource;
};

const taskJsonSchema = {
  type: "object",
  required: ["id", "title", "description", "category", "companionReward"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string", enum: ["task", "project", "exploration", "discovery"] },
    companionReward: { type: "string" },
  },
} satisfies JsonSchema;

const destinationJsonSchema = {
  type: "object",
  required: [
    "id",
    "title",
    "type",
    "iconHint",
    "emoji",
    "observation",
    "suggestedTasks",
    "backupTasks",
  ],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    type: { type: "string", enum: ["interest", "discovery"] },
    iconHint: { type: "string" },
    emoji: { type: "string" },
    observation: { type: "string" },
    suggestedTasks: { type: "array", items: taskJsonSchema },
    backupTasks: { type: "array", items: taskJsonSchema },
  },
} satisfies JsonSchema;

const chunkSummaryJsonSchema = {
  type: "object",
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
  required: [
    "archetype",
    "summary",
    "strengths",
    "unfinishedBusiness",
    "destinyThreads",
    "reflections",
    "quests",
    "companion",
    "world",
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
      required: ["baseType", "evolutionItems"],
      properties: {
        baseType: { type: "string" },
        evolutionItems: { type: "array", items: { type: "string" } },
      },
    },
    world: {
      type: "object",
      required: ["destinations", "mainTasks", "completedTasks", "completionNotes"],
      properties: {
        destinations: { type: "array", items: destinationJsonSchema },
        mainTasks: { type: "array", items: taskJsonSchema },
        completedTasks: { type: "array", items: taskJsonSchema },
        completionNotes: { type: "array", items: { type: "string" } },
      },
    },
  },
} satisfies JsonSchema;

export async function analyzePathfinderProfile({
  messages,
  chunks,
  onProgress,
}: {
  messages: ParsedMessage[];
  chunks: ConversationChunk[];
  onProgress?: (progress: AnalyzeProgress) => Promise<void> | void;
}): Promise<AnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    await onProgress?.({
      phase: "complete",
      message: "Generated mock profile because GEMINI_API_KEY is not set.",
      completedChunks: chunks.length,
      totalChunks: chunks.length,
    });
    return {
      profile: fallbackProfile(messages),
      source: "mock",
    };
  }

  await onProgress?.({
    phase: "summarizing",
    message: `Summarizing 0 of ${chunks.length} chunks.`,
    completedChunks: 0,
    totalChunks: chunks.length,
  });

  let completedChunks = 0;
  const summaries = await runWithConcurrency(chunks, chunkSummaryConcurrency, async (chunk) => {
    const summary = await summarizeChunkWithGemini(
      `${chunk.label} (${chunk.timeRange})`,
      buildChunkCorpus(chunk),
    );
    completedChunks += 1;
    await onProgress?.({
      phase: "summarizing",
      message: `Summarized ${completedChunks} of ${chunks.length} chunks.`,
      completedChunks,
      totalChunks: chunks.length,
    });
    return {
      ...summary,
      label: summary.label || chunk.label,
      timeRange: summary.timeRange || chunk.timeRange,
    };
  });

  await onProgress?.({
    phase: "synthesizing",
    message: "Synthesizing the final Pathfinder profile.",
    completedChunks,
    totalChunks: chunks.length,
  });

  const profile = ensureWorld(await synthesizeProfileWithGemini(summaries));
  await onProgress?.({
    phase: "complete",
    message: "Profile analysis complete.",
    completedChunks,
    totalChunks: chunks.length,
  });

  return { profile, source: "gemini" };
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
- The globe is the primary UI. It needs exactly 4 destinations: the user's top 3 recurring interests plus a fourth "Discovery Pond" for miscellaneous interests, tasks, projects, and goals.
- Keep the profile personal and specific to the recurring signals in the summaries.

Rules:
- Return only the structured JSON object.
- Use casual, simple wording. No jargon. No mystical labels.
- Quests must be real-world actions doable in 1-7 days.
- Strengths should be concrete behaviors, not generic compliments.
- Unfinished business should feel like friendly next chapters, not criticism.
- Reflections should be delightful discoveries the user can revisit.
- Companion should be cute, symbolic, and tied to small wins.
- world.destinations must contain exactly 4 items.
- The first 3 destinations must have type "interest" and represent the user's top 3 interests from the summaries.
- Destination titles must be plain and specific, 2-4 words, preferably gerund phrases like "starting a restaurant", "building AI tools", "fitness habits", or "writing online".
- Do not use abstract nouns or weird labels like "venture", "forge", "cove", "harbor", "island", "realm", "quest", "innovation", or fantasy names.
- The fourth destination must have id "discovery", title "Discovery Pond", and type "discovery".
- Each destination must include an iconHint, a matching single emoji, a profile-specific observation, exactly 3 suggestedTasks, and at least 5 backupTasks.
- Observations should be 1 short sentence under 22 words.
- Task titles should be direct, 2-6 words.
- Task descriptions should be casual and under 14 words.
- Task IDs must be stable lowercase slugs prefixed with the destination id, for example "interest-1-ship-demo".
- mainTasks and completedTasks should start empty for a newly generated profile.
- Avoid fantasy combat language, bosses, dragons, alternate-life regret framing, diagnosis, and therapy-speak.

Chunk summaries:
${JSON.stringify(summaries, null, 2)}`,
  });

  return PathfinderProfileSchema.parse(parseJsonText(text));
}

export async function generateMoreTasksForDestination({
  profile,
  destinationId,
  count = 5,
}: {
  profile: PathfinderProfile;
  destinationId: string;
  count?: number;
}) {
  const world = profile.world ?? buildFallbackWorld(profile);
  const destination = world.destinations.find((item) => item.id === destinationId);
  if (!destination) {
    throw new Error("Destination not found.");
  }

  if (!process.env.GEMINI_API_KEY) {
    return buildFallbackWorld(profile).destinations.find((item) => item.id === destinationId)?.backupTasks ?? [];
  }

  const text = await generateGeminiJson({
    schema: {
      type: "object",
      required: ["tasks"],
      properties: {
        tasks: { type: "array", items: taskJsonSchema },
      },
    },
    prompt: `Generate ${count} replacement Pathfinder tasks for this destination.

Destination:
${JSON.stringify(destination, null, 2)}

Profile context:
${JSON.stringify({
  archetype: profile.archetype,
  summary: profile.summary,
  strengths: profile.strengths,
  completedTasks: world.completedTasks,
}, null, 2)}

Rules:
- Return only JSON.
- Tasks must be doable in 1-7 days.
- Task titles should be direct, 2-6 words.
- Task descriptions should be casual and under 14 words.
- Use IDs prefixed with "${destination.id}-".
- Do not repeat existing suggested, backup, main, or completed tasks.
- Keep them practical, specific, and plainspoken.`,
  });

  const parsed = parseJsonText(text) as { tasks?: PathfinderTask[] };
  return Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, count) : [];
}

export async function regenerateProfileAfterCompletion({
  profile,
  completedTask,
}: {
  profile: PathfinderProfile;
  completedTask: PathfinderTask;
}) {
  const world = profile.world ?? buildFallbackWorld(profile);

  if (!process.env.GEMINI_API_KEY) {
    return ensureWorld({
      ...profile,
      summary: `${profile.summary} You recently completed "${completedTask.title}", adding fresh momentum to your path.`,
      world: {
        ...world,
        completedTasks: dedupeTasks([...world.completedTasks, completedTask]),
        completionNotes: [
          ...world.completionNotes,
          `Completed "${completedTask.title}" and gained ${completedTask.companionReward}`,
        ],
      },
    });
  }

  const text = await generateGeminiJson({
    schema: profileJsonSchema,
    prompt: `Update this Pathfinder profile after a completed task.

Current profile:
${JSON.stringify(profile, null, 2)}

Completed task:
${JSON.stringify(completedTask, null, 2)}

Rules:
- Return the full updated profile JSON.
- Preserve the same top-level profile shape and world shape.
- Keep wording short, casual, and easy to scan.
- Keep destination titles plain and specific, 2-4 words.
- Keep task titles direct, 2-6 words, and descriptions under 14 words.
- Add the completed task to world.completedTasks.
- Remove it from world.mainTasks if present.
- Add a concise completion note.
- Refresh summary, reflections, companion evolution, and destination observations to acknowledge progress.
- Do not erase existing completed task history.`,
  });

  return ensureWorld(PathfinderProfileSchema.parse(parseJsonText(text)));
}

function ensureWorld(profile: PathfinderProfile): PathfinderProfile {
  const world = profile.world ?? buildFallbackWorld(profile);
  const destinations = normalizeDestinations(world.destinations, profile);
  return {
    ...profile,
    world: {
      destinations,
      mainTasks: dedupeTasks(world.mainTasks ?? []),
      completedTasks: dedupeTasks(world.completedTasks ?? []),
      completionNotes: world.completionNotes ?? [],
    },
  };
}

function normalizeDestinations(
  destinations: NonNullable<PathfinderProfile["world"]>["destinations"],
  profile: PathfinderProfile,
): PathfinderDestination[] {
  const fallback = buildFallbackWorld(profile).destinations;
  const normalized = destinations.slice(0, 4);
  while (normalized.length < 4) {
    normalized.push(fallback[normalized.length]);
  }
  return normalized.map((destination, index): PathfinderDestination => {
    const type: PathfinderDestination["type"] = index === 3 ? "discovery" : "interest";
    return {
      ...destination,
      id: index === 3 ? "discovery" : destination.id || `interest-${index + 1}`,
      type,
      title: index === 3 ? "Discovery Pond" : destination.title,
      suggestedTasks: destination.suggestedTasks.slice(0, 3),
      backupTasks: destination.backupTasks.length ? destination.backupTasks : fallback[index].backupTasks,
    };
  });
}

function dedupeTasks(tasks: PathfinderTask[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = task.id || task.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateGeminiJson({
  schema,
  prompt,
}: {
  schema: JsonSchema;
  prompt: string;
}) {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetchWithRetry(
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
          responseMimeType: "application/json",
          responseSchema: schema,
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

async function fetchWithRetry(url: string, init: RequestInit) {
  const maxAttempts = 3;
  let lastDetails = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, init);

    if (response.ok || !isRetryableStatus(response.status) || attempt === maxAttempts) {
      return response;
    }

    lastDetails = await response.text();
    await wait(backoffMs(attempt, response.headers.get("retry-after")));
  }

  throw new Error(`Gemini request failed after retries: ${lastDetails}`);
}

function isRetryableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function backoffMs(attempt: number, retryAfter: string | null) {
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return 800 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
