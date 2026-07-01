# Product

## Register

product

## Build Context

A domain-agnostic, agent-native full-stack canvas that a real feature drops into. It ships a worked example — a stored
MLB game dataset exposed over REST and MCP — that demonstrates the whole surface end to end; forking developers replace
the example with their own domain. Primary consumer: an AI agent driving the MCP/REST surface. Secondary: the developer
building on the template, and anyone exercising the running demo (REST + RAG + MCP).

## Users

An agent that discovers the server (via `.well-known`, `llms.txt`, OpenAPI) and drives its tools (`query_games`,
`get_game`, `analyze_dataset`, `rag_answer`) with no human in the loop. Secondary: a developer who forks the canvas and
lands a new domain feature fast; and a viewer of the minimal placeholder UI (health, a RAG box, a recent-games list, and
the agent-surface links).

## Product Purpose

A polished, domain-agnostic full-stack canvas (Hono API + React/Vite client, Drizzle across Postgres/pgvector and
Cloudflare D1, typed end to end, with RAG and an MCP server) that lets real features land fast inside a frame that
already reads as production software — and is agent-ready by default. Success: a new domain feature slots in behind the
existing boundaries (schema → REST + MCP in lockstep → discovery) without re-plumbing, and the result looks and feels
shipped, not scaffolded.

## Brand Personality

Precise, fast, technical. Confidence through control: dense where density helps, quiet everywhere else, no decoration
that fails to carry information. Earned familiarity over novelty, the trust a user already has in Linear, Raycast, and
Stripe. The interface disappears into the task; craft shows in spacing, states, and motion, not ornament.

## Anti-references

- The default DaisyUI / generic AI-SaaS demo: cream or warm-near-white body, identical icon-heading-text card grids, a
  tracked-uppercase eyebrow over every section. The current shell is this default; replace it.
- Corporate navy-and-gray BI dashboard: the safe enterprise look with no point of view.
- Overstimulation: gratuitous motion, gradients everywhere, glassmorphism, gradient text. Loud without purpose.
- AI-purple-on-white: saturated indigo on pure white is its own cliche. If violet appears, it earns its place as a
  restrained accent on a controlled neutral surface, never as the whole look.

## Design Principles

- Craft is the pitch. In a live build the polish of the frame is the argument; every default and empty state is
  intentional.
- The tool disappears into the task. Earned familiarity beats invention: standard affordances, one consistent component
  vocabulary.
- Domain-agnostic frame, drop-in features. Shell, tokens, and component states stay generic so a new feature slots in
  without a redesign.
- Fast by default. Motion conveys state in 150-250ms; nothing makes the user wait to watch the page load.
- Restraint carries the signal. One accent for action and state, neutrals do the architecture, density only where it
  earns its place.

## Accessibility & Inclusion

WCAG 2.2 AA. Body text at least 4.5:1, large text at least 3:1, verified rather than assumed. Visible focus on every
interactive element; full keyboard operability. Every animation has a `prefers-reduced-motion: reduce` alternative
(crossfade or instant). Never encode meaning in color alone; pair it with an icon or label.
