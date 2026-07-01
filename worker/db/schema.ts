import type { GameSummary, GamesQuery } from '@shared/mlb';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Edge (D1/SQLite) mirror of the Postgres MLB tables (server/db/schema.ts), kept
// deliberately small: the Worker serves a fixture-sized slice for the agent surface,
// while the full stats_* dataset + pgvector RAG live on the Node/Postgres side.
// Games denormalize the two team names/scores so listing needs no join on D1.
export const statsTeams = sqliteTable('stats_teams', {
  mlbId: integer('mlb_id').primaryKey(),
  name: text('name'),
  abbreviation: text('abbreviation'),
  leagueName: text('league_name'),
  divisionName: text('division_name'),
  active: integer('active', { mode: 'boolean' }),
});

export const statsGames = sqliteTable('stats_games', {
  gamePk: integer('game_pk').primaryKey(),
  season: integer('season'),
  gameType: text('game_type'),
  officialDate: text('official_date'),
  awayTeamId: integer('away_team_id'),
  awayName: text('away_name'),
  awayScore: integer('away_score'),
  homeTeamId: integer('home_team_id'),
  homeName: text('home_name'),
  homeScore: integer('home_score'),
  statusDetailed: text('status_detailed'),
  venueName: text('venue_name'),
});

function toSummary(r: typeof statsGames.$inferSelect): GameSummary {
  return {
    gamePk: r.gamePk,
    officialDate: r.officialDate,
    season: r.season,
    gameType: r.gameType,
    status: r.statusDetailed,
    venue: r.venueName,
    away: { id: r.awayTeamId, name: r.awayName, score: r.awayScore },
    home: { id: r.homeTeamId, name: r.homeName, score: r.homeScore },
  };
}

export async function loadTeams(db: DrizzleD1Database) {
  return db.select().from(statsTeams).orderBy(statsTeams.name);
}

export async function queryGames(db: DrizzleD1Database, q: GamesQuery): Promise<GameSummary[]> {
  const clauses = [];
  if (q.season !== undefined) clauses.push(eq(statsGames.season, q.season));
  if (q.date !== undefined) clauses.push(eq(statsGames.officialDate, q.date));
  if (q.teamId !== undefined) {
    clauses.push(sql`(${statsGames.awayTeamId} = ${q.teamId} or ${statsGames.homeTeamId} = ${q.teamId})`);
  }
  const where = clauses.length ? and(...clauses) : undefined;
  const rows = await db.select().from(statsGames).where(where).orderBy(desc(statsGames.officialDate)).limit(q.limit);
  return rows.map(toSummary);
}

export async function getGame(db: DrizzleD1Database, gamePk: number): Promise<GameSummary | null> {
  const [row] = await db.select().from(statsGames).where(eq(statsGames.gamePk, gamePk)).limit(1);
  return row ? toSummary(row) : null;
}
