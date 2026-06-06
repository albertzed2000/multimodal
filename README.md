# Pathfinder

Hackathon MVP for turning ChatGPT conversation exports into an uplifting, cute, and motivating personal dashboard.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app works without an API key using mock profile data. To enable Gemini analysis with a Google AI Studio key:

```bash
cp .env.example .env.local
```

Then set `GEMINI_API_KEY`.

## MVP

- Upload one `conversations.json` file or multiple `conversations-###.json` shards
- Parse user-authored ChatGPT messages
- Generate a Pathfinder profile
- Render archetype, companion, sparkle board, destiny threads, gentle nudges, and quests
- Store the latest profile in browser `localStorage`

See `docs/pathfinder-mvp.md` for parsing and chunking details.
