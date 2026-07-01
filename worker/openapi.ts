import { analyzeInputSchema, analyzeResultSchema } from '@shared/mlb';
import type { z } from 'zod';
import { toJsonSchema } from '../server/lib/json-schema';

// The public origin the Worker is deployed to; set to your domain before deploy.
const BASE = 'https://agent-canvas.example';

// OpenAPI 3.1 uses JSON Schema 2020-12 for component schemas, so the Zod-derived
// schemas drop straight in. Strip the per-schema $schema dialect marker, which only
// belongs on a standalone schema document, not on an inlined component.
function component(schema: z.ZodType): Record<string, unknown> {
  const json = toJsonSchema(schema);
  delete json.$schema;
  return json;
}

const jsonResponse = (description: string, ref: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: ref } } },
});

const errorResponse = (description: string) => jsonResponse(description, '#/components/schemas/Error');

const teamLine = { $ref: '#/components/schemas/TeamLine' };

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'MLB agent-canvas API',
    version: '0.1.0',
    description:
      'REST surface for a stored MLB game dataset: list teams, query games, fetch one game, and analyze a posted ' +
      'game list. The same operations are exposed over MCP at /mcp (see /mcp-skill.md and the server card at ' +
      '/.well-known/mcp/server-card.json). Endpoints are authless and rate-limited per IP.',
  },
  servers: [{ url: BASE }],
  paths: {
    '/api/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Liveness probe backed by a D1 round-trip.',
        responses: { '200': jsonResponse('Service is up.', '#/components/schemas/Health') },
      },
    },
    '/api/teams': {
      get: {
        operationId: 'listTeams',
        summary: 'The MLB teams in the stored dataset.',
        responses: { '200': jsonResponse('The stored teams.', '#/components/schemas/TeamsList') },
      },
    },
    '/api/games': {
      get: {
        operationId: 'queryGames',
        summary: 'Query stored games by season, teamId, and/or date; newest first.',
        parameters: [
          { name: 'season', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'teamId', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'date', in: 'query', required: false, schema: { type: 'string' }, description: 'YYYY-MM-DD' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': jsonResponse('Matching game summaries.', '#/components/schemas/GameList'),
          '429': errorResponse('Rate limited.'),
        },
      },
    },
    '/api/games/{gamePk}': {
      get: {
        operationId: 'getGame',
        summary: 'One stored game rolled up (summary, linescore, scoring plays).',
        parameters: [{ name: 'gamePk', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': jsonResponse('The game detail.', '#/components/schemas/GameDetail'),
          '404': errorResponse('No such game.'),
        },
      },
    },
    '/api/analyze': {
      post: {
        operationId: 'analyzeDataset',
        summary:
          'Compute summary stats over a caller-supplied game list. Provide games exactly one way: an inline ' +
          '`games` array, a `games_url` (https, fetched and validated server-side, 5 MB / 10s caps), or a ' +
          'multipart JSON `file`. Capped at 5,000 games; fails fast on invalid input.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AnalyzeRequest' } },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'A JSON array of game lines.' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('The computed summary.', '#/components/schemas/AnalyzeOutput'),
          '400': errorResponse('Invalid input (fail-fast).'),
          '429': errorResponse('Rate limited.'),
        },
      },
    },
    '/api/schema/input.json': {
      get: {
        operationId: 'getInputSchema',
        summary: 'The JSON Schema (2020-12) for the analyze input.',
        responses: {
          '200': {
            description: 'A JSON Schema document.',
            content: { 'application/schema+json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/schema/output.json': {
      get: {
        operationId: 'getOutputSchema',
        summary: 'The JSON Schema (2020-12) for the analyze output.',
        responses: {
          '200': {
            description: 'A JSON Schema document.',
            content: { 'application/schema+json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApi',
        summary: 'This OpenAPI 3.1 description.',
        responses: {
          '200': {
            description: 'The OpenAPI document.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/logs': {
      post: {
        operationId: 'postLog',
        summary: 'Fire-and-forget client log sink; the body is accepted and acknowledged.',
        responses: { '200': jsonResponse('Acknowledged.', '#/components/schemas/Ack') },
      },
    },
  },
  components: {
    schemas: {
      AnalyzeInput: component(analyzeInputSchema),
      AnalyzeOutput: component(analyzeResultSchema),
      AnalyzeRequest: {
        type: 'object',
        properties: {
          games: { $ref: '#/components/schemas/AnalyzeInput' },
          games_url: { type: 'string', description: 'https URL to a JSON array of game lines.' },
        },
      },
      TeamLine: {
        type: 'object',
        properties: {
          id: { type: ['integer', 'null'] },
          name: { type: ['string', 'null'] },
          score: { type: ['integer', 'null'] },
        },
      },
      GameSummary: {
        type: 'object',
        properties: {
          gamePk: { type: 'integer' },
          officialDate: { type: ['string', 'null'] },
          season: { type: ['integer', 'null'] },
          gameType: { type: ['string', 'null'] },
          status: { type: ['string', 'null'] },
          venue: { type: ['string', 'null'] },
          away: teamLine,
          home: teamLine,
        },
      },
      GameList: { type: 'array', items: { $ref: '#/components/schemas/GameSummary' } },
      GameDetail: {
        type: 'object',
        properties: {
          game: { $ref: '#/components/schemas/GameSummary' },
          linescore: { type: 'array', items: { type: 'object', additionalProperties: true } },
          scoringPlays: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      TeamsList: { type: 'array', items: { type: 'object', additionalProperties: true } },
      Health: {
        type: 'object',
        required: ['status', 'now'],
        properties: { status: { type: 'string' }, now: { type: ['string', 'null'] } },
      },
      Ack: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: { error: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
};
