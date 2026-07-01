import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, sql } from '../../server/db/client';
import { homeruns } from '../../server/db/schema';

// Loads the Google Cloud x MLB Hackathon home-run CSVs into the `homeruns`
// staging table, which load-stats reads to build stats_homeruns (the play_id
// GUID bridges to stats_pitches). Point MLB_HOMERUNS_DIR at the local dataset
// directory (the CSVs are not committed); defaults to a gitignored feeds dir.
const DATASETS = process.env.MLB_HOMERUNS_DIR ?? 'db/feeds/homeruns';
const SEASONS = [2016, 2017, 2024];
const BATCH = 1000;

function num(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

interface HomerunRow {
  season: number;
  playId: string;
  title: string;
  exitVelocity: number | null;
  hitDistance: number | null;
  launchAngle: number | null;
  video: string;
}

// Only the title can contain commas, so anchor on the fixed first (play_id) and
// last four (numbers + video URL) columns and rejoin everything between as title.
function parseCsv(text: string, season: number): HomerunRow[] {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  lines.shift();
  return lines.map((line) => {
    const p = line.split(',');
    return {
      season,
      playId: p[0],
      title: p.slice(1, p.length - 4).join(','),
      exitVelocity: num(p[p.length - 4]),
      hitDistance: num(p[p.length - 3]),
      launchAngle: num(p[p.length - 2]),
      video: p[p.length - 1],
    };
  });
}

async function main(): Promise<void> {
  let total = 0;
  for (const season of SEASONS) {
    const rows = parseCsv(readFileSync(join(DATASETS, `${season}-mlb-homeruns.csv`), 'utf8'), season);
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.insert(homeruns).values(rows.slice(i, i + BATCH)).onConflictDoNothing();
    }
    total += rows.length;
    console.log(`loaded ${rows.length} rows for ${season}`);
  }
  console.log(`done: ${total} rows processed`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
