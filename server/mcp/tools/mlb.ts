import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeGameSchema, analyzeGames, gamesQuerySchema, MAX_ANALYZE_GAMES } from '@shared/mlb';
import { z } from 'zod';
import { resolveDataset } from '../../ingest/resolve';
import { getGame, listTeams, queryGames } from '../../mlb/query';

function textContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function registerMlbTools(server: McpServer): void {
  server.tool('list_teams', 'List the MLB teams in the durable dataset.', {}, async () =>
    textContent(await listTeams()),
  );

  server.tool(
    'query_games',
    'Query stored MLB games. All args optional: `season` (year), `teamId` (MLB team id, matches home or away), ' +
      '`date` (YYYY-MM-DD), `limit` (1-100, default 20). Returns game summaries newest first.',
    gamesQuerySchema.shape,
    async (a) => textContent(await queryGames(gamesQuerySchema.parse(a))),
  );

  server.tool(
    'get_game',
    'Get one stored game by its StatsAPI `gamePk`, rolled up: summary, per-inning linescore, and scoring plays. ' +
      'Returns null if the game is not loaded.',
    { gamePk: z.number().int().describe('StatsAPI gamePk.') },
    async ({ gamePk }) => textContent(await getGame(gamePk)),
  );

  server.tool(
    'analyze_dataset',
    'Analyze a caller-supplied MLB game dataset (no database) and return computed summary stats (run totals, ' +
      'averages, shutouts, highest-scoring game, per-team records). Provide the games exactly one of two ways: ' +
      '`games` as an inline array of game lines ({ gamePk?, officialDate?, away:{name,score}, home:{name,score} }), ' +
      'or `games_url` as an https URL to a JSON array of those lines (fetched + validated server-side).',
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
}
