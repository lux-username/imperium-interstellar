# Decisions — append-only

"Chose X over Y because Z." Dated, newest at the bottom. Rationale lives here so it stops hiding in changelog bullets and commit messages.

<!-- Format:

## YYYY-MM-DD — Chose X over Y

Because Z. (Link the journal entry or issue if the context helps.)

-->

## 2026-09-19 — Chose clean-room mechanics over licensed or copied text

Because game mechanics and procedures are not copyrightable but their expression is, and because the project must be shareable without infringing anyone. We implement 1977-era 2d6 SF RPG mechanics (as analysed by the *Tales to Astound!* "Out of the Box" essays) in our own words, with our own setting, and no third-party trademarks or setting names. The Mongoose-era SRD/OGL text and the Cepheus Engine exist as a licensed fallback if we ever want a textual base, but we are not using them now.

## 2026-09-19 — Chose a TypeScript web app over a Python TUI or Godot

Because the game's soul is an inbox and a last-known map, which a browser renders well; a pure-TS sim with a seeded PRNG is easy to test deterministically; and a static build is the simplest way to share with friends. Godot's engine weight buys nothing for a text-first design; a TUI cramps the hex map and is hard to hand to non-technical players.

## 2026-09-19 — Chose one-week turns over real-time-with-pause

Because one jump = one week is native to the setting, the loop is "read inbox → write dispatches → advance", and real-time scheduling would be a large engineering cost that adds nothing to a game about delayed information.

## 2026-09-19 — Chose a location-addressed information model, player fixed at the capital for Phase 1

Because dispatches and reports are delivered to *places*, not to "the player". Keeping the player at the desk keeps Phase 1 simple, while modelling the capital as the delivery address (with an `acting_governor` slot) means Phase 2 mobility — the player leaving with the fleet while a deputy holds the seal — is an addition rather than a rewrite. Unrestricted mobility was rejected because it quietly reintroduces the omniscient general.

## 2026-09-19 — Chose subsector scale and the governor-general as the default player role

Because a single 8×10 subsector is the natural unit of the source material and is crossable in months at J-2, which is the right timescale for the delay mechanic. Playing a governor-general rather than a sovereign means the same delay applies upward: the Empire judges and orders the player on months-old information. Pocket polities and rogue admirals come later as alternative seats.

## 2026-09-19 — Chose Vitest 5 over Vitest 3

Because Vitest 3's config types do not recognise Vite 8, so `tsc -b` failed on `vite.config.ts`. Vitest 5 pairs with Vite 8.

## 2026-09-19 — Chose a two-file truth/view split over a lint rule or a single types file

Because the belief model is meant to be enforced by structure: `src/sim/types.ts` holds ground truth and `src/sim/view.ts` holds everything the player may see (reports, snapshots, dispatches, `PlayerView`), re-exporting the few shared primitives so the UI never has a reason to import `types.ts`. A report carries its own `WorldSnapshot`/`ShipSnapshot`, never the `World`/`Ship` record, so stale or coloured reports are real objects rather than copies of the truth. The split is visible in the import graph and greppable; a lint rule was rejected because it would fight the one sanctioned exception (the dev-only god view, #9) and is enforcement of a habit the code layout already makes obvious. Mail in transit is one ground-truth `Mail` wrapper around either a report or a dispatch, so issue #4 propagates both directions with one mechanism. The player's view is derived from `GameState.beliefs[player]` rather than stored, so it cannot drift from the reports that justify it (issue #1).
## 2026-09-19 — Chose "The Governor's Term" as the first campaign, with a loyal and a rogue ending

Because a single fixed seat with a fixed term gives Phase 1 a clear win/lose loop (serve out the term vs. be recalled), and the rogue ending — stack the seats with loyalists, declare, survive the Empire's expedition — makes appointments matter from the first week rather than being a Phase 2 afterthought. Five threat sources (Warlord, pirates, planetary governors, unrest, the Council) were chosen because each is answered only by sending hulls and people, never by direct control. See `spec.md` → *First campaign*.
