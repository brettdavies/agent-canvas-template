import type { z } from 'zod';

// One central validator for caller-supplied datasets. Every input channel (inline
// array, https URL, uploaded file) resolves to a JSON array and is validated against
// a caller-provided element schema here — REST and MCP both call it, so the rules
// live in exactly one place.

const MAX_URL_BYTES = 5 * 1024 * 1024; // 5 MB
const URL_TIMEOUT_MS = 10_000;

// Distinguishes bad input (client's fault -> 400) from unexpected failures (-> 500).
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export interface DataSource {
  data?: unknown;
  url?: string;
  fileText?: string;
}

export interface ResolveOptions {
  maxItems: number;
  label?: string;
}

function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  const at = issue.path.length ? ` at [${issue.path.join('.')}]` : '';
  return `${issue.message}${at}`;
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new InputError(`${label} is not valid JSON`);
  }
}

async function fetchUrl(rawUrl: string): Promise<unknown> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InputError('url is not a valid URL');
  }
  if (url.protocol !== 'https:') {
    throw new InputError('url must use https');
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), URL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { accept: 'application/json' } });
  } catch (err) {
    throw new InputError(`could not fetch url: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new InputError(`url returned HTTP ${res.status}`);
  }
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > MAX_URL_BYTES) {
    throw new InputError('url response exceeds 5 MB');
  }
  const text = await res.text();
  if (text.length > MAX_URL_BYTES) {
    throw new InputError('url response exceeds 5 MB');
  }
  return parseJson(text, 'url response');
}

// Resolve exactly one source channel to a validated array of `element`.
export async function resolveDataset<T>(input: DataSource, element: z.ZodType<T>, opts: ResolveOptions): Promise<T[]> {
  const label = opts.label ?? 'records';
  const provided = [input.data !== undefined, input.url !== undefined, input.fileText !== undefined].filter(
    Boolean,
  ).length;
  if (provided === 0) {
    throw new InputError(`no ${label} source provided`);
  }
  if (provided > 1) {
    throw new InputError(`provide exactly one ${label} source`);
  }

  let raw: unknown;
  if (input.url !== undefined) raw = await fetchUrl(input.url);
  else if (input.fileText !== undefined) raw = parseJson(input.fileText, 'uploaded file');
  else raw = input.data;

  if (!Array.isArray(raw)) {
    throw new InputError(`${label} must be a JSON array`);
  }
  if (raw.length > opts.maxItems) {
    throw new InputError(`too many ${label}: ${raw.length} (max ${opts.maxItems})`);
  }

  const parsed = element.array().safeParse(raw);
  if (!parsed.success) {
    throw new InputError(`invalid ${label} record: ${firstIssue(parsed.error)}`);
  }
  return parsed.data;
}
