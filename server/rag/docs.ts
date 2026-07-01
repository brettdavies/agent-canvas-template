import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DocHit {
  docid: string;
  score: number;
  file: string;
  title: string;
  snippet: string;
}

// Retrieve from the local qmd knowledge base (default: the `stars` collection,
// the indexed GitHub stars). `qmd query` writes progress to stderr and the JSON
// array to stdout; slice between the outer brackets so a stray stdout line
// can't break the parse.
export async function retrieveDocs(query: string, limit = 5, collection = 'stars'): Promise<DocHit[]> {
  const { stdout } = await execFileAsync(
    'qmd',
    ['query', query, '--collection', collection, '--format', 'json', '-n', String(limit)],
    { maxBuffer: 16 * 1024 * 1024, timeout: 45_000 },
  );
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  return JSON.parse(stdout.slice(start, end + 1)) as DocHit[];
}
