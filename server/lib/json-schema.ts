import { z } from 'zod';

// Zod stamps every `.int()` with the JS safe-integer range; drop those sentinels so
// the published schema shows only the bounds we actually mean.
const SAFE_MAX = Number.MAX_SAFE_INTEGER;
const SAFE_MIN = Number.MIN_SAFE_INTEGER;

function pruneSafeIntBounds(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(pruneSafeIntBounds);
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.maximum === SAFE_MAX) delete obj.maximum;
    if (obj.minimum === SAFE_MIN) delete obj.minimum;
    for (const key of Object.keys(obj)) obj[key] = pruneSafeIntBounds(obj[key]);
    return obj;
  }
  return node;
}

// Zod -> JSON Schema (2020-12) with the safe-int sentinels pruned. Shared by the
// published /api/schema/*.json documents and the OpenAPI 3.1 component schemas.
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return pruneSafeIntBounds(z.toJSONSchema(schema, { target: 'draft-2020-12' })) as Record<string, unknown>;
}

export function buildJsonSchema(schema: z.ZodType, id: string, title: string): Record<string, unknown> {
  return { ...toJsonSchema(schema), $id: id, title };
}
