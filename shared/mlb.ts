import { z } from 'zod';

// Cross-boundary MLB shapes (non-DB), shared by the Node server, the Worker, and the
// frontend. Pure TypeScript + Zod + a pure analyzer, so the Worker can import them too.

export interface GameTeamLine {
  id: number | null;
  name: string | null;
  score: number | null;
}

export interface GameSummary {
  gamePk: number;
  officialDate: string | null;
  season: number | null;
  gameType: string | null;
  status: string | null;
  venue: string | null;
  away: GameTeamLine;
  home: GameTeamLine;
}

// Query params for GET /api/games. Coerced because they arrive as query strings.
export const gamesQuerySchema = z.object({
  season: z.coerce.number().int().optional(),
  teamId: z.coerce.number().int().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GamesQuery = z.infer<typeof gamesQuerySchema>;

// Upper bound on a posted analyze dataset (keeps the Worker CPU bounded).
export const MAX_ANALYZE_GAMES = 5000;

// One game in a caller-supplied dataset: tolerant, since callers post their own JSON.
export const analyzeGameSchema = z.object({
  gamePk: z.number().int().nullable().optional(),
  officialDate: z.string().nullable().optional(),
  away: z
    .object({ name: z.string().nullable().optional(), score: z.number().nullable().optional() })
    .partial()
    .optional(),
  home: z
    .object({ name: z.string().nullable().optional(), score: z.number().nullable().optional() })
    .partial()
    .optional(),
});

export type AnalyzeGame = z.infer<typeof analyzeGameSchema>;

export const analyzeInputSchema = z.array(analyzeGameSchema).min(1).max(MAX_ANALYZE_GAMES);

export const teamRecordSchema = z.object({
  team: z.string(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  runsFor: z.number().int().nonnegative(),
  runsAgainst: z.number().int().nonnegative(),
});

export const analyzeResultSchema = z.object({
  gameCount: z.number().int().nonnegative(),
  scoredGameCount: z.number().int().nonnegative(),
  totalRuns: z.number().int().nonnegative(),
  averageRunsPerGame: z.number().nonnegative(),
  shutouts: z.number().int().nonnegative(),
  highestScoring: z
    .object({
      gamePk: z.number().int().nullable(),
      away: z.string().nullable(),
      home: z.string().nullable(),
      totalRuns: z.number().int().nonnegative(),
    })
    .nullable(),
  teamRecords: z.array(teamRecordSchema),
});

export type AnalyzeResult = z.infer<typeof analyzeResultSchema>;

// Pure aggregation over a caller-supplied dataset. No DB, no network — the same
// function backs POST /api/analyze and the analyze_dataset MCP tool on both surfaces.
export function analyzeGames(games: AnalyzeGame[]): AnalyzeResult {
  let scoredGameCount = 0;
  let totalRuns = 0;
  let shutouts = 0;
  let highestScoring: AnalyzeResult['highestScoring'] = null;
  const records = new Map<string, { wins: number; losses: number; runsFor: number; runsAgainst: number }>();

  const rec = (team: string) => {
    let r = records.get(team);
    if (!r) {
      r = { wins: 0, losses: 0, runsFor: 0, runsAgainst: 0 };
      records.set(team, r);
    }
    return r;
  };

  for (const g of games) {
    const aScore = g.away?.score ?? null;
    const hScore = g.home?.score ?? null;
    const aName = g.away?.name ?? null;
    const hName = g.home?.name ?? null;
    if (aScore == null || hScore == null) continue;

    scoredGameCount += 1;
    const gameRuns = aScore + hScore;
    totalRuns += gameRuns;
    if (aScore === 0 || hScore === 0) shutouts += 1;
    if (!highestScoring || gameRuns > highestScoring.totalRuns) {
      highestScoring = { gamePk: g.gamePk ?? null, away: aName, home: hName, totalRuns: gameRuns };
    }

    if (aName) {
      const r = rec(aName);
      r.runsFor += aScore;
      r.runsAgainst += hScore;
      if (aScore > hScore) r.wins += 1;
      else if (aScore < hScore) r.losses += 1;
    }
    if (hName) {
      const r = rec(hName);
      r.runsFor += hScore;
      r.runsAgainst += aScore;
      if (hScore > aScore) r.wins += 1;
      else if (hScore < aScore) r.losses += 1;
    }
  }

  const teamRecords = [...records.entries()]
    .map(([team, r]) => ({ team, ...r }))
    .sort((a, b) => b.wins - a.wins || b.runsFor - a.runsFor || a.team.localeCompare(b.team));

  return {
    gameCount: games.length,
    scoredGameCount,
    totalRuns,
    averageRunsPerGame: scoredGameCount ? Number((totalRuns / scoredGameCount).toFixed(2)) : 0,
    shutouts,
    highestScoring,
    teamRecords,
  };
}
