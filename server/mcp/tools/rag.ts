import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ragAnswer } from '../../rag';

function textContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function registerRagTools(server: McpServer): void {
  server.tool(
    'rag_answer',
    'Answer a question with retrieval-augmented generation: pulls matching snippets from the qmd knowledge base ' +
      '(starred GitHub repos), semantic matches over the durable MLB dataset (when loaded), and live MLB scores for ' +
      'any date the question names, then has the model synthesize an answer with inline [S#] / [D#] / [MLB] ' +
      'citations. Returns { question, answer, sources }.',
    { question: z.string().min(1).describe('The natural-language question to answer.') },
    async ({ question }) => textContent(await ragAnswer(question)),
  );
}
