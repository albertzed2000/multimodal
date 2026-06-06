# Pathfinder MVP Plan

## Goal

Build a hackathon-ready local demo that turns a ChatGPT export into an **uplifting, cute, fun, encouraging, and motivating** personal dashboard — not a dark fantasy quest or boss-battle story.

The vibe should feel like a supportive companion cheering you on: warm, playful, specific, and action-oriented.

## Product Tone

- **Uplifting** — highlight what the user is already doing well
- **Cute & fun** — light game flavor (companion, sparkles, quests) without combat or dread
- **Encouraging** — frame open loops as gentle next steps, not failures
- **Motivating** — quests should feel doable and energizing, not punitive

Avoid: bosses, dragons, alternate-life regret framing, therapy-speak, diagnosis, or generic personality-test language.

## Implementation Plan

1. Parse uploaded ChatGPT JSON exports in the browser and send raw parsed JSON to `POST /api/analyze`.
2. Normalize either one `conversations.json` array or multiple `conversations-###.json` shard arrays.
3. Extract only user-authored text messages from each conversation `mapping`.
4. Build a representative corpus from early, spaced middle, and recent messages.
5. Summarize chronological chunks with Gemini.
6. Ask Gemini to synthesize the final Pathfinder profile JSON from chunk summaries.
7. Fall back to a mock profile when `GEMINI_API_KEY` is not present, so frontend work is never blocked.
7. Store the latest profile in `localStorage` and render it as a cheerful companion dashboard.

## Inspected Export Structure

This workspace contains 13 conversation shards:

- `conversations-000.json` through `conversations-011.json`: 100 conversations each
- `conversations-012.json`: 70 conversations
- Total: 1,270 conversations

Each conversation is an object with fields such as:

- `title`
- `create_time`
- `update_time`
- `mapping`
- `current_node`

User messages live under:

```txt
conversation.mapping[nodeId].message.author.role === "user"
conversation.mapping[nodeId].message.content.parts[]
```

## Parsing Strategy

The parser in `src/lib/pathfinder.ts`:

- Accepts a single conversation array or an array of shard arrays.
- Filters invalid rows defensively.
- Iterates all `mapping` nodes instead of relying on a single linear path.
- Keeps only messages where `author.role` is `user`.
- Supports string `content.text` and array `content.parts`.
- Cleans whitespace and drops tiny messages under 8 characters.
- Sorts messages by `create_time` when available.

## Chunking Strategy

For 1,000+ conversations, the backend now runs a two-pass pipeline:

- Sort extracted user messages chronologically.
- Group all messages into chunks capped around 300 messages or 32,000 formatted characters.
- Ask Gemini to summarize each chunk into recurring interests, active projects, goals, strengths, open loops, tone, quest seeds, and memorable signals.
- Ask Gemini for a final synthesis over the chunk summaries.

Each individual message is capped at 1,200 characters before chunking. This keeps processing fast while avoiding the earlier MVP behavior of analyzing only a small sample.

## Project Structure

```txt
src/app/page.tsx              Upload, loading, and dashboard UI
src/app/layout.tsx            App shell and font setup
src/app/globals.css           Global theme styles
src/app/api/analyze/route.ts  Analyze endpoint and Gemini summarization pipeline
src/lib/pathfinder.ts         Shared schema, parser, chunking, fallback profile
docs/pathfinder-mvp.md        Handoff notes
```

## Profile Shape

Each profile section maps to a supportive UI area:

| Field | UI area | Purpose |
|---|---|---|
| `archetype` | Hero card | A warm, playful identity label |
| `summary` | Hero card | Encouraging overview of who they're becoming |
| `reflections` | Sparkle board | Delightful discoveries from their chat history |
| `strengths` | Sparkle board | Things they're already great at |
| `destinyThreads` | Sparkle board | Recurring themes worth leaning into |
| `unfinishedBusiness` | Gentle nudges | Open loops framed as friendly next chapters |
| `quests` | Quest panel | Small, real-world wins for the next 1–7 days |
| `companion` | Companion card | Cute symbolic buddy + collectible cheer items |

## API Contract

Request:

```json
{
  "conversations": []
}
```

`conversations` can be either a single ChatGPT export array or an array of shard arrays.

Response:

```json
{
  "profile": {
    "archetype": "",
    "summary": "",
    "strengths": [],
    "unfinishedBusiness": [],
    "destinyThreads": [],
    "reflections": [],
    "quests": [],
    "companion": {
      "baseType": "",
      "evolutionItems": []
    }
  },
  "stats": {
    "conversations": 0,
    "messages": 0,
    "sampledMessages": 0,
    "chunkCount": 0,
    "summarizedMessages": 0,
    "estimatedCharacters": 0
  },
  "source": "gemini"
}
```
