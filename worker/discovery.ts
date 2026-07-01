// Agent-discovery documents for the agent-canvas Worker, served at stable well-known
// paths so agents can find the server and its contract. BASE is the public origin the
// Worker is deployed to; set it to your custom domain (or workers.dev URL) before deploy.
const BASE = 'https://agent-canvas.example';

// Canonical MCP server card (SEP-1649 / mcp-server-card v1). Served at
// /.well-known/mcp/server-card.json with the pointer aliases /.well-known/mcp,
// /.well-known/mcp.json, and /mcp.json.
export const serverCard = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
  mcp_endpoint: `${BASE}/mcp`,
  version: '0.1',
  description:
    'MLB agent-canvas: query a stored MLB game dataset and compute stats over a posted game list, over REST and MCP.',
  documentation: `${BASE}/mcp-skill.md`,
  serverInfo: { name: 'agent-canvas', version: '0.1.0' },
  protocolVersion: '2025-06-18',
  url: `${BASE}/mcp`,
  transport: { type: 'streamable-http', endpoint: `${BASE}/mcp` },
  // Only tools are implemented; a stateless server advertises no resources/prompts and
  // can push no list-changed notification. Mirrors the MCP initialize response exactly.
  capabilities: {
    tools: { listChanged: false },
  },
  authentication: { required: false, schemes: [], documentation: `${BASE}/mcp-skill.md` },
} as const;

// Declares AI-training and agent-access posture plus the programmatic entry point.
export const AI_TXT = `# ai.txt for agent-canvas
# Declares AI-training and agent-access posture. Format may evolve as the ai.txt
# convention ratifies; this file is the canonical statement.

User-Agent: *
Allow: /
Allow-AI-Training: yes
Allow-Inference: yes
Programmatic-API: ${BASE}/mcp
`;

export const LLMS_TXT = `# MLB agent-canvas

> An agent-native full-stack canvas with a stored MLB game dataset. Query games and teams, fetch one game rolled up,
> and analyze a posted list of games — all over both REST and a stateless MCP server. The worked example is MLB; the
> canvas underneath is domain-agnostic.

## Programmatic access

- [MCP server (streamable HTTP)](${BASE}/mcp)
- [MCP server card](${BASE}/.well-known/mcp/server-card.json)
- [MCP client skill](${BASE}/mcp-skill.md)
- [OpenAPI 3.1 description](${BASE}/openapi.json)
- [Analyze input JSON Schema](${BASE}/api/schema/input.json)
- [Analyze output JSON Schema](${BASE}/api/schema/output.json)

## REST

- \`GET ${BASE}/api/teams\` : the stored MLB teams.
- \`GET ${BASE}/api/games\` : query stored games by season, teamId, and/or date (YYYY-MM-DD), newest first.
- \`GET ${BASE}/api/games/{gamePk}\` : one stored game summary.
- \`POST ${BASE}/api/analyze\` : compute stats over a supplied game list (inline array, https URL, or JSON file upload).

## How it works

Games are stored in Cloudflare D1 at the edge (a fixture-sized slice) and in Postgres on the Node dev server (the full
dataset plus pgvector RAG). The MCP tools wrap the same reads the REST routes use, so the two surfaces stay in lockstep.
`;

export const LLMS_FULL_TXT = `# MLB agent-canvas (full)

An agent-native full-stack canvas. The worked example queries and analyzes MLB games; the shell (React/Vite + Hono +
Drizzle), the Cloudflare Worker + D1 deploy, the stateless MCP server, and the agent-discovery surface are all
domain-agnostic and meant to be reused.

## Tools (MCP)

- \`list_teams\` : the stored MLB teams.
- \`query_games\` : stored games filtered by \`season\`, \`teamId\` (matches home or away), \`date\` (YYYY-MM-DD),
  \`limit\` (1-100, default 20); newest first.
- \`get_game\` : one stored game summary by StatsAPI \`gamePk\`.
- \`analyze_dataset\` : summary stats (run totals, averages, shutouts, highest-scoring game, per-team records) over a
  caller-supplied game list, provided inline as \`games\` or as \`games_url\`.

All are authless, rate-limited per IP, and mirrored by the REST routes above.

## Analyze input (see ${BASE}/api/schema/input.json)

A JSON array of game lines: \`{ gamePk?, officialDate?, away: { name, score }, home: { name, score } }\`. Supplied
inline, by https URL, or by JSON file upload; every channel is validated against the one schema.

## Analyze output (see ${BASE}/api/schema/output.json)

\`gameCount\`, \`scoredGameCount\`, \`totalRuns\`, \`averageRunsPerGame\`, \`shutouts\`, \`highestScoring\`, and
\`teamRecords\` (wins/losses/runsFor/runsAgainst per team).
`;

export const MCP_SKILL_MD = `# Using the agent-canvas MCP server

agent-canvas exposes an MLB game dataset over a Model Context Protocol server at \`${BASE}/mcp\`. Four tools, no
authentication, rate-limited per IP. It speaks streamable HTTP per MCP spec revision \`2025-06-18\` and is stateless, so
plain JSON-RPC over curl works the same as an MCP-aware client.

## Quick reference

\`\`\`bash
# 1. initialize
curl -sS ${BASE}/mcp -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' -d '{
  "jsonrpc":"2.0","id":1,"method":"initialize",
  "params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.1"}}
}'

# 2. list tools with full input schemas
curl -sS ${BASE}/mcp -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. call a tool
curl -sS ${BASE}/mcp -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' -d '{
  "jsonrpc":"2.0","id":3,"method":"tools/call",
  "params":{"name":"query_games","arguments":{"limit":5}}
}'
\`\`\`

## Tools

### list_teams

No arguments. Returns the stored MLB teams.

### query_games

Arguments (all optional): \`season\` (year), \`teamId\` (MLB id, matches home or away), \`date\` (YYYY-MM-DD),
\`limit\` (1-100, default 20). Returns game summaries newest first.

### get_game

\`gamePk\` (StatsAPI id). Returns one stored game summary, or null if not loaded.

### analyze_dataset

Provide the games exactly one of two ways:

- \`games\`: an inline array of game lines (\`{ gamePk?, officialDate?, away: { name, score }, home: { name, score } }\`).
- \`games_url\`: an https URL to a JSON array of those lines; the server fetches (5 MB / 10s caps) and validates it.

Returns the computed summary (see ${BASE}/api/schema/output.json).
`;
