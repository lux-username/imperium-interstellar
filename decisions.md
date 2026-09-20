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
