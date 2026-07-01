import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import AgentLinks from './AgentLinks';
import Games from './Games';
import { client } from './lib/api';
import Rag from './Rag';
import ThemeRocker from './ThemeRocker';

type Health = { status: string; now: string };

type HealthState = { kind: 'loading' } | { kind: 'ok'; data: Health } | { kind: 'error'; message: string };

export default function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    client.api.health
      .$get()
      .then((res) => res.json())
      .then((data) => {
        if (active) setHealth({ kind: 'ok', data: data as Health });
      })
      .catch((err) => {
        if (active) setHealth({ kind: 'error', message: String(err) });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-base-100 text-base-content">
      <header className="border-b border-base-300">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark size-2.5 rounded-[2px] bg-primary" aria-hidden="true" />
            <span className="wordmark font-mono text-sm font-medium tracking-tight">agent-canvas</span>
            <span className="hidden rounded-field border border-base-300 px-1.5 py-0.5 font-mono text-[11px] text-base-content/65 sm:inline-flex">
              MLB
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge health={health} />
            <ThemeRocker />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8">
        <div className="mb-6 max-w-2xl">
          <h1 className="text-lg font-semibold">Agent-native canvas</h1>
          <p className="mt-1 text-sm text-base-content/70">
            A domain-agnostic full-stack starter with a Cloudflare Worker, a stateless MCP server, agent-discovery
            surfaces, and RAG. The worked example is a stored MLB game dataset — replace it with your own domain. This
            page is a deliberately minimal placeholder; the value is the agent-facing surface below.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Rag />
          <AgentLinks />
          <div className="lg:col-span-2">
            <Games />
          </div>
        </div>
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-base-200)',
            color: 'var(--color-base-content)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
          },
        }}
      />
    </div>
  );
}

function StatusBadge({ health }: { health: HealthState }) {
  const wrap = 'inline-flex items-center gap-1.5 font-mono text-xs';
  if (health.kind === 'loading') {
    return (
      <span className={`${wrap} text-base-content/65`}>
        <span className="size-2 animate-pulse rounded-full bg-base-content/40" aria-hidden="true" />
        checking
      </span>
    );
  }
  if (health.kind === 'error') {
    return (
      <span className={`${wrap} text-error`}>
        <span className="size-2 rounded-full bg-error" aria-hidden="true" />
        unreachable
      </span>
    );
  }
  return (
    <span className={`${wrap} text-base-content/70`}>
      <span className="size-2 rounded-full bg-success" aria-hidden="true" />
      operational
    </span>
  );
}
