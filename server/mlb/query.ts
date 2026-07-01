import type { GameSummary, GamesQuery } from '@shared/mlb';
import { and, desc, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/client';
import { statsGames, statsLinescore, statsPlays, statsTeams, statsVenues } from '../db/schema';

export async function listTeams() {
  return db
    .select({
      mlbId: statsTeams.mlbId,
      name: statsTeams.name,
      abbreviation: statsTeams.abbreviation,
      leagueName: statsTeams.leagueName,
      divisionName: statsTeams.divisionName,
      active: statsTeams.active,
    })
    .from(statsTeams)
    .orderBy(statsTeams.name);
}

const away = alias(statsTeams, 'away_team');
const home = alias(statsTeams, 'home_team');
const venue = alias(statsVenues, 'venue');

const gameCols = {
  id: statsGames.id,
  gamePk: statsGames.gamePk,
  officialDate: statsGames.officialDate,
  season: statsGames.season,
  gameType: statsGames.gameType,
  status: statsGames.statusDetailed,
  venue: venue.name,
  awayId: away.mlbId,
  awayName: away.name,
  awayScore: statsGames.awayScore,
  homeId: home.mlbId,
  homeName: home.name,
  homeScore: statsGames.homeScore,
};

interface GameRow {
  id: string;
  gamePk: number;
  officialDate: string | null;
  season: number | null;
  gameType: string | null;
  status: string | null;
  venue: string | null;
  awayId: number | null;
  awayName: string | null;
  awayScore: number | null;
  homeId: number | null;
  homeName: string | null;
  homeScore: number | null;
}

function toSummary(r: GameRow): GameSummary {
  return {
    gamePk: r.gamePk,
    officialDate: r.officialDate,
    season: r.season,
    gameType: r.gameType,
    status: r.status,
    venue: r.venue,
    away: { id: r.awayId, name: r.awayName, score: r.awayScore },
    home: { id: r.homeId, name: r.homeName, score: r.homeScore },
  };
}

export async function queryGames(q: GamesQuery): Promise<GameSummary[]> {
  const clauses = [];
  if (q.season !== undefined) clauses.push(eq(statsGames.season, q.season));
  if (q.date !== undefined) clauses.push(eq(statsGames.officialDate, q.date));
  if (q.teamId !== undefined) clauses.push(or(eq(away.mlbId, q.teamId), eq(home.mlbId, q.teamId)));

  const rows = await db
    .select(gameCols)
    .from(statsGames)
    .leftJoin(away, eq(statsGames.awayTeamId, away.id))
    .leftJoin(home, eq(statsGames.homeTeamId, home.id))
    .leftJoin(venue, eq(statsGames.venueId, venue.id))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(statsGames.officialDate))
    .limit(q.limit);
  return rows.map(toSummary);
}

export interface GameDetail {
  game: GameSummary;
  linescore: {
    inning: number | null;
    away: { runs: number | null; hits: number | null; errors: number | null };
    home: { runs: number | null; hits: number | null; errors: number | null };
  }[];
  scoringPlays: {
    inning: number | null;
    halfInning: string | null;
    event: string | null;
    description: string | null;
    rbi: number | null;
  }[];
}

export async function getGame(gamePk: number): Promise<GameDetail | null> {
  const [g] = await db
    .select(gameCols)
    .from(statsGames)
    .leftJoin(away, eq(statsGames.awayTeamId, away.id))
    .leftJoin(home, eq(statsGames.homeTeamId, home.id))
    .leftJoin(venue, eq(statsGames.venueId, venue.id))
    .where(eq(statsGames.gamePk, gamePk))
    .limit(1);
  if (!g) return null;

  const [innings, plays] = await Promise.all([
    db
      .select({
        inning: statsLinescore.inning,
        awayRuns: statsLinescore.awayRuns,
        awayHits: statsLinescore.awayHits,
        awayErrors: statsLinescore.awayErrors,
        homeRuns: statsLinescore.homeRuns,
        homeHits: statsLinescore.homeHits,
        homeErrors: statsLinescore.homeErrors,
      })
      .from(statsLinescore)
      .where(eq(statsLinescore.gameId, g.id))
      .orderBy(statsLinescore.inning),
    db
      .select({
        inning: statsPlays.inning,
        halfInning: statsPlays.halfInning,
        event: statsPlays.event,
        description: statsPlays.description,
        rbi: statsPlays.rbi,
      })
      .from(statsPlays)
      .where(and(eq(statsPlays.gameId, g.id), eq(statsPlays.isScoringPlay, true)))
      .orderBy(statsPlays.atBatIndex),
  ]);

  return {
    game: toSummary(g),
    linescore: innings.map((i) => ({
      inning: i.inning,
      away: { runs: i.awayRuns, hits: i.awayHits, errors: i.awayErrors },
      home: { runs: i.homeRuns, hits: i.homeHits, errors: i.homeErrors },
    })),
    scoringPlays: plays,
  };
}
