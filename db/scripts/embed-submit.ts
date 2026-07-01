import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';
import { sql } from '../../server/db/client';

const MODEL = 'text-embedding-3-small';
const MAX_PER_BATCH = 45000; // under OpenAI's 50k requests/batch limit
const TOKEN_CAP = 6_000_000; // safety: abort if the estimate exceeds this (expected ~3.4M)
const DIR = 'db/embeddings';
const DRY_RUN = process.argv.includes('--dry-run');

interface Row {
  id: string;
  content: string;
}

async function main(): Promise<void> {
  mkdirSync(DIR, { recursive: true });
  const rows = await sql<Row[]>`
    select id, content from stats_embeddings
    where embedding is null and coalesce(content, '') <> ''`;
  console.log(`rows to embed: ${rows.length.toLocaleString()}`);

  const chars = rows.reduce((a, r) => a + r.content.length, 0);
  const estTokens = Math.ceil(chars / 4);
  console.log(`est tokens: ${estTokens.toLocaleString()}  est batch cost: $${((estTokens / 1e6) * 0.01).toFixed(4)}`);
  if (estTokens > TOKEN_CAP) {
    console.error(`ABORT: token estimate ${estTokens} exceeds safety cap ${TOKEN_CAP}`);
    process.exit(1);
  }
  if (rows.length === 0) {
    console.log('nothing to embed.');
    await sql.end();
    return;
  }

  const files: string[] = [];
  for (let i = 0; i < rows.length; i += MAX_PER_BATCH) {
    const chunk = rows.slice(i, i + MAX_PER_BATCH);
    const body = chunk
      .map((r) =>
        JSON.stringify({
          custom_id: r.id,
          method: 'POST',
          url: '/v1/embeddings',
          body: { model: MODEL, input: r.content },
        }),
      )
      .join('\n');
    const path = `${DIR}/batch-input-${files.length}.jsonl`;
    writeFileSync(path, `${body}\n`);
    files.push(path);
  }
  console.log(`wrote ${files.length} batch input file(s)`);

  if (DRY_RUN) {
    console.log('dry-run: not uploading to OpenAI.');
    await sql.end();
    return;
  }

  const openai = new OpenAI();
  const meta = [];
  for (const path of files) {
    const file = await openai.files.create({ file: createReadStream(path), purpose: 'batch' });
    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/embeddings',
      completion_window: '24h',
    });
    meta.push({ input_file: path, input_file_id: file.id, batch_id: batch.id, status: batch.status });
    console.log(`submitted batch ${batch.id} (${path}) status=${batch.status}`);
  }
  writeFileSync(
    `${DIR}/batches.json`,
    JSON.stringify({ model: MODEL, submitted_at: new Date().toISOString(), batches: meta }, null, 2),
  );
  console.log(`saved ${DIR}/batches.json (${meta.length} batch(es))`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
