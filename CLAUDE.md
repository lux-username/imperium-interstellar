# CLAUDE.md — how to work here

Read at the start of every session. This is "how we work here," not what the project is (that's spec.md).

## Project

Imperium Interstellar — a solo, week-per-turn grand-strategy game of governing a subsector for a distant Empire, where information travels only as fast as ships and you rule through delegation and a courier-borne inbox.

## Stack

TypeScript. Vite 8 + React 19 for the UI (SVG hex map). Pure-TypeScript simulation core in `src/sim/` with a seeded PRNG — no DOM, no `Math.random`, fully serializable. Vitest for tests, oxlint for lint. No server; the game runs entirely in the browser and builds to a static site.

## Key commands

| Action | Command |
|---|---|
| Build | `npm run build` |
| Test | `npm test` |
| Typecheck | `npm run typecheck` |
| Run | `npm run dev` |
| Lint | `npm run lint` |

## Derived Facts — read by /end-session and /weekly-reconciliation

Every fact below is obtained by **running the command, never by recall**. If you catch yourself typing one of these from memory into any doc, stop and run the command instead. Add a row whenever a new kind of fact starts appearing in docs — an unrepresented fact here is a future drift.

| Fact | Command |
|---|---|
| Test status | `npm test` |
| Test count | `npm test 2>&1 \| grep -E '^\s+Tests'` |
| Typecheck status | `npm run typecheck` |
| Version | `node -p "require('./package.json').version"` |
| Sim modules | `ls src/sim/*.ts \| grep -v test` |
| Order types implemented | `grep -ho "kind: '[a-z_]*'" src/sim/orders.ts 2>/dev/null \| sort -u` |

## Rules

- **Every fact has exactly one home.** Reference or derive; never copy into a second place.
- Current state → `STATUS.md` (overwritten). History → `journal/` (append). Rationale → `decisions.md` (append). Open tasks → GitHub Issues. Roadmap → Milestones. Design → `spec.md`. Repo layout → `MAP.md` (tree derived by command; annotations curated; refreshed by /weekly-reconciliation).
- **Plans never live only in the journal.** If it's open work, it's an Issue.
- Session start: read `STATUS.md` (check its stamp date), then `gh issue list --state open`.
- Session end: run **/end-session**. Always — a skipped run is how STATUS.md starts lying.

## Project-specific rules

- **The sim never touches the DOM and never calls `Math.random`.** All randomness goes through `src/sim/rng.ts` so a seed reproduces a whole game.
- **The UI never reads ground truth.** It renders a `PlayerView` built from delivered reports. A dev-only god-view toggle is the single sanctioned exception.
- **No copied rules text, no third-party trademarks or setting names** — not in code, comments, data files, or docs. Mechanics are ours to implement; wording and world are ours to write. See `decisions.md` 2026-09-19.
- **`references/` holds third-party source material** (blog-post PDFs etc.). It is gitignored and must stay that way; cite ideas from it, never paste from it.
- Design pillars in `spec.md` are load-bearing. A feature that gives the player faster-than-ship information or direct control of a distant unit is wrong even if fun.
