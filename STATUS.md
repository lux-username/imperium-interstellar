> Generated 2026-09-21 by /end-session at commit 27ea057.

# STATUS

## Where things stand

**The 1b playtest (`#34`) is in its second and third rounds, and everything from them is on branch `worktree-playtest-2` as PR #60, ready for review but not merged.** The user played on `main` after #58, came back with a page of notes, and then kept playing on the branch as it grew, ruling on each question as it came up. Sixteen commits. The big pieces: **belief is now a fold over reports** (`src/sim/belief.ts`) — an event in a letter is a sighting of that hull *on the week it happened*, the same fold serves the sim's `learn()` and the UI, and Government House's own observations are kept as mail so the **map can be turned back to any week** and show what is now known of it. **Pirates** were reworked around havens: they keep the peace at a haven they know, a corrupt governor never mentions them, a pirate docking unseized (or found lying there) is a `pirates_harboured` event that captains always write home about and that marks the world a known haven until the governor changes; pirates pool their haven lists when they meet and listen to the docks for new ones; a bold corrupt governor touts the port; pirates raid any world on the lanes. **Ports**: C fuels, B+ rebuilds a knocked-out hull (a hulk), guns halved to A 2 / B 1. **Packets** never fight — the port's batteries do, and the record and the letters say so. **Scouts** have unnamed crews, never fight, are ignored by pirates, and are the only hulls that can lie off and watch (patrol greyed out for them). **Rumours** obey the speed limit, have no good/bad preference, and travel by how good the story is. Governors no longer shade unrest. **Worldgen**: ~22 worlds, rolled until the layout has a chokepoint, a far corner and a reachable chart. **The player's seat is Government House** (was "the desk"). **UI**: hulls drawn per ship in faction colours and clickable, a hull dossier with orders drawn on the map, a week scrubber, Officers and Enemy-hulls tabs.

Current thinking: **merge #60, then keep playtesting on `main`** — the user is continuing in another session. Open design threads from this session are filed: the misjump price of unrefined fuel (`#61`), A-port shipyards (`#62`), too many havens (`#63`), legacy id prefixes (`#64`), wordier letters after the rename (`#65`). `#59` (phrasing by personality) is still the next inbox pass once the standard phrasing has been read a while. Then 1c.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 364 passed (364) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `belief.ts`, `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `letters.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Culture files | 31 in `src/sim/data/names/` |
| Ship name pools | patrol 130, escort 150, transport 130, scout 130, raider 130, packet 120 |
| Open issues | 21 (`#11`, `#34`–`#40`, `#44`–`#46`, `#50`, `#51`, `#55`, `#57`, `#59`, `#61`–`#65`) |
| HEAD | 27ea057 — Orders: patrol is greyed out for a scout; a scout's default task is the watch (`worktree-playtest-2`, pushed; PR #60 against `main` at `d208b06`, ready for review) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 4 open / 10 closed. The playtest (`#34`), the economy (`#35`) and the packet-line issues (`#44`–`#46`). This session's work is unmilestoned playtest response, as #58's was.

## Blockers / open questions

- PR #60 is sixteen commits on its own worktree branch; `main` is untouched since #58. Merge it before the next round of notes, or they land on a branch that keeps diverging.
- Save format is 7. Autosaves from before PR #60 will not load (a fresh game starts); autosaves from mid-branch load, thanks to the legacy id prefixes (`#64`).
- Two dev servers may be running: the user's from `main` and this session's on port 5199 from the worktree. Kill the latter (`lsof -ti:5199 -sTCP:LISTEN | xargs kill`) once #60 is merged.
- Pirates from the probe still show odd movement now and then — a raider bouncing between two worlds because she is driven off each time (`breakOff` costs no fuel). Not filed; watch for it in play.
