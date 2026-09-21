> Generated 2026-09-20 by /end-session at commit f6719f5.

# STATUS

## Where things stand

**Phase 1b is built as a prototype and awaits its playtest.** The code lives on branch `worktree-phase1b` as **draft PR #52** on `main` (1a merged today as PR #42); it closes `#21 #28 #29 #30 #31 #32 #33 #43 #47` on merge. What 1b delivers: worlds that *change hands* — a revolt is a week-by-week garrison contest under one `groundRound()`, ungarrisoned worlds fall at once, the governor flees to a hull in orbit or is killed, the world becomes independent, its port closes and its garrison slowly regrows; space combat by posture (docked hulls cannot be forced out, arrivals are in the open, scouts break off, prizes lie where taken, every surviving commander writes); pirates living off havens each hull knows, lying off busy ports, robbing packets (mail destroyed) and seized where they stop at the wrong port; a `transport` order that loads where it is read, loses one detachment in ten on revival, lands behind a beachhead or pays for it, enforces appointments with marines and sends officers to prizes; the Warlord in the far corner with his own belief state, acting monthly in a fixed order — reinforce his own worlds, land where it hurts the desk most and he believes he can win (warships seen counted, port guns included), take independents, hunt cheap prizes, scout silent governors first — and no treason until there is money; **scouts are the agents** (a scout order with a stay; a watch ends in the one uncoloured report); and a map where colour is the believed holder and age the badge. The desk now reads only mail addressed to it — necessary the moment a second seat existed.

Design settled today and recorded in `spec.md`/`decisions.md`: the revolt contest and beachheads; **the Empire taxes trade routes, not planets** (client rulers, garrisons hold the port and the palace, off-route worlds are liabilities, extractive taxation is an emergency order — `#35` rewritten to match); scouts as agents; and the user's rulings on the twelve questions the build raised (`#53`, closed): empty garrisons rare, packets need no officer, prize crews to the rendezvous, pirates turn armed prizes into raiders, **a fallen capital ends the game**, ports close to packets only once the docks they sail from have heard, cryo losses an event of their own, no escort or blockade orders.

Current thinking: an 8-seed, 80-week soak with a passive desk runs in about a second per seed, delivers ~1 letter a week, holds pirate numbers roughly level, and has the Warlord grow from 6 to 9–13 worlds — pressure the player is meant to answer. **Next is the 1b playtest (`#34`)**, then 1c. `#11` keeps survey and governor orders. `#49` (culture name pools) is a parallel session's.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 127 passed (127) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Open issues | 21 (`#11`, `#21`, `#28`–`#40`, `#43`–`#47`, `#49`; nine close with PR #52) |
| HEAD | f6719f5 — the Warlord's priorities; events know their sides (branch `worktree-phase1b`, on `main` b7ad774) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 13 open / 1 closed (nine close when PR #52 merges; `#34` is the playtest).

## Blockers / open questions

- **PR #52 needs review and merge**; the user merges. After it: `git pull`, remove worktree `.claude/worktrees/phase1b`, delete the branch. The playtest can run from the branch before that.
- No open design questions. Events now record whom they went against and whom they favoured; every reader judges them from their own side.
