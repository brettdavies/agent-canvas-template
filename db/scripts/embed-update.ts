import { readFileSync } from 'node:fs';
import { sql } from '../../server/db/client';

const MODEL = 'text-embedding-3-small';
const OUT = 'db/embeddings/embed-output.jsonl';
const CHUNK = 1000;

interface Result {
  id: string;
  embedding: number[];
}

async function main(): Promise<void> {
  const rows = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Result);
  console.log(`updating ${rows.length.toLocaleString()} embeddings`);

  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const ids = batch.map((r) => r.id);
    const embs = batch.map((r) => `[${r.embedding.join(',')}]`);
    await sql`
      update stats_embeddings as e
      set embedding = data.emb::vector, model = ${MODEL}
      from (select unnest(${ids}::uuid[]) as id, unnest(${embs}::text[]) as emb) as data
      where e.id = data.id`;
    done += batch.length;
    if (done % 20000 === 0) console.log(`  ${done.toLocaleString()}/${rows.length.toLocaleString()}`);
  }

  const [{ remaining }] = await sql<{ remaining: number }[]>`
    select count(*)::int as remaining from stats_embeddings where embedding is null`;
  console.log(`done: updated ${done.toLocaleString()}; rows still NULL: ${remaining}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
