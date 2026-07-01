import { analyzeInputSchema, analyzeResultSchema } from '@shared/mlb';
import { buildJsonSchema } from '../lib/json-schema';

// Input contract for POST /api/analyze: an array of caller-supplied game lines.
export const analyzeInputJsonSchema = buildJsonSchema(
  analyzeInputSchema,
  'https://agent-canvas.local/schemas/mlb-analyze-input.json',
  'MLB Analyze Input',
);

// Output contract: the computed summary the endpoint and the analyze_dataset tool return.
export const analyzeOutputJsonSchema = buildJsonSchema(
  analyzeResultSchema,
  'https://agent-canvas.local/schemas/mlb-analyze-output.json',
  'MLB Analyze Output',
);
