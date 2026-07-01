import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';

const DIR = 'db/embeddings';
const OUT = `${DIR}/embed-output.jsonl`;

interface BatchMeta {
  batches: { batch_id: string }[];
}

async function main(): Promise<void> {
  const meta = JSON.parse(readFileSync(`${DIR}/batches.json`, 'utf8')) as BatchMeta;
  const openai = new OpenAI();
  writeFileSync(OUT, '');
  let allDone = true;
  let written = 0;

  for (const b of meta.batches) {
    const batch = await openai.batches.retrieve(b.batch_id);
    const c = batch.request_counts;
    console.log(`${b.batch_id}: ${batch.status} (${c?.completed ?? 0}/${c?.total ?? 0}, failed ${c?.failed ?? 0})`);
    if (batch.status !== 'completed' || !batch.output_file_id) {
      allDone = false;
      continue;
    }
    const text = await (await openai.files.content(batch.output_file_id)).text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const emb = r.response?.body?.data?.[0]?.embedding;
      if (r.custom_id && Array.isArray(emb)) {
        appendFileSync(OUT, `${JSON.stringify({ id: r.custom_id, embedding: emb })}\n`);
        written += 1;
      }
    }
  }
  console.log(allDone ? `all batches complete; wrote ${written} embeddings -> ${OUT}` : 'not all batches complete yet');
  process.exit(allDone ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
