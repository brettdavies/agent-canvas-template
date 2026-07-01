import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InputError, resolveDataset } from './resolve';

const el = z.object({ n: z.number() });
const opts = { maxItems: 10, label: 'items' };

describe('resolveDataset', () => {
  it('accepts an inline array', async () => {
    const out = await resolveDataset({ data: [{ n: 1 }, { n: 2 }] }, el, opts);
    expect(out).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('parses uploaded file text', async () => {
    const out = await resolveDataset({ fileText: JSON.stringify([{ n: 3 }]) }, el, opts);
    expect(out[0].n).toBe(3);
  });

  it('rejects when no source is provided', async () => {
    await expect(resolveDataset({}, el, opts)).rejects.toBeInstanceOf(InputError);
  });

  it('rejects when more than one source is provided', async () => {
    await expect(resolveDataset({ data: [], fileText: '[]' }, el, opts)).rejects.toThrow(/exactly one/);
  });

  it('rejects a non-array payload', async () => {
    await expect(resolveDataset({ data: { nope: true } }, el, opts)).rejects.toThrow(/must be a JSON array/);
  });

  it('enforces maxItems', async () => {
    await expect(resolveDataset({ data: [{ n: 1 }, { n: 2 }] }, el, { maxItems: 1 })).rejects.toThrow(/too many/);
  });

  it('validates each element against the schema', async () => {
    await expect(resolveDataset({ data: [{ n: 'x' }] }, el, opts)).rejects.toThrow(/invalid/);
  });

  it('rejects invalid JSON in an uploaded file', async () => {
    await expect(resolveDataset({ fileText: '{' }, el, opts)).rejects.toThrow(/not valid JSON/);
  });
});
