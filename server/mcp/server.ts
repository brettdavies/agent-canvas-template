import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildInstructions } from './instructions';
import { registerTools } from './tools';

const SERVER_NAME = 'agent-canvas';
const SERVER_VERSION = '0.1.0';

export const mcpServer = new McpServer(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} }, instructions: buildInstructions() },
);

registerTools(mcpServer);
