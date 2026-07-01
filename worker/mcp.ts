import { StreamableHTTPTransport } from '@hono/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeGameSchema, analyzeGames, gamesQuerySchema, MAX_ANALYZE_GAMES } from '@shared/mlb';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolveDataset } from '../server/ingest/resolve';
import { getGame, loadTeams, queryGames } from './db/schema';

const INSTRUCTIONS = [
  'MLB agent-canvas over a stateless streamable-HTTP MCP server, backed by Cloudflare D1.',
  'list_teams / query_games / get_game read the stored games; analyze_dataset computes stats over a posted game list.',
  'The same tools are exposed over REST (see /openapi.json).',
].join(' ');

function textContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

// A fresh server per request: no session state, so plain-curl JSON-RPC works the
// same as an MCP client. Tools mirror server/mcp/tools/mlb.ts but read D1 instead
// of Postgres.
function buildServer(db: DrizzleD1Database): McpServer {
  const server = new McpServer(
    { name: 'agent-canvas', version: '0.1.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  server.tool('list_teams', 'List the MLB teams in the stored dataset.', {}, async () =>
    textContent(await loadTeams(db)),
  );

  server.tool(
    'query_games',
    'Query stored MLB games. All args optional: `season` (year), `teamId` (MLB team id, matches home or away), ' +
      '`date` (YYYY-MM-DD), `limit` (1-100, default 20). Returns game summaries newest first.',
    gamesQuerySchema.shape,
    async (a) => textContent(await queryGames(db, gamesQuerySchema.parse(a))),
  );

  server.tool(
    'get_game',
    'Get one stored game summary by its StatsAPI `gamePk`. Returns null if the game is not loaded.',
    { gamePk: z.number().int().describe('StatsAPI gamePk.') },
    async ({ gamePk }) => textContent(await getGame(db, gamePk)),
  );

  server.tool(
    'analyze_dataset',
    'Analyze a caller-supplied MLB game dataset (no database) and return computed summary stats. Provide the games ' +
      'exactly one of two ways: `games` as an inline array of game lines ({ gamePk?, officialDate?, away:{name,score}, ' +
      'home:{name,score} }), or `games_url` as an https URL to a JSON array of those lines.',
    {
      games: z.array(analyzeGameSchema).max(MAX_ANALYZE_GAMES).optional().describe('Game lines inline.'),
      games_url: z.string().optional().describe('https URL to a JSON array of game lines.'),
    },
    async (a) => {
      const games = await resolveDataset({ data: a.games, url: a.games_url }, analyzeGameSchema, {
        maxItems: MAX_ANALYZE_GAMES,
        label: 'games',
      });
      return textContent(analyzeGames(games));
    },
  );

  // Registering tools makes the SDK advertise tools.listChanged: true, but a stateless
  // server holds no connection and can never push a list-changed notification. Declare
  // the honest capability (merged last, so it wins) so `initialize` matches the server card.
  server.server.registerCapabilities({ tools: { listChanged: false } });

  return server;
}

// Stateless streamable-HTTP: build a server + transport for this one request,
// return a plain JSON-RPC response body (enableJsonResponse) so curl clients work.
export async function handleMcp(c: Context, db: DrizzleD1Database): Promise<Response> {
  const server = buildServer(db);
  const transport = new StreamableHTTPTransport({ enableJsonResponse: true });
  await server.connect(transport);
  const res = await transport.handleRequest(c);
  return res ?? c.body(null, 204);
}
