# Pathfinder MVP Plan

## Goal

Build a hackathon-ready local demo that turns a ChatGPT export into a game-like personal quest map.

## Implementation Plan

1. Parse uploaded ChatGPT JSON exports in the browser and send raw parsed JSON to `POST /api/analyze`.
2. Normalize either one `conversations.json` array or multiple `conversations-###.json` shard arrays.
3. Extract only user-authored text messages from each conversation `mapping`.
4. Build a representative corpus from early, spaced middle, and recent messages.
5. Ask OpenAI for the required Pathfinder profile JSON shape.
6. Fall back to a mock profile when `OPENAI_API_KEY` is not present, so frontend work is never blocked.
7. Store the latest profile in `localStorage` and render it as a world map.

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

For 1,000+ conversations, the MVP does not run multi-pass summarization. It samples up to 240 user messages:

- 20% earliest messages for origin signals
- 35% spaced middle messages for recurring themes
- 45% most recent messages for current ambitions

Each message is capped at 1,200 characters, and the final corpus is capped at 90,000 characters. This is intentionally fast and good enough for a demo. A production version should summarize per shard, then synthesize summaries into the final profile.

## Project Structure

```txt
src/app/page.tsx              Upload, loading, and world UI
src/app/layout.tsx            App shell and font setup
src/app/globals.css           Global theme styles
src/app/api/analyze/route.ts  Analyze endpoint and OpenAI call
src/lib/pathfinder.ts         Shared schema, parser, chunking, fallback profile
docs/pathfinder-mvp.md        Handoff notes
```

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
    "alternateLives": [],
    "strengths": [],
    "unfinishedBusiness": [],
    "dragons": [],
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
    "estimatedCharacters": 0
  },
  "source": "openai"
}
```
