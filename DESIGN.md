# Design

Provisional seed. It fixes the durable, domain-agnostic foundation (themes, neutral ramp, type, spacing, motion,
component states, accessibility). Re-run `/impeccable` once the live prompt is known to commit domain-specific
components.

## Implementation

The tokens live in real CSS, not in this file. This document is the rationale and the rules; the CSS files are the
single source of truth for values. Where this doc names a token, look it up in the file rather than restating its value.

- [`src/index.css`](./src/index.css) — Tailwind entry plus two DaisyUI themes, `console` (dark) and `yc` (light). Each
  defines color tokens (`--color-base-100/200/300`, `--color-base-content`, `--color-primary`, the semantic colors),
  radii (`--radius-selector/field/box`), and `--depth`/`--border`. It also holds the `@theme` font tokens
  (`--font-sans`, `--font-mono`, `--font-serif`) and the `[data-theme='yc']` overrides (Outfit sans, pill buttons, serif
  primary button, orange brand mark).
- [`src/styles/base.css`](./src/styles/base.css) — base layer: body background and text, monospace defaults for code and
  data with tabular figures, the `:focus-visible` ring, the selection color, and the `prefers-reduced-motion` reset.
- [`src/lib/theme.ts`](./src/lib/theme.ts) + [`src/ThemeRocker.tsx`](./src/ThemeRocker.tsx) — the theme controller and
  the three-way System / Light / Dark rocker in the header. An inline script in [`index.html`](./index.html) sets
  `data-theme` before first paint to avoid a flash.

Components consume the tokens through DaisyUI classes (`bg-base-200`, `btn-primary`, `rounded-box`) and Tailwind
utilities; muted text is `base-content` at reduced opacity rather than a separate token.

## Theme

Two themes, chosen by a three-way rocker (System / Light / Dark) in the header. The default follows the OS setting; the
preference persists in `localStorage` and, while on `system`, tracks the OS live (see
[`src/lib/theme.ts`](./src/lib/theme.ts)).

- **`console` (dark):** engineering-grade. A near-black true-neutral canvas (IDE and terminal lineage, not a marketing
  site, not a BI dashboard) with a single confident indigo accent for action and state. Color strategy Restrained:
  neutrals do the architecture, the accent stays at or below 10% of the surface.
- **`yc` (light):** mimics the extracted ycombinator brand + styleguide (`.context/ycombinator-brand.json`,
  `.context/ycombinator-styleguide.json`): a cream canvas, near-black ink, black pill buttons, and the carrot-orange
  brand mark.

Scene: a senior engineer building live on a shared screen; dark reads as a fast, controlled instrument, and light reads
as ycombinator's own site.

## Color

Two palettes, one per theme, defined in [`src/index.css`](./src/index.css). The roles are shared:

- Surfaces: canvas `base-100`, panels `base-200`, inputs and hover wells `base-300`; borders and hairline dividers use
  `base-300`. (`console`: near-black graphite, chroma 0. `yc`: cream, separated by light-gray borders.)
- Text: `base-content` is the highest-contrast ink. Secondary and tertiary text step down via opacity, never below the
  AA floor (4.5:1) for anything meant to be read.
- Accent: `primary` carries primary action, selection, and links (`console`: indigo; `yc`: black, per the styleguide).
  `accent` carries brand identity (`yc`: carrot-orange). White text on filled accent and semantic surfaces
  (Helmholtz-Kohlrausch); dark text only on pale or pure-neutral fills.
- Semantic: success, warning, error, info, each with a readable content color.

## Typography

Fonts are theme-aware, self-hosted through Fontsource (`@fontsource-variable/*`, imported in
[`src/main.tsx`](./src/main.tsx)); tokens `--font-sans` / `--font-mono` / `--font-serif` in
[`src/index.css`](./src/index.css). Pair on a contrast axis, never two similar sans.

- `console`: Inter Variable (UI and prose) with JetBrains Mono Variable (data, numbers, code, endpoints).
- `yc`: Outfit Variable (UI and prose) with Source Serif 4 Variable on the primary button, mirroring the styleguide.
  Mono still carries raw data.

Sizing uses Tailwind's fixed rem scale (`text-xs` through `text-2xl`), not fluid clamps. Weights: 400 body, 500 labels
and buttons, 600 headings. Numeric data uses `tabular-nums`. Prose caps near 70ch; tables and dense data may run wider.

## Spacing and radius

- Spacing: Tailwind's default 4px-based scale. Vary spacing for rhythm.
- Radii (in [`src/index.css`](./src/index.css)): `--radius-selector` for controls, `--radius-field` for fields and
  badges, `--radius-box` for panels and cards. Buttons are modest-radius in `console` and full pill in `yc`. Pills
  otherwise only for status dots and small tags.
- Hairline borders in `base-300`. No colored side-stripe accents. Surfaces are flat: the DaisyUI `--depth` and `--noise`
  effects are disabled.

## Motion

- Duration 150 to 250ms, ease-out. No bounce, no elastic.
- Motion conveys state only: hover, focus, selection, menu and toast enter/exit, skeleton-to-content. No page-load
  choreography.
- The `prefers-reduced-motion: reduce` reset lives in [`src/styles/base.css`](./src/styles/base.css); every transition
  degrades to instant.

## Components

Every interactive element ships default, hover, focus-visible, active, disabled, loading, and where relevant error and
selected.

- Buttons: solid (`btn-primary`), subtle (`base-300` fill), ghost (transparent); modest radius in `console`, full pill
  in `yc`. Focus-visible is a primary ring offset from the control.
- Inputs: `base-100` fill, hairline border, primary border on focus, error border with helper text on error.
- Loading: skeletons (`base-300` blocks with a pulse), not a spinner in the middle of content.
- Empty states teach the next action, never "nothing here."
- Data: monospace, tabular-nums, hairline rows over heavy grids.

## Layout

- App shell: a top bar (or optional left rail) on `base-200`, content on the `base-100` canvas inside a max-width
  column. The theme rocker sits at the top-right of the header.
- Responsive behavior is structural (rows stack on narrow widths, rails collapse, tables reflow), not fluid type.
- Grid for 2D, flex for 1D; auto-fit card grids when a row of cards is the right affordance, never nested.
- z-index scale: dropdown 10, sticky 20, backdrop 30, modal 40, toast 50, tooltip 60.

## Accessibility

WCAG 2.2 AA in both themes. `base-content` ink is the highest-contrast step; muted text stays at or above 4.5:1 on each
canvas. `:focus-visible` on every control, keyboard-operable throughout, `prefers-reduced-motion` honored. Meaning never
by color alone; pair a color with an icon or label (status dots always sit next to text).
