import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHealthTools } from './health';
import { registerMlbTools } from './mlb';
import { registerRagTools } from './rag';

export function registerTools(server: McpServer): void {
  registerHealthTools(server);
  registerMlbTools(server);
  registerRagTools(server);
}
