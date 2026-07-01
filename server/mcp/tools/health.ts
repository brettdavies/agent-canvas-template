import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sql } from '../../db/client';

function textContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function registerHealthTools(server: McpServer): void {
  server.tool(
    'now',
    'Return the current database time as { now }. Proves the MCP server reaches Postgres through the same ' +
      'postgres.js client the REST API uses.',
    {},
    async () => {
      const [row] = await sql<{ now: string }[]>`select now() as now`;
      return textContent({ now: row.now });
    },
  );
}
