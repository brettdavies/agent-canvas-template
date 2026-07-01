import { chat } from '../ai/openai';
import { retrieveDocs } from './docs';
import { type DurableHit, searchDurable } from './durable';
import { fetchMlbScores, type MlbScores } from './mlb';

const EMPTY_SCORES: MlbScores = { start: '', end: '', totalGames: 0, games: [] };

export interface RagSources {
  docs: { title: string; file: string; score: number }[];
  durable: DurableHit[];
  mlb: MlbScores;
}

export interface RagResult {
  question: string;
  answer: string;
  sources: RagSources;
}

// Pull an MLB date or date range out of the plain-text question (ISO dates).
async function extractDateRange(question: string): Promise<{ start: string; end: string } | null> {
  const today = new Date().toISOString().slice(0, 10);
  const reply = await chat(
    `Today is ${today}. From the question, extract the MLB date or date range it asks about as ISO dates. ` +
      'Return ONLY JSON: {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"} (start=end for a single day), ' +
      `or {"start":null,"end":null} if no date is mentioned.\n\nQuestion: ${question}`,
  );
  try {
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { start: string | null; end: string | null };
    return parsed.start ? { start: parsed.start, end: parsed.end ?? parsed.start } : null;
  } catch {
    return null;
  }
}

export async function ragAnswer(question: string): Promise<RagResult> {
  const range = await extractDateRange(question);
  const [hits, durable, mlb] = await Promise.all([
    retrieveDocs(question),
    searchDurable(question),
    range ? fetchMlbScores(range.start, range.end) : Promise.resolve(EMPTY_SCORES),
  ]);

  const docsContext = hits.map((h, i) => `[S${i + 1}] ${h.title}\n${h.snippet}`).join('\n\n') || '(no results)';
  const durableContext =
    durable.map((d, i) => `[D${i + 1}] (${d.sourceTable}) ${d.content}`).join('\n') || '(none loaded)';
  const mlbHeader =
    mlb.totalGames === 0
      ? '# MLB scores (no date found in the question)'
      : mlb.start === mlb.end
        ? `# MLB scores for ${mlb.start}`
        : `# MLB scores ${mlb.start} to ${mlb.end}`;
  const mlbContext =
    mlb.games
      .map((g) => `${g.date}: ${g.away} ${g.awayScore ?? '-'} @ ${g.home} ${g.homeScore ?? '-'} (${g.state})`)
      .join('\n') || '(none)';

  const prompt = [
    'Answer the question using ONLY the context below. Cite inline as [S#] for a knowledge-base snippet, [D#] for a',
    'durable MLB record, or [MLB] for live scores. If the context does not contain the answer, say so plainly.',
    '',
    `# Knowledge base (qmd stars — starred repos, including the MLB StatsAPI docs)\n${docsContext}`,
    '',
    `# Durable MLB data (semantic matches over stats_embeddings)\n${durableContext}`,
    '',
    `${mlbHeader}\n${mlbContext}`,
    '',
    `# Question\n${question}`,
  ].join('\n');

  const answer = await chat(prompt);

  return {
    question,
    answer,
    sources: {
      docs: hits.map((h) => ({ title: h.title, file: h.file, score: h.score })),
      durable,
      mlb,
    },
  };
}
