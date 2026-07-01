import { describe, expect, it } from 'vitest';
import { insertNoteSchema } from './schema';

describe('insertNoteSchema (drizzle-zod single source of truth)', () => {
  it('accepts a valid note body', () => {
    expect(insertNoteSchema.parse({ body: 'hello' }).body).toBe('hello');
  });

  it('rejects a missing body', () => {
    expect(() => insertNoteSchema.parse({})).toThrow();
  });
});
