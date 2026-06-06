import { z } from "zod";

export const PathfinderTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(["task", "project", "exploration", "discovery"]),
  companionReward: z.string(),
});

export const PathfinderDestinationSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["interest", "discovery"]),
  iconHint: z.string(),
  emoji: z.string(),
  observation: z.string(),
  suggestedTasks: z.array(PathfinderTaskSchema),
  backupTasks: z.array(PathfinderTaskSchema),
});

export const PathfinderWorldSchema = z.object({
  destinations: z.array(PathfinderDestinationSchema),
  mainTasks: z.array(PathfinderTaskSchema),
  completedTasks: z.array(PathfinderTaskSchema),
  completionNotes: z.array(z.string()),
});

export const PathfinderProfileSchema = z.object({
  archetype: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  unfinishedBusiness: z.array(z.string()),
  destinyThreads: z.array(z.string()),
  reflections: z.array(z.string()),
  quests: z.array(z.string()),
  companion: z.object({
    baseType: z.string(),
    evolutionItems: z.array(z.string()),
  }),
  world: PathfinderWorldSchema.optional(),
});

export type PathfinderProfile = z.infer<typeof PathfinderProfileSchema>;
export type PathfinderTask = z.infer<typeof PathfinderTaskSchema>;
export type PathfinderDestination = z.infer<typeof PathfinderDestinationSchema>;
export type PathfinderWorld = z.infer<typeof PathfinderWorldSchema>;

export type ParsedMessage = {
  conversationTitle: string;
  createTime?: number;
  text: string;
};

export const ConversationChunkSummarySchema = z.object({
  label: z.string(),
  timeRange: z.string(),
  recurringInterests: z.array(z.string()),
  activeProjects: z.array(z.string()),
  goalsAndAspirations: z.array(z.string()),
  strengths: z.array(z.string()),
  openLoops: z.array(z.string()),
  emotionalTone: z.array(z.string()),
  questSeeds: z.array(z.string()),
  memorableSignals: z.array(z.string()),
});

export const ConversationChunkSummariesSchema = z.object({
  summaries: z.array(ConversationChunkSummarySchema),
});

export type ConversationChunkSummary = z.infer<typeof ConversationChunkSummarySchema>;

type ExportConversation = {
  title?: unknown;
  create_time?: unknown;
  mapping?: Record<
    string,
    {
      message?: {
        author?: { role?: unknown };
        content?: {
          parts?: unknown;
          text?: unknown;
        };
        create_time?: unknown;
      } | null;
    }
  >;
};

type MessageContent = {
  parts?: unknown;
  text?: unknown;
};

export type ParseStats = {
  conversations: number;
  messages: number;
  sampledMessages: number;
  chunkCount: number;
  summarizedMessages: number;
  estimatedCharacters: number;
};

export type ConversationChunk = {
  index: number;
  label: string;
  timeRange: string;
  messages: ParsedMessage[];
  characterCount: number;
};

export function normalizeConversationPayload(input: unknown): ExportConversation[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const maybeShards = input.every((item) => Array.isArray(item));
  const rows = maybeShards ? input.flat() : input;
  return rows.filter((item): item is ExportConversation => Boolean(item && typeof item === "object"));
}

export function extractUserMessages(conversations: ExportConversation[]): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const conversation of conversations) {
    const title = typeof conversation.title === "string" ? conversation.title : "Untitled";
    const createTime =
      typeof conversation.create_time === "number" ? conversation.create_time : undefined;

    if (!conversation.mapping || typeof conversation.mapping !== "object") {
      continue;
    }

    for (const node of Object.values(conversation.mapping)) {
      const message = node.message;
      if (!message || message.author?.role !== "user") {
        continue;
      }

      const text = contentToText(message.content);
      const cleaned = cleanMessage(text);
      if (cleaned.length >= 8) {
        messages.push({
          conversationTitle: title,
          createTime:
            typeof message.create_time === "number" ? message.create_time : createTime,
          text: cleaned,
        });
      }
    }
  }

  return messages.sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0));
}

export function buildAnalysisCorpus(messages: ParsedMessage[], conversationCount?: number) {
  const sample = representativeSample(messages, 240);
  const lines = sample.map((message, index) => {
    const date = message.createTime
      ? new Date(message.createTime * 1000).toISOString().slice(0, 10)
      : "unknown-date";
    return `${index + 1}. [${date}] ${message.conversationTitle}: ${message.text}`;
  });

  return {
    corpus: lines.join("\n").slice(0, 90_000),
    stats: {
      conversations: conversationCount ?? new Set(messages.map((message) => message.conversationTitle)).size,
      messages: messages.length,
      sampledMessages: sample.length,
      chunkCount: 1,
      summarizedMessages: sample.length,
      estimatedCharacters: messages.reduce((total, message) => total + message.text.length, 0),
    } satisfies ParseStats,
  };
}

export function buildConversationChunks(
  messages: ParsedMessage[],
  options: { maxMessages?: number; maxCharacters?: number } = {},
) {
  const maxMessages = options.maxMessages ?? 400;
  const maxCharacters = options.maxCharacters ?? 45_000;
  const chunks: ConversationChunk[] = [];
  let current: ParsedMessage[] = [];
  let currentCharacters = 0;

  for (const message of messages) {
    const nextCharacters = formatMessageForAnalysis(message, current.length).length;
    const shouldFlush =
      current.length > 0 &&
      (current.length >= maxMessages || currentCharacters + nextCharacters > maxCharacters);

    if (shouldFlush) {
      chunks.push(createChunk(chunks.length, current, currentCharacters));
      current = [];
      currentCharacters = 0;
    }

    current.push(message);
    currentCharacters += nextCharacters;
  }

  if (current.length) {
    chunks.push(createChunk(chunks.length, current, currentCharacters));
  }

  return chunks;
}

export function buildChunkCorpus(chunk: ConversationChunk) {
  return chunk.messages
    .map((message, index) => formatMessageForAnalysis(message, index))
    .join("\n")
    .slice(0, 48_000);
}

export function buildParseStats(
  conversations: number,
  messages: ParsedMessage[],
  chunks: ConversationChunk[],
): ParseStats {
  return {
    conversations,
    messages: messages.length,
    sampledMessages: messages.length,
    chunkCount: chunks.length,
    summarizedMessages: chunks.reduce((total, chunk) => total + chunk.messages.length, 0),
    estimatedCharacters: messages.reduce((total, message) => total + message.text.length, 0),
  };
}

export function fallbackProfile(messages: ParsedMessage[]): PathfinderProfile {
  const joined = messages.map((message) => message.text.toLowerCase()).join(" ");
  const hasStartup = /startup|founder|product|hackathon|saas|launch|company/.test(joined);
  const hasCode = /code|typescript|next|react|api|database|python|engineering/.test(joined);

  const profile: PathfinderProfile = {
    archetype: hasStartup
      ? "The Systems Builder"
      : hasCode
        ? "The Technical Cartographer"
        : "The Reflective Strategist",
    summary:
      "Your conversations show a bias toward turning ambiguity into usable systems. You repeatedly use AI as a thinking partner for decisions, projects, self-improvement, and execution — and that's worth celebrating.",
    strengths: [
      "You break vague ambitions into named projects and concrete next actions.",
      "You move fluidly between strategy, implementation, and storytelling.",
      "You ask for structure when speed matters, which is a strong execution pattern.",
    ],
    unfinishedBusiness: [
      "Ship a smaller version sooner — a rough demo still counts as progress.",
      "Protect a little follow-through time after the initial planning surge.",
      "Pick one active quest when multiple interests compete for attention.",
    ],
    destinyThreads: [
      "Build tools that convert personal history into actionable guidance.",
      "Create systems where reflection becomes momentum.",
      "Use taste and technical fluency to make AI feel personal rather than generic.",
    ],
    reflections: [
      "You often return to the same question: how can intelligence become a practical companion?",
      "Your best ideas sit at the border of self-knowledge, product design, and automation.",
      "The world you're building should reward completion, not just insight — and you're already on your way.",
    ],
    quests: [
      "Pick one neglected project and define the smallest public demo you can ship in 48 hours.",
      "Write a one-page note on how you want AI to cheer you on this month.",
      "Schedule one real conversation with someone whose path inspires you.",
      "Turn three recurring ChatGPT prompts into reusable templates.",
      "Complete one small task today that makes tomorrow's version of you smile.",
    ],
    companion: {
      baseType: "Compass Fox",
      evolutionItems: [
        "Signal Lantern: for shipping a prototype.",
        "Thread Cloak: for connecting two old interests into one project.",
        "Star Sticker: for finishing something you've been putting off.",
      ],
    },
  };

  return {
    ...profile,
    world: buildFallbackWorld(profile),
  };
}

export function buildFallbackWorld(profile: PathfinderProfile): PathfinderWorld {
  const titles = [
    profile.destinyThreads[0] ? shortTitle(profile.destinyThreads[0]) : "Builder Tools",
    profile.destinyThreads[1] ? shortTitle(profile.destinyThreads[1]) : "Reflection Systems",
    profile.destinyThreads[2] ? shortTitle(profile.destinyThreads[2]) : "Creative AI",
  ];
  const emojis = ["🛠️", "🧭", "✨"];

  const destinations: PathfinderDestination[] = titles.map((title, index) => ({
    id: `interest-${index + 1}`,
    title,
    type: "interest",
    iconHint: title,
    emoji: emojis[index],
    observation:
      profile.destinyThreads[index] ??
      "This interest shows up as a recurring place where curiosity turns into action.",
    suggestedTasks: makeFallbackTasks(profile.quests, index),
    backupTasks: makeFallbackTasks(profile.unfinishedBusiness, index + 3),
  }));

  destinations.push({
    id: "discovery",
    title: "Discovery Pond",
    type: "discovery",
    iconHint: "miscellaneous discovery pond",
    emoji: "🌿",
    observation:
      "This pond gathers miscellaneous interests, older goals, side projects, and half-finished sparks from your conversations.",
    suggestedTasks: makeFallbackTasks(profile.reflections, 6),
    backupTasks: makeFallbackTasks(profile.quests.concat(profile.unfinishedBusiness), 9),
  });

  return {
    destinations,
    mainTasks: [],
    completedTasks: [],
    completionNotes: [],
  };
}

function makeFallbackTasks(items: string[], offset: number): PathfinderTask[] {
  const fallback = [
    "Write a 20-minute plan for one small prototype.",
    "Turn one repeated question into a reusable checklist.",
    "Schedule one conversation related to this interest.",
  ];
  return Array.from({ length: 3 }, (_, index) => {
    const title = items[(index + offset) % Math.max(items.length, 1)] ?? fallback[index];
    return {
      id: `task-${offset}-${index}-${slugify(title).slice(0, 24)}`,
      title: shortTitle(title),
      description: title,
      category: index === 1 ? "exploration" : "task",
      companionReward: "A small glow of momentum for your companion.",
    };
  });
}

function shortTitle(value: string) {
  const words = value.replace(/[^\w\s-]/g, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 4).join(" ") || "Curiosity Trail";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function contentToText(content: MessageContent | undefined) {
  if (!content) {
    return "";
  }

  if (typeof content.text === "string") {
    return content.text;
  }

  if (Array.isArray(content.parts)) {
    return content.parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n");
  }

  return "";
}

function cleanMessage(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 1_200);
}

function createChunk(index: number, messages: ParsedMessage[], characterCount: number): ConversationChunk {
  const first = messages[0]?.createTime;
  const last = messages[messages.length - 1]?.createTime;
  const start = first ? new Date(first * 1000).toISOString().slice(0, 10) : "unknown";
  const end = last ? new Date(last * 1000).toISOString().slice(0, 10) : "unknown";

  return {
    index,
    label: `Chunk ${index + 1}`,
    timeRange: `${start} to ${end}`,
    messages,
    characterCount,
  };
}

function formatMessageForAnalysis(message: ParsedMessage, index: number) {
  const date = message.createTime
    ? new Date(message.createTime * 1000).toISOString().slice(0, 10)
    : "unknown-date";
  return `${index + 1}. [${date}] ${message.conversationTitle}: ${message.text}`;
}

function representativeSample(messages: ParsedMessage[], maxMessages: number) {
  if (messages.length <= maxMessages) {
    return messages;
  }

  const recent = messages.slice(-Math.floor(maxMessages * 0.45));
  const early = messages.slice(0, Math.floor(maxMessages * 0.2));
  const middleBudget = maxMessages - recent.length - early.length;
  const middle = messages.slice(early.length, -recent.length);
  const step = Math.max(1, Math.floor(middle.length / middleBudget));
  const sampledMiddle = middle.filter((_, index) => index % step === 0).slice(0, middleBudget);

  return [...early, ...sampledMiddle, ...recent];
}
