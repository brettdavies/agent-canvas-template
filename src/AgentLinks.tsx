const LINKS: { href: string; label: string; note: string }[] = [
  { href: '/openapi.json', label: 'OpenAPI 3.1', note: 'REST contract' },
  { href: '/llms.txt', label: 'llms.txt', note: 'overview for agents' },
  { href: '/llms-full.txt', label: 'llms-full.txt', note: 'full contract' },
  { href: '/mcp-skill.md', label: 'mcp-skill.md', note: 'MCP client guide' },
  { href: '/.well-known/mcp/server-card.json', label: 'server-card.json', note: 'MCP discovery' },
];

export default function AgentLinks() {
  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-200">
      <header className="flex items-center justify-between border-b border-base-300 px-5 py-3">
        <h2 className="text-sm font-semibold">Agent surface</h2>
        <span className="font-mono text-xs text-base-content/65">POST /mcp</span>
      </header>
      <div className="p-5">
        <p className="mb-3 text-sm text-base-content/70">
          Discovery documents an agent can fetch to learn the server and its contract. The MCP server itself is a{' '}
          <code className="text-xs">POST</code> JSON-RPC endpoint at <code className="text-xs">/mcp</code>.
        </p>
        <ul className="divide-y divide-base-300">
          {LINKS.map((l) => (
            <li key={l.href} className="flex items-center justify-between gap-3 py-2">
              <a className="link link-hover font-mono text-xs" href={l.href}>
                {l.label}
              </a>
              <span className="text-xs text-base-content/60">{l.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
