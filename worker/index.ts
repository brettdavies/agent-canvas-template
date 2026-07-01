import { zValidator } from '@hono/zod-validator';
import { analyzeGameSchema, analyzeGames, gamesQuerySchema, MAX_ANALYZE_GAMES } from '@shared/mlb';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { type DataSource, InputError, resolveDataset } from '../server/ingest/resolve';
import { analyzeInputJsonSchema, analyzeOutputJsonSchema } from '../server/mlb/schema';
import { getGame, loadTeams, queryGames } from './db/schema';
import { AI_TXT, LLMS_FULL_TXT, LLMS_TXT, MCP_SKILL_MD, serverCard } from './discovery';
import { handleMcp } from './mcp';
import { openApiDocument } from './openapi';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  QUERY_RATE_LIMITER: RateLimit;
  MCP_RATE_LIMITER: RateLimit;
}

const app = new Hono<{ Bindings: Env }>();

// Open CORS (Access-Control-Allow-Origin: *) on the agent-facing surface is deliberate,
// not an oversight, so a browser-origin / in-page agent on any origin can call the tools
// and read the discovery docs. It is safe here because:
//   - every endpoint is public, authless, and rate-limited per IP — there is no
//     per-user or credentialed data an origin check would be protecting;
//   - no cookies or Authorization are involved and credentials are intentionally NOT
//     enabled, so the wildcard cannot expose an ambient session (the one case where `*`
//     is genuinely unsafe).
// Registered before the routes so OPTIONS preflight is answered here rather than falling
// through to the /mcp non-POST 405 guard.
const agentCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
  maxAge: 86400,
});
for (const path of [
  '/mcp',
  '/api/*',
  '/openapi.json',
  '/llms.txt',
  '/llms-full.txt',
  '/mcp-skill.md',
  '/.well-known/*',
]) {
  app.use(path, agentCors);
}

// ~60 requests/min per client IP. The binding limits per Cloudflare location, keyed
// on cf-connecting-ip; on exceed the route returns 429 with a small JSON body.
async function overLimit(limiter: RateLimit, ip: string, surface: string): Promise<boolean> {
  const { success } = await limiter.limit({ key: `${surface}:${ip}` });
  return !success;
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('cf-connecting-ip') ?? 'unknown';
}

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare("select datetime('now') as now").first<{ now: string }>();
  return c.json({ status: 'ok', now: row?.now ?? null });
});

app.get('/api/teams', async (c) => c.json(await loadTeams(drizzle(c.env.DB))));

app.get('/api/games', zValidator('query', gamesQuerySchema), async (c) => {
  if (await overLimit(c.env.QUERY_RATE_LIMITER, clientIp(c), 'query')) {
    return c.json({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' }, 429);
  }
  return c.json(await queryGames(drizzle(c.env.DB), c.req.valid('query')));
});

app.get('/api/games/:gamePk', async (c) => {
  const gamePk = Number(c.req.param('gamePk'));
  if (!Number.isInteger(gamePk)) return c.json({ error: 'invalid_input', message: 'gamePk must be an integer' }, 400);
  const game = await getGame(drizzle(c.env.DB), gamePk);
  if (!game) return c.json({ error: 'not_found', message: `No game ${gamePk}.` }, 404);
  return c.json(game);
});

// Analyze a caller-supplied game dataset: inline JSON array, an https URL the Worker
// fetches, or a multipart JSON file upload. Pure compute, no D1.
app.post('/api/analyze', async (c) => {
  if (await overLimit(c.env.QUERY_RATE_LIMITER, clientIp(c), 'query')) {
    return c.json({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' }, 429);
  }
  try {
    let source: DataSource;
    const contentType = c.req.header('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === 'string' || typeof (file as File).text !== 'function') {
        throw new InputError('multipart request must include a JSON `file` field');
      }
      source = { fileText: await (file as File).text() };
    } else {
      let body: Record<string, unknown>;
      try {
        body = await c.req.json();
      } catch {
        throw new InputError('request body is not valid JSON');
      }
      source = { data: body.games, url: body.games_url as string | undefined };
    }
    const games = await resolveDataset(source, analyzeGameSchema, { maxItems: MAX_ANALYZE_GAMES, label: 'games' });
    return c.json(analyzeGames(games));
  } catch (err) {
    if (err instanceof InputError) return c.json({ error: 'invalid_input', message: err.message }, 400);
    if (err instanceof z.ZodError) {
      return c.json({ error: 'invalid_params', message: err.issues[0]?.message ?? 'invalid input' }, 400);
    }
    throw err;
  }
});

app.get('/api/schema/input.json', (c) => {
  c.header('content-type', 'application/schema+json');
  return c.body(JSON.stringify(analyzeInputJsonSchema, null, 2));
});

app.get('/api/schema/output.json', (c) => {
  c.header('content-type', 'application/schema+json');
  return c.body(JSON.stringify(analyzeOutputJsonSchema, null, 2));
});

// The SPA logger fire-and-forgets here; accept and acknowledge.
app.post('/api/logs', (c) => c.json({ ok: true }));

app.all('/mcp', async (c) => {
  if (await overLimit(c.env.MCP_RATE_LIMITER, clientIp(c), 'mcp')) {
    return c.json({ error: 'rate_limited', message: 'Too many MCP requests. Try again shortly.' }, 429);
  }
  // Stateless server: no server-initiated messages, so the streamable-HTTP GET SSE
  // stream would just hold the connection open with nothing to send. Reject any
  // non-POST fast (405) instead of hanging; clients drive the endpoint with POST.
  if (c.req.method !== 'POST') {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32601, message: 'This MCP endpoint is stateless; use POST for JSON-RPC.' },
      },
      405,
      { Allow: 'POST' },
    );
  }
  return handleMcp(c, drizzle(c.env.DB));
});

// Agent discovery. The MCP server card is served canonically and via its pointer
// aliases; llms/ai/skill docs describe the server and its contract.
const cardJson = JSON.stringify(serverCard, null, 2);
for (const path of ['/.well-known/mcp/server-card.json', '/.well-known/mcp', '/.well-known/mcp.json', '/mcp.json']) {
  app.get(path, (c) => {
    c.header('content-type', 'application/json');
    return c.body(cardJson);
  });
}
const textRoute = (path: string, body: string, type: string) =>
  app.get(path, (c) => {
    c.header('content-type', `${type}; charset=utf-8`);
    return c.body(body);
  });
textRoute('/.well-known/ai.txt', AI_TXT, 'text/plain');
textRoute('/llms.txt', LLMS_TXT, 'text/plain');
textRoute('/llms-full.txt', LLMS_FULL_TXT, 'text/plain');
textRoute('/mcp-skill.md', MCP_SKILL_MD, 'text/markdown');

const openApiJson = JSON.stringify(openApiDocument, null, 2);
app.get('/openapi.json', (c) => {
  c.header('content-type', 'application/json');
  return c.body(openApiJson);
});

// Everything else: static files from Workers Assets. With not_found_handling: none,
// ASSETS returns a real 404 for any path that isn't a file, so an agent can tell
// "exists" from "doesn't" by status code. Browser navigations to a missing path get
// sent home (they'd otherwise dead-end); every other client gets the honest 404.
app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status !== 404) return res;
  if (c.req.header('sec-fetch-mode') === 'navigate') return c.redirect('/', 302);
  return c.json({ error: 'not_found', message: `No resource at ${new URL(c.req.url).pathname}.` }, 404);
});

export default app;
