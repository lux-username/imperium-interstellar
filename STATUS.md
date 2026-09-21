> Generated 2026-09-21 by /end-session at commit 04feaa7.

# STATUS

## Where things stand

**The culture name pools are wired into the game, on branch `worktree-names-wiring` as draft PR #56; the 1b playtest (`#34`) is still next.** This session took `#49` and `#54` together, as STATUS said it should. Every world now rolls 1d3 distinct cultures from the world table and takes its name from their toponyms ("New X" / "Port X" on a clash); every person `newCharacter` rolls — the desk's governors and officers, the Warlord's, pirate captains, one pool for all sides — comes from one culture (core 60%, world 40%) and a sex at even odds, and is named by that culture's pattern, so Han and Korean names run family-first, Vietnamese carry Văn/Thị, Russian women get the feminine surname, Kazakhs a patronymic, a Javanese woman one name. A merchant who brings a rumour to a port is one of that world's own people. The three South Asian files are split into `communities` on the schema (`#54`, option 1), so a given name and a family name never cross. World cultures ride on the chart and the Dossier shows them as "Settled by"; save format is 5. The syllable generator survives only for ship names (`journal/2026-09-21-4.md`).

Three seed-dependent tests had been resting on assumptions the old RNG streams happened to satisfy (a world that changed hands after an unrest event; a questioned prize's ship-snapshot letter; a revolt-letter rate that counted seeds with no revolt as silence). They were corrected to their intent, not re-seeded.

Current thinking: **merge #56, then the 1b playtest (`#34`)**, then 1c. `#57` (Russian patronymics, the unused Central Asian second names, ship names from the pools) is polish for any spare session, as are `#50` (real sources for the thin women's pools) and `#51` (famous-individual pass). `#55` (economy/money, recruiting troops) is a later pass. `#11` keeps survey and governor orders.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 311 passed (311) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Culture files | 31 in `src/sim/data/names/` |
| Open issues | 17 (`#11`, `#34`–`#40`, `#44`–`#46`, `#49`–`#51`, `#54`, `#55`, `#57`); `#49` and `#54` close when #56 merges |
| HEAD | 04feaa7 — Worlds and people take their names from the culture pools (`worktree-names-wiring`, pushed; draft PR #56 against `main`) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 4 open / 10 closed. The remaining four are the playtest (`#34`), the economy (`#35`) and the later packet-line issues (`#44`–`#46`). The name work is unmilestoned flavour.

## Blockers / open questions

- One open PR, #56, on its own worktree branch; `main` is untouched. Merge it (or say what to change) before the next session opens a worktree, so the playtest runs with named worlds.
- The sex of rolled people is an even split — a guess, since nothing in `spec.md` says. Say so if the Empire's officer corps should lean one way.
- No other open design questions.
