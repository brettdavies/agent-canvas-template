import { StreamableHTTPTransport } from '@hono/mcp';
import { zValidator } from '@hono/zod-validator';
import { logEntrySchema } from '@shared/log';
import { analyzeGameSchema, analyzeGames, gamesQuerySchema, MAX_ANALYZE_GAMES } from '@shared/mlb';
import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from './db/client';
import { type DataSource, InputError, resolveDataset } from './ingest/resolve';
import { serverLog } from './log';
import { mcpServer } from './mcp/server';
import { getGame, listTeams, queryGames } from './mlb/query';
import { analyzeInputJsonSchema, analyzeOutputJsonSchema } from './mlb/schema';
import { ragAnswer } from './rag';

const app = new Hono();

const routes = app
  .get('/api/health', async (c) => {
    const [row] = await sql<{ now: string }[]>`select now() as now`;
    return c.json({ status: 'ok', now: row.now });
  })
  .get('/api/teams', async (c) => c.json(await listTeams()))
  .get('/api/games', zValidator('query', gamesQuerySchema), async (c) => c.json(await queryGames(c.req.valid('query'))))
  .get('/api/games/:gamePk', async (c) => {
    const gamePk = Number(c.req.param('gamePk'));
    if (!Number.isInteger(gamePk)) return c.json({ error: 'invalid_input', message: 'gamePk must be an integer' }, 400);
    const game = await getGame(gamePk);
    if (!game) return c.json({ error: 'not_found', message: `No game ${gamePk}.` }, 404);
    return c.json(game);
  })
  // Analyze a caller-supplied game dataset via any channel: inline JSON array, an
  // https URL the server fetches, or a multipart JSON file upload. One central
  // resolver; bad input fast-fails with 400.
  .post('/api/analyze', async (c) => {
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
  })
  .get('/api/schema/input.json', (c) => {
    c.header('content-type', 'application/schema+json');
    return c.body(JSON.stringify(analyzeInputJsonSchema, null, 2));
  })
  .get('/api/schema/output.json', (c) => {
    c.header('content-type', 'application/schema+json');
    return c.body(JSON.stringify(analyzeOutputJsonSchema, null, 2));
  })
  .post('/api/rag', zValidator('json', z.object({ question: z.string().min(1) })), async (c) => {
    const { question } = c.req.valid('json');
    return c.json(await ragAnswer(question));
  })
  .post('/api/logs', zValidator('json', logEntrySchema), (c) => {
    serverLog.client(c.req.valid('json'));
    return c.json({ ok: true });
  });

const transport = new StreamableHTTPTransport();
app.all('/mcp', async (c) => {
  // Connecting an already-connected server throws; guard so the singleton binds once.
  if (!mcpServer.isConnected()) {
    await mcpServer.connect(transport);
  }
  return transport.handleRequest(c);
});

export { app };
export type AppType = typeof routes;
