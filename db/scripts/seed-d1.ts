import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generate db/fixtures/seed-d1.sql (INSERT OR REPLACE for the D1 stats_teams +
// stats_games slice) from the same fixture the Postgres seed uses. No DB or wrangler
// needed to generate; apply the SQL with the printed wrangler command.
interface Fixture {
  teams: { mlbId: number; name: string; abbreviation: string; leagueName: string | null; divisionName: string | null; active: boolean }[];
  games: {
    gamePk: number;
    season: number;
    gameType: string | null;
    officialDate: string | null;
    awayId: number | null;
    awayName: string | null;
    awayScore: number | null;
    homeId: number | null;
    homeName: string | null;
    homeScore: number | null;
    statusDetailed: string | null;
    venueName: string | null;
  }[];
}

const DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(DIR, '..', 'fixtures', 'mlb-seed.json');
const OUT = join(DIR, '..', 'fixtures', 'seed-d1.sql');

function q(v: string | number | null): string {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

const fx = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture;
const lines: string[] = [];
for (const t of fx.teams) {
  lines.push(
    'INSERT OR REPLACE INTO stats_teams (mlb_id,name,abbreviation,league_name,division_name,active) VALUES ' +
      `(${q(t.mlbId)},${q(t.name)},${q(t.abbreviation)},${q(t.leagueName)},${q(t.divisionName)},${t.active ? 1 : 0});`,
  );
}
for (const g of fx.games) {
  lines.push(
    'INSERT OR REPLACE INTO stats_games (game_pk,season,game_type,official_date,away_team_id,away_name,away_score,' +
      'home_team_id,home_name,home_score,status_detailed,venue_name) VALUES ' +
      `(${q(g.gamePk)},${q(g.season)},${q(g.gameType)},${q(g.officialDate)},${q(g.awayId)},${q(g.awayName)},` +
      `${q(g.awayScore)},${q(g.homeId)},${q(g.homeName)},${q(g.homeScore)},${q(g.statusDetailed)},${q(g.venueName)});`,
  );
}
writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`wrote ${lines.length} statements to ${OUT}`);
console.log('Apply locally: wrangler d1 execute agent-canvas --local --file=db/fixtures/seed-d1.sql');
console.log('Apply remote:  wrangler d1 execute agent-canvas --remote --file=db/fixtures/seed-d1.sql');
