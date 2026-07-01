import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';

// Drives the embedding batches to completion. The org has a 3M enqueued-token
// cap for text-embedding-3-small, so a chunk can land in `failed` with
// token_limit_exceeded; this resubmits it once the other batches drain.
const META = 'db/embeddings/batches.json';
const POLL_MS = 5 * 60 * 1000;
const BAD = new Set(['failed', 'expired', 'cancelled']);
const PENDING = new Set(['validating', 'in_progress', 'finalizing']);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface BatchEntry {
  batch_id: string;
  input_file: string;
  input_file_id?: string;
  status?: string;
}
interface Meta {
  model: string;
  submitted_at: string;
  batches: BatchEntry[];
}

async function main(): Promise<void> {
  const openai = new OpenAI();
  const meta = JSON.parse(readFileSync(META, 'utf8')) as Meta;

  for (;;) {
    const statuses = await Promise.all(meta.batches.map((b) => openai.batches.retrieve(b.batch_id)));
    statuses.forEach((s, i) => {
      const c = s.request_counts;
      console.log(`${meta.batches[i].batch_id} [${meta.batches[i].input_file}]: ${s.status} (${c?.completed ?? 0}/${c?.total ?? 0})`);
    });

    if (statuses.every((s) => s.status === 'completed')) {
      console.log('ALL BATCHES COMPLETE');
      return;
    }

    const anyPending = statuses.some((s) => PENDING.has(s.status));
    for (let i = 0; i < meta.batches.length; i += 1) {
      if (!BAD.has(statuses[i].status)) {
        continue;
      }
      if (anyPending) {
        console.log(`  deferring resubmit of ${meta.batches[i].input_file} until pending batches finish`);
        continue;
      }
      const b = meta.batches[i];
      console.log(`resubmitting ${b.input_file}`);
      const file = await openai.files.create({ file: createReadStream(b.input_file), purpose: 'batch' });
      const nb = await openai.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/embeddings',
        completion_window: '24h',
      });
      b.batch_id = nb.id;
      b.input_file_id = nb.input_file_id;
      b.status = nb.status;
      writeFileSync(META, JSON.stringify(meta, null, 2));
      console.log(`  -> ${nb.id} (${nb.status})`);
    }
    await sleep(POLL_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
