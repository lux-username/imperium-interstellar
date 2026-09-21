> Generated 2026-09-21 by /end-session at commit 98e8f9d.

# STATUS

## Where things stand

**The 1b playtest (`#34`) has begun, and its first finding is answered on branch `worktree-letters-subjects` as draft PR #58.** PR #56 (names wired into worlds, people and ships) was merged into `main` this session at `c91f682`, the prototype relaunched from `main`, and the user played. The verdict: the game functions, but what the inbox holds is under-communicated — not too little information (expected), but information poorly conveyed. Three fixes asked for, all built: every report now carries a standardised **subject** and **lede** (one sentence with the most important news), composed in the sim by `src/sim/letters.ts` from the writer's side and the occasion — *Cévennes governor's report: Pirates sighted!* / *2 pirate hulls were sighted in the system.*; writers **sign with their office** (*Governor Nora Maguire*, *Captain Cao Jinrong — Champion*); and **captains write on occasion** — a quick update after this week's events (a fight of their own always, carried aboard if it must be; sightings and other trouble only from a port on the lanes and only if the captain is the writing kind, 2d6 vs 7 with cautious +3 / bold −3), and a **general report** on making the rendezvous covering everything logged since their last orders (`Ship.lastOrders`, `Ship.log`; save format 6). The event wording moved from the UI into the sim so the inbox says only what a letter said. Phrasing is standard for now; personality variants are `#59` (`journal/2026-09-21-6.md`).

Current thinking: **merge #58, then carry on the 1b playtest (`#34`)** with the new inbox — the playtest question is still open; this was its first round of feedback, not its answer. Then 1c. `#59` (phrasing by personality) follows once the standard phrasing has been read for a while. `#57`, `#50`, `#51` are name polish for spare sessions; `#55` a later pass; `#11` keeps survey and governor orders.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 339 passed (339) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `letters.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Culture files | 31 in `src/sim/data/names/` |
| Ship name pools | patrol 130, escort 150, transport 130, scout 130, raider 130, packet 120 |
| Open issues | 16 (`#11`, `#34`–`#40`, `#44`–`#46`, `#50`, `#51`, `#55`, `#57`, `#59`) |
| HEAD | 98e8f9d — Letters carry a subject and a lede; captains sign with their ship and report on occasion (`worktree-letters-subjects`, pushed; draft PR #58 against `main` at `c91f682`) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 4 open / 10 closed. The remaining four are the playtest (`#34`), the economy (`#35`) and the later packet-line issues (`#44`–`#46`). The letters work belongs to the playtest and is unmilestoned; `#59` likewise.

## Blockers / open questions

- One open PR, #58, on its own worktree branch; `main` is untouched. Merge it (or say what to change) before the next playtest round, so the inbox reads as asked.
- Two judgment calls in #58 worth a ruling: routine "Arrived at X" letters at every friendly port are kept (the general report is added, not substituted); and a fight off the courier network is still written and carried aboard (the "only on the network" rule applies to sightings and other trouble). Both are noted on `#59`.
- The `names-wiring` worktree and its remote branch still exist though #56 is merged; the other session held the worktree lock. Remove both once that session is closed.
- The sex of rolled people is an even split — a guess, since nothing in `spec.md` says.
