# agent-canvas

An agent-native full-stack starter template: a Hono API and a React/Vite frontend, typed end to end, deployable to
Cloudflare Workers + D1, with a stateless MCP server, agent-discovery surfaces, and retrieval-augmented generation. The
worked example is a stored MLB game dataset; the canvas underneath is domain-agnostic, so you swap the example for your
own domain.

## Use this template

This is a GitHub template repository. Click **Use this template** on GitHub (or run `gh repo create <you>/<name>
--template brettdavies/agent-canvas-template`) to get a fresh repo with a single clean initial commit, then follow
[Setup](#setup). `main` is the default branch; `dev` starts at the same commit for day-to-day work, with feature
branches cut from `dev`.

## Stack

- Bun (package manager + TypeScript runner), Node runtime, TypeScript
- Backend: Hono on `@hono/node-server` (port 3000); a Cloudflare Worker (`worker/`) for the edge deploy
- Frontend: React 19 + Vite 7 (port 5173), Tailwind 4 + DaisyUI
- Data: Drizzle ORM over Postgres 16 + pgvector on the Node server (`postgres.js`) and Cloudflare D1 (SQLite) at the
  edge; Zod schemas via `drizzle-zod`
- AI: OpenAI (`chat` + `embed`); RAG over the local `qmd` knowledge base, the live MLB StatsAPI, and durable pgvector
  search
- Agent surface: MCP over streamable HTTP (`@hono/mcp` + `@modelcontextprotocol/sdk`), plus `.well-known` discovery,
  OpenAPI 3.1, and `llms.txt`
- Lint/format: Biome · Tests: Vitest · Accessibility: axe-core (WCAG 2.1 A/AA)

## Setup

```bash
bun install
git config core.hooksPath scripts/hooks   # enable lint/type-check hooks
cp .env.example .env                        # set DATABASE_URL + OPENAI_API_KEY
bun run db:migrate                          # apply Postgres migrations
bun run db:seed                             # load the sample MLB fixture (db/fixtures/mlb-seed.json)
bun run dev
```

`bun run dev` starts Vite on <http://localhost:5173> and Hono on <http://localhost:3000>; Vite proxies `/api` to the
server. The header health dot proves React, Vite proxy, Hono, Drizzle, and Postgres are all connected.

## MLB worked example

The example stores MLB games and exposes them over REST and MCP, with the two surfaces wrapping the same reads so they
stay in lockstep.

### REST

- `GET /api/health`: liveness (a DB round-trip).
- `GET /api/teams`: the stored teams.
- `GET /api/games?season=&teamId=&date=&limit=`: query stored games, newest first (`date` is `YYYY-MM-DD`).
- `GET /api/games/:gamePk`: one game rolled up (summary, per-inning linescore, scoring plays).
- `POST /api/analyze`: compute summary stats (run totals, averages, shutouts, highest-scoring game, per-team records)
  over a caller-supplied game list, provided inline (`games`), by https URL (`games_url`), or as a multipart JSON
  `file`.
- `POST /api/rag`: a retrieval-augmented answer (see RAG below).
- `GET /api/schema/input.json` and `output.json`: the JSON Schemas (2020-12) for the analyze input/output.

### MCP (`POST /mcp`)

Tools: `now` (DB time), `list_teams`, `query_games`, `get_game`, `analyze_dataset`, and `rag_answer`. The Worker exposes
the same tools without `now`/`rag_answer` (which need Postgres/qmd). Drive it with `bunx
@modelcontextprotocol/inspector` against `http://localhost:3000/mcp`, or plain `curl`: the server is stateless, so
JSON-RPC over curl behaves the same as an MCP client (see `/mcp-skill.md`).

### RAG

`ragAnswer` retrieves from the local `qmd` `stars` knowledge base, runs a pgvector semantic search over
`stats_embeddings` (durable MLB data, when loaded), and fetches live scores from the MLB StatsAPI for any date the
question names, then synthesizes an answer with inline `[S#]` / `[D#]` / `[MLB]` citations. It degrades gracefully when
the database is empty or unreachable.

## Agent-native surface

Served by the Worker at stable paths so agents can discover the server and its contract:

- `/.well-known/mcp/server-card.json` (plus aliases `/.well-known/mcp`, `/.well-known/mcp.json`, `/mcp.json`)
- `/.well-known/ai.txt`, `/llms.txt`, `/llms-full.txt`, `/mcp-skill.md`, `/openapi.json`
- Open CORS on the agent surface, per-IP rate limiting, honest 404/405 status codes, and root-HTML breadcrumbs in
  `index.html`.

## Cloudflare deploy

The Worker (`worker/`) serves the app and a D1-backed slice of the dataset. Deploy is not required for local dev.

```bash
wrangler d1 create agent-canvas            # then set database_id in wrangler.jsonc
bun run db:generate-d1                      # (re)generate the D1 migration from worker/db/schema.ts
wrangler d1 migrations apply agent-canvas --remote
bun run db:seed-d1                          # writes db/fixtures/seed-d1.sql
wrangler d1 execute agent-canvas --remote --file=db/fixtures/seed-d1.sql
bun run cf:deploy                           # vite build + wrangler deploy
```

Set a custom domain (`routes` in `wrangler.jsonc`) and the `BASE` origin in `worker/discovery.ts` and
`worker/openapi.ts` before deploy.

## Loading real MLB data

The seed fixture is a small sample. The full pipeline loads real StatsAPI data into Postgres (loaders read local caches
under `db/feeds/` and `db/embeddings/`, which are gitignored):

- `bun run db:load-one-game [gamePk]`: one game's full GUMBO feed (teams, plays, pitches, boxscore, linescore).
- `bun run db:load-stats`: bulk load from `db/feeds/`.
- `bun run db:load-homeruns`: the hackathon home-run CSVs (`MLB_HOMERUNS_DIR` points at the local dataset).
- `bun run db:embed:submit|recover|fetch|update`: the OpenAI Batch embedding pipeline for `stats_embeddings`.

## Scripts

`dev`, `build`, `db:generate`, `db:migrate`, `db:generate-d1`, `db:seed`, `db:seed-d1`, `db:load-one-game`,
`db:load-stats`, `db:load-homeruns`, `db:embed:*`, `cf:dev`, `cf:build`, `cf:deploy`, `lint`, `format`, `typecheck`,
`test`, `test:watch`, `test:a11y`.

## Layout

```text
src/             React + Vite frontend (App shell, Rag, Games, AgentLinks, theme, lib/)
server/          Hono app (app.ts exports AppType), db/ (client + schema), mlb/ (query + schema),
                 ingest/ (multi-source resolver), rag/, ai/, mcp/ (server + tools)
shared/          cross-boundary Zod schemas + types (log, mlb) via the @shared alias
worker/          Cloudflare Worker: index.ts, mcp.ts, discovery.ts, openapi.ts, db/schema.ts (D1)
db/scripts/      loaders, seed, embedding pipeline · db/fixtures/ committed sample data
drizzle/         Postgres migrations · worker/migrations/ D1 migrations
```

## Replacing the worked example

Swap the MLB domain for yours following the build loop in [AGENTS.md](./AGENTS.md): define your tables in
`server/db/schema.ts`, add reads under `server/mlb/` (rename to your domain), wire REST routes in `server/app.ts` and
`worker/index.ts`, register MCP tools in `server/mcp/tools/` and `worker/mcp.ts`, and update the discovery/OpenAPI copy.
The canvas (shell, MCP transport, discovery, RAG plumbing, deploy) stays put.

See [AGENTS.md](./AGENTS.md) for conventions and the type single-source-of-truth.
