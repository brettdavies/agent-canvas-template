import type { GameSummary } from '@shared/mlb';
import { useEffect, useState } from 'react';
import { client } from './lib/api';

type State = { kind: 'loading' } | { kind: 'ok'; games: GameSummary[] } | { kind: 'error'; message: string };

export default function Games() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    client.api.games
      .$get({ query: { limit: '8' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`request failed (HTTP ${res.status})`);
        const games = (await res.json()) as unknown as GameSummary[];
        if (active) setState({ kind: 'ok', games });
      })
      .catch((err) => {
        if (active) setState({ kind: 'error', message: String(err) });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-200">
      <header className="flex items-center justify-between border-b border-base-300 px-5 py-3">
        <h2 className="text-sm font-semibold">Recent games</h2>
        <span className="font-mono text-xs text-base-content/65">GET /api/games</span>
      </header>
      <div className="p-5">
        {state.kind === 'loading' && (
          <div className="space-y-2" aria-busy="true">
            <div className="h-3.5 w-full animate-pulse rounded bg-base-300" />
            <div className="h-3.5 w-5/6 animate-pulse rounded bg-base-300" />
          </div>
        )}

        {state.kind === 'error' && (
          <p role="alert" className="rounded-field border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {state.message}
          </p>
        )}

        {state.kind === 'ok' && state.games.length === 0 && (
          <p className="text-sm text-base-content/65">
            No games loaded yet. Seed the dataset with <code className="text-xs">bun run db:seed</code> (Postgres) — the
            endpoint stays live and returns an empty list until then.
          </p>
        )}

        {state.kind === 'ok' && state.games.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Away</th>
                  <th scope="col" className="text-right">
                    Score
                  </th>
                  <th scope="col">Home</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.games.map((g) => (
                  <tr key={g.gamePk}>
                    <td className="font-mono text-xs">{g.officialDate ?? '—'}</td>
                    <td>{g.away.name ?? '—'}</td>
                    <td className="text-right font-mono">
                      {g.away.score ?? '-'}–{g.home.score ?? '-'}
                    </td>
                    <td>{g.home.name ?? '—'}</td>
                    <td className="text-xs text-base-content/70">{g.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
