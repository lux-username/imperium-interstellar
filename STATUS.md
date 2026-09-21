> Generated 2026-09-21 by /end-session at commit 1089a36.

# STATUS

## Where things stand

**Names are done end to end — worlds, people and now ships — on branch `worktree-names-wiring` as draft PR #56; the 1b playtest (`#34`) is still next.** The first half of the session wired the culture pools (`#49`, with `#54`'s community split): every world rolls 1d3 cultures and takes its name from their toponyms; every rolled person — the desk's, the Warlord's, a pirate captain, one pool for all — comes from one culture (core 60%, world 40%) and a sex at even odds and is named by that culture's pattern; merchants bringing rumours are named from their port. The second half gave ships their own pools: `src/sim/data/ships.ts` holds six pools of 120–150 names by hull class in the naval tradition for that kind of ship and its continuation in space (patrol craft for qualities and the sky, escorts for weapons and beasts, transports for rivers and "Empire X", scouts for birds and instruments, raiders for pirate bravado and jokes about money, packets for the Latin regions of the mail steamers); `shipName(rng, hull, taken)` never repeats a name in a game and numbers the reuse once a pool is spent; packets are named hulls now. The syllable generator is gone (`journal/2026-09-21-4.md`, `2026-09-21-5.md`).

Current thinking: **merge #56, then the 1b playtest (`#34`)**, then 1c. `#57` keeps the two name-polish items still open (Russian patronymics, the unused Central Asian second names); `#50` (real sources for the thin women's pools) and `#51` (famous-individual pass) are polish for any spare session. `#55` (economy/money, recruiting troops) is a later pass. `#11` keeps survey and governor orders.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 327 passed (327) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Culture files | 31 in `src/sim/data/names/` |
| Ship name pools | patrol 130, escort 150, transport 130, scout 130, raider 130, packet 120 |
| Open issues | 17 (`#11`, `#34`–`#40`, `#44`–`#46`, `#49`–`#51`, `#54`, `#55`, `#57`); `#49` and `#54` close when #56 merges |
| HEAD | 1089a36 — Ships take their names by class from pools in the naval tradition (`worktree-names-wiring`, pushed; draft PR #56 against `main`) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 4 open / 10 closed. The remaining four are the playtest (`#34`), the economy (`#35`) and the later packet-line issues (`#44`–`#46`). The name work is unmilestoned flavour.

## Blockers / open questions

- One open PR, #56, on its own worktree branch; `main` is untouched. Merge it (or say what to change) before the next session opens a worktree, so the playtest runs with named worlds and hulls.
- The sex of rolled people is an even split — a guess, since nothing in `spec.md` says. Say so if the Empire's officer corps should lean one way.
- No other open design questions.
