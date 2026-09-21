> Generated 2026-09-21 by /end-session at commit 1d2d222.

# STATUS

## Where things stand

**Phase 1b is built and tuned to the user's rulings; PR #52 is ready to merge, and the playtest (`#34`) is next.** The code lives on branch `worktree-phase1b` off `main` (b7ad774); it closes `#21 #28 #29 #30 #31 #32 #33 #43 #47` on merge. What 1b delivers: worlds that *change hands* — a revolt is a week-by-week garrison contest under one `groundRound()`, empty garrisons are rare, the governor flees to a hull in orbit or is killed, the world becomes independent, its port closes (but packets keep sailing in until the docks they leave from have heard), its garrison slowly regrows, and **a fallen capital ends the game**; space combat by posture with **port guns as a bonus, not a wall** (A 3 / B 2 / C 1, counted for whoever is docked, approaches weighed before the port); pirates living off havens each hull knows, seized where they stop, turning armed captures into raiders, robbing the unarmed, and **questioned when taken** (havens named on 2d6 ≥ 7, a false one on a 12); a `transport` order with **fuel by jumps** (refuel at B+, repair at C+, a hull on her last jump turns for fuel), cryo loss as its own event, beachheads, appointments enforced by marines, prize crews to the captor's rendezvous; **scouts are the agents and the couriers** (six scouts, no courier role; packets stay separate as timetable infrastructure); the Warlord in the far corner with his own belief state, an **officer pool** (loyal to him or to themselves), and monthly priorities — reinforce his own worlds, replace a governor whose port breeds pirates, land where it hurts the desk most and he believes he can win (warships seen counted, port guns included), take independents, hunt cheap prizes and pirate nests, scout silent governors first — **planned against the tank and staged from forward bases**, with no treason until there is money; and **events that know their sides**, so every reader judges news from their own faction. Colour on the map is the believed holder; age is the badge.

Design recorded in `spec.md`/`decisions.md`: the revolt contest, trade-route taxation and client-ruler garrisons, scouts as agents, the captured ending, the rulings on the twelve build questions (`#53`, closed), port guns, the docks-not-the-desk rule for lane closures, valence relative to the reader, fuel and bases. Two things are marked as **needing fleshing out** in a later pass (`#55`): economy/money and recruiting troops.

Current thinking: an 8-seed, 80-week soak with a passive desk runs in about a second per seed, delivers ~1 letter a week, holds pirate numbers at 2–6, and has the Warlord grow from 6 to 6–12 worlds — pressure the player is meant to answer. **Next: merge PR #52, then the 1b playtest (`#34`)**, then 1c. `#11` keeps survey and governor orders. `#49 #50 #51 #54` (culture name pools) are a parallel session's.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 137 passed (137) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Open issues | 25 (`#11`, `#21`, `#28`–`#40`, `#43`–`#47`, `#49`–`#51`, `#54`, `#55`; nine close with PR #52) |
| HEAD | 1d2d222 — Spec: economy and troop recruitment marked as needing fleshing out (branch `worktree-phase1b`, on `main` b7ad774) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 13 open / 1 closed (nine close when PR #52 merges; `#34` is the playtest).

## Blockers / open questions

- **PR #52 to merge**, then `git pull` on `main`, remove worktree `.claude/worktrees/phase1b`, delete the branch.
- No open design questions. Two placeholders await a later pass (`#55`): economy/money, recruiting troops.
