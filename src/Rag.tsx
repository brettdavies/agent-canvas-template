import { type FormEvent, useState } from 'react';
import type { RagResult } from '../server/rag';
import { client } from './lib/api';
import { logger } from './lib/logger';
import { notify } from './lib/toast';

const SAMPLE =
  'According to the MLB StatsAPI GUMBO docs, how do live game feeds deliver updates, and which MLB games on June 28, 2024 were the highest-scoring?';

type RagState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: RagResult }
  | { kind: 'error'; message: string };

export default function Rag() {
  const [question, setQuestion] = useState(SAMPLE);
  const [state, setState] = useState<RagState>({ kind: 'idle' });

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setState({ kind: 'loading' });
    try {
      const res = await client.api.rag.$post({ json: { question: q } });
      if (!res.ok) throw new Error(`request failed (HTTP ${res.status})`);
      setState({ kind: 'done', result: (await res.json()) as RagResult });
    } catch (err) {
      setState({ kind: 'error', message: String(err) });
      notify.error('RAG request failed');
      logger.error('rag request failed', { error: String(err) });
    }
  }

  const loading = state.kind === 'loading';
  const disabled = loading || question.trim().length === 0;

  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-200">
      <header className="flex items-center justify-between border-b border-base-300 px-5 py-3">
        <h2 className="text-sm font-semibold">Retrieval-augmented answer</h2>
        <span className="font-mono text-xs text-base-content/65">qmd + OpenAI</span>
      </header>

      <div className="p-5">
        <form onSubmit={ask} className="flex flex-col gap-3">
          <label htmlFor="rag-question" className="sr-only">
            Question
          </label>
          <textarea
            id="rag-question"
            className="textarea w-full resize-y border-base-300 bg-base-100 text-sm leading-relaxed focus:border-primary"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question grounded in the knowledge base..."
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-xs text-base-content/70"
              onClick={() => setQuestion(SAMPLE)}
            >
              Reset sample
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={disabled}>
              {loading && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
              {loading ? 'Thinking' : 'Ask'}
            </button>
          </div>
        </form>

        <div className="mt-4">
          {state.kind === 'idle' && (
            <p className="text-sm text-base-content/65">
              Answers cite sources inline as <code className="text-xs">[S#]</code> for knowledge-base snippets.
            </p>
          )}

          {state.kind === 'loading' && (
            <div className="space-y-2" aria-busy="true" aria-live="polite">
              <div className="h-3.5 w-full animate-pulse rounded bg-base-300" />
              <div className="h-3.5 w-5/6 animate-pulse rounded bg-base-300" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-base-300" />
            </div>
          )}

          {state.kind === 'error' && (
            <p role="alert" className="rounded-field border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
              {state.message}
            </p>
          )}

          {state.kind === 'done' && (
            <div className="space-y-3" aria-live="polite">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-base-content/90">{state.result.answer}</p>
              <details className="group">
                <summary className="w-fit cursor-pointer font-mono text-xs text-base-content/65 hover:text-base-content/90">
                  sources
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-field bg-base-100 p-3 text-xs text-base-content/70">
                  {JSON.stringify(state.result.sources, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
