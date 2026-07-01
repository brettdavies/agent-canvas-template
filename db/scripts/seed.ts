import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, sql } from '../../server/db/client';
import { statsGames, statsTeams, statsVenues } from '../../server/db/schema';

// Load the committed sample fixture (db/fixtures/mlb-seed.json) into Postgres so the
// query endpoints and MCP tools have data out of the box, no external feeds required.
// The full pipeline (real games + embeddings) lives in db/scripts/load-*.ts.
interface Fixture {
  teams: { mlbId: number; name: string; abbreviation: string; leagueName: string | null; divisionName: string | null; active: boolean }[];
  venues: { mlbId: number; name: string | null }[];
  games: {
    gamePk: number;
    season: number;
    gameType: string | null;
    officialDate: string | null;
    awayId: number | null;
    awayScore: number | null;
    homeId: number | null;
    homeScore: number | null;
    statusDetailed: string | null;
    venueMlbId: number | null;
  }[];
}

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'mlb-seed.json');

async function main(): Promise<void> {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture;

  await db
    .insert(statsTeams)
    .values(
      fx.teams.map((t) => ({
        mlbId: t.mlbId,
        name: t.name,
        abbreviation: t.abbreviation,
        leagueName: t.leagueName,
        divisionName: t.divisionName,
        active: t.active,
      })),
    )
    .onConflictDoNothing();
  const teamRows = await db.select({ id: statsTeams.id, mlbId: statsTeams.mlbId }).from(statsTeams);
  const teamMap = new Map(teamRows.map((r) => [r.mlbId, r.id]));

  await db
    .insert(statsVenues)
    .values(fx.venues.map((v) => ({ mlbId: v.mlbId, name: v.name })))
    .onConflictDoNothing();
  const venueRows = await db.select({ id: statsVenues.id, mlbId: statsVenues.mlbId }).from(statsVenues);
  const venueMap = new Map(venueRows.map((r) => [r.mlbId, r.id]));

  await db
    .insert(statsGames)
    .values(
      fx.games.map((g) => ({
        gamePk: g.gamePk,
        season: g.season,
        gameType: g.gameType,
        officialDate: g.officialDate,
        awayTeamId: g.awayId != null ? teamMap.get(g.awayId) : undefined,
        homeTeamId: g.homeId != null ? teamMap.get(g.homeId) : undefined,
        awayScore: g.awayScore,
        homeScore: g.homeScore,
        venueId: g.venueMlbId != null ? venueMap.get(g.venueMlbId) : undefined,
        statusDetailed: g.statusDetailed,
      })),
    )
    .onConflictDoNothing();

  console.log(`seeded ${fx.teams.length} teams, ${fx.venues.length} venues, ${fx.games.length} games`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
