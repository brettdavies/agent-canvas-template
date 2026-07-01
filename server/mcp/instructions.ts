const ENDPOINT = 'http://localhost:3000/mcp';

export function buildInstructions(): string {
  return [
    `agent-canvas exposes its data over a streamable HTTP MCP server at ${ENDPOINT}, no auth.`,
    'Tools wrap the same queries the REST API uses, so the MCP surface and /api stay in lockstep.',
    'Surface: now (database time — proves the MCP -> Drizzle -> Postgres path); list_teams / query_games / get_game',
    '(the durable MLB dataset); analyze_dataset (stats over a caller-supplied game list); rag_answer',
    '(retrieval-augmented answers over the knowledge base + durable data + live scores).',
  ].join(' ');
}
