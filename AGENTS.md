# AGENTS.md

## What this is

An agent-native full-stack starter template. A Hono API and a React/Vite frontend, typed end to end, backed by Postgres
with pgvector on the Node dev server and Cloudflare D1 at the edge. It ships a stateless MCP server, agent-discovery
surfaces, and RAG. The worked example is a stored MLB game dataset; the canvas underneath is domain-agnostic.

## Stack

Node (Hono via `@hono/node-server`) for local dev; a Cloudflare Worker (`worker/`) for the edge deploy. By layer: Bun
(package manager and TS runner) · TypeScript 6 · Hono 4 · Zod 4 with `@hono/zod-validator` · Drizzle ORM 0.45 with
`drizzle-zod`, postgres.js 3, and Cloudflare D1 · PostgreSQL 16 with pgvector · React 19 · Vite 7 · Tailwind 4 with
DaisyUI 5 · Biome 2 · Vitest 4 · MCP via `@hono/mcp` and `@modelcontextprotocol/sdk`.

Exact versions live in `package.json` and `bun.lock` — the source of truth, not restated here. Deliberate pins that
interlock (do not bump mid-build): **Vite 7 with `@vitejs/plugin-react` 5** (not Vite 8 / plugin-react 6, which require
each other) and **TypeScript 6** (not the TS 7 native preview).

## Layout

```text
package.json, tsconfig.json, biome.json, vite.config.ts, drizzle.config.ts, drizzle.d1.config.ts, wrangler.jsonc
index.html
src/        main.tsx, App.tsx (shell), Rag.tsx, Games.tsx, AgentLinks.tsx, lib/api.ts (typed Hono client), lib/
server/     app.ts (Hono app, exports AppType), index.ts (@hono/node-server :3000)
server/     db/ (client + schema), mlb/ (query + published schemas), ingest/ (multi-source resolver), rag/, ai/, mcp/
shared/     cross-boundary Zod schemas + types (log, mlb) via the @shared alias
worker/     Cloudflare Worker: index.ts, mcp.ts, discovery.ts, openapi.ts, db/schema.ts (D1)
db/         scripts/ (loaders, seed, embeddings), fixtures/ (committed sample data)
drizzle/    Postgres migrations; worker/migrations/ D1 migrations
```

## Types: one source of truth (define once, propagate everywhere)

**Every shared type is defined exactly once and flows outward — never hand-redeclare a shape on another layer.** DB
shapes live in `server/db/schema.ts` (Drizzle) → `drizzle-zod` insert/select schemas → request validation via
`@hono/zod-validator`. Non-DB cross-boundary shapes live in `shared/` (Zod + `z.infer`), imported through the `@shared`
alias from `src/`, `server/`, and `worker/`. The server exports `AppType`; React consumes it through the Hono RPC client
(`hc<AppType>` in `src/lib/api.ts`), so request/response types are inferred end to end — no hand-written DTOs. If you
catch yourself writing the same field shape twice, derive it instead.

## Adding a feature (the build loop)

1. Define the table in `server/db/schema.ts` (Postgres) and, if the edge needs it, `worker/db/schema.ts` (D1).
2. `bun run db:generate` + `bun run db:migrate` (and `bun run db:generate-d1` for D1).
3. Add reads under `server/mlb/` (rename to your domain) and validation schemas in `shared/`.
4. Wire REST routes in `server/app.ts` and `worker/index.ts` (keep them in lockstep); the exported `AppType` updates
   automatically.
5. Register MCP tools in `server/mcp/tools/` and `worker/mcp.ts` so the MCP surface mirrors REST.
6. Update the agent-discovery copy (`worker/discovery.ts`) and OpenAPI (`worker/openapi.ts`).
7. Call the routes from React via the typed `hc<AppType>` client.

## Data: Postgres + pgvector (dev) and D1 (edge)

The Node server uses Postgres 16 with the `vector` extension (pgvector); the Worker uses Cloudflare D1 (SQLite; no
vector search). The MLB example keeps the full dataset + embeddings in Postgres and a small denormalized slice in D1.
Provide `DATABASE_URL` (and, for a re-provisioned database, enable the extension with a superuser role — the app role is
low-privilege and cannot `CREATE EXTENSION`).

Embeddings are first-class in Drizzle — no raw SQL:

- Column: `vector('embedding', { dimensions: N })` from `drizzle-orm/pg-core`.
- Index: `index('...').using('hnsw', t.embedding.op('vector_cosine_ops'))` (HNSW or `ivfflat`; opclass via `.op()`).
- Query: order by `cosineDistance(table.embedding, q)` / `l2Distance(...)` / `innerProduct(...)` from `drizzle-orm`.

## AI (OpenAI)

`OPENAI_API_KEY` (in `.env`) powers the AI features; the `openai` SDK is installed. Helper `server/ai/openai.ts` exports
`chat(prompt)` and `embed(input)`, plus `CHAT_MODEL` (`gpt-4o-mini`) and `EMBED_MODEL` (`text-embedding-3-small`, 1536
dims). Pre-flight check: `bun server/ai/smoke.ts` makes one chat + one embedding call and prints the model, reply, and
embedding dimension.

## MCP server

The app serves a streamable-HTTP MCP server at **`/mcp`**, no auth, built on `@hono/mcp` (`StreamableHTTPTransport`) and
`@modelcontextprotocol/sdk` (`McpServer`). The layout mirrors REST:

- `server/mcp/server.ts` — the `McpServer` (name, version, instructions, tools); mounted in `server/app.ts`.
- `server/mcp/instructions.ts` — the server-card prose.
- `server/mcp/tools/index.ts` — the `registerTools(server)` aggregator; `tools/<surface>.ts` files register tools with
  `server.tool(name, description, zodShape, handler)`.

Current tools: `now` (DB time — proves the MCP → Drizzle → Postgres path), `list_teams` / `query_games` / `get_game`
(the durable MLB dataset), `analyze_dataset` (stats over a posted game list), `rag_answer`. The Worker (`worker/mcp.ts`)
builds a fresh stateless server per request over D1, exposing the same tools minus the Postgres/qmd ones. Add a tool by
wrapping the same query the REST route uses, then registering it on both surfaces. Test with `bunx
@modelcontextprotocol/inspector` against `http://localhost:3000/mcp`.

## Running

1. `bun install`
2. `.env` holds `DATABASE_URL` and `OPENAI_API_KEY` (credentials in your secret manager).
3. `bun run db:migrate` then `bun run db:seed` (loads the sample MLB fixture).
4. `bun run dev` (Vite on 5173, Hono on 3000; Vite proxies `/api` to 3000).

## Accessibility (WCAG 2.1, loose A/AA)

The frontend follows WCAG 2.1 A/AA best practices and passes an automated check: `bun run test:a11y`
(`tests/a11y/run.ts` runs `axe-core` against the running dev server, failing only on `serious`/`critical` violations).
Start the app first (`bun run dev`); point at a different origin with `A11Y_URL`. Semantic HTML and landmarks, labeled
controls, visible focus, AA contrast, keyboard operability, and `prefers-reduced-motion` alternatives all hold.
DaisyUI/Tailwind components are accessible by default; do not override them into inaccessible custom markup.

## Toast + logging

Centralized; import from one place each, never the underlying libraries directly.

- **Toasts:** `notify` in `src/lib/toast.ts` wraps `react-hot-toast`. One `<Toaster position="bottom-right" />` mounts
  in `src/App.tsx`.
- **Frontend logging:** `logger` in `src/lib/logger.ts` writes to the console and fire-and-forgets a POST to
  `/api/logs`; it swallows its own errors.
- **Backend logging:** `serverLog` in `server/log.ts` emits one structured JSON line per call; `serverLog.client(entry)`
  records a frontend entry under `source: 'client'`.
- **One shape, shared:** the log-entry shape is the single Zod schema `logEntrySchema` (`shared/log.ts`), used by both
  the FE logger payload and the `/api/logs` validator.

## Shared package

`shared/` holds the Zod schemas and types used across the frontend, backend, and Worker — the non-DB shapes the
Drizzle-schema → `AppType` flow does not cover. Import through the `@shared` alias (wired in `tsconfig.json`,
`vite.config.ts`, and `vitest.config.ts`). `shared/log.ts` (`logEntrySchema`) and `shared/mlb.ts` (query/analyze schemas

- the pure `analyzeGames`) are the examples; the analyzer is pure so the Worker imports it too.

## Quality gates

`core.hooksPath` is `scripts/hooks` (set per clone with `git config core.hooksPath scripts/hooks`).

- pre-commit: `biome check --staged` plus `tsc --noEmit` (staged-scoped lint, whole-program type-check).
- pre-push: `biome check .` plus `tsc --noEmit` (repo-wide).

Both no-op until `bun install` has run. Scripts: `dev`, `build`, `lint`, `format`, `typecheck`, `test` (`vitest run`),
`test:a11y`, plus the `db:*` and `cf:*` families.

## Conventions

- This is a template: the MLB feature is a replaceable worked example. Keep the canvas (shell, MCP transport, discovery,
  RAG plumbing, deploy) domain-agnostic; put domain code behind the boundaries above.
- No auth or payments wired — add only if your domain calls for it; keep features vertical and shippable.
