# Pathfinder

Hackathon MVP for turning ChatGPT conversation exports into a gamified personal quest map.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app works without an API key using mock profile data. To enable OpenAI analysis:

```bash
cp .env.example .env.local
```

Then set `OPENAI_API_KEY`.

## MVP

- Upload one `conversations.json` file or multiple `conversations-###.json` shards
- Parse user-authored ChatGPT messages
- Generate a Pathfinder profile
- Render archetype, companion, reflection nodes, destiny threads, dragons, and quests
- Store the latest profile in browser `localStorage`

See `docs/pathfinder-mvp.md` for parsing and chunking details.
