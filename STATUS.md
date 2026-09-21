> Generated 2026-09-20 by /end-session at commit a43874d.

# STATUS

## Where things stand

**Phase 1b is built as a prototype and awaits its playtest.** The code lives on branch `worktree-phase1b` as **draft PR #52** on `main` (1a merged today as PR #42); it closes `#21 #28 #29 #30 #31 #32 #33 #43 #47` on merge. What 1b delivers: worlds that *change hands* — a revolt is a week-by-week garrison contest under one `groundRound()`, ungarrisoned worlds fall at once, the governor flees to a hull in orbit or is killed, the world becomes independent, its port closes and its garrison slowly regrows; space combat by posture (docked hulls cannot be forced out, arrivals are in the open, scouts break off, prizes lie where taken, every surviving commander writes); pirates living off havens each hull knows, lying off busy ports, robbing packets (mail destroyed) and seized where they stop at the wrong port; a `transport` order that loads where it is read, loses one detachment in ten on revival, lands behind a beachhead or pays for it, enforces appointments with marines and sends officers to prizes; the Warlord in the far corner with his own belief state, scouting the frontier monthly, landing on the weakest world he *believes* in and tempting self-serving captains; **scouts are the agents** (a scout order with a stay; a watch ends in the one uncoloured report); and a map where colour is the believed holder and age the badge. The desk now reads only mail addressed to it — necessary the moment a second seat existed.

Design settled today and recorded in `spec.md`/`decisions.md`: the revolt contest and beachheads; **the Empire taxes trade routes, not planets** (client rulers, garrisons hold the port and the palace, off-route worlds are liabilities, extractive taxation is an emergency order — `#35` rewritten to match); scouts as agents; and twelve open questions from the build under *spec.md → Open questions*, filed as `#53`.

Current thinking: an 8-seed, 80-week soak with a passive desk runs in about a second per seed, delivers ~1 letter a week, holds pirate numbers roughly level, and has the Warlord grow from 6 to 8–14 worlds — pressure the player is meant to answer. **Next is the 1b playtest (`#34`)** with `#53` beside it, then 1c. `#11` keeps escort/blockade. `#49` (culture name pools) is a parallel session's.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 116 passed (116) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Open issues | 22 (`#11`, `#21`, `#28`–`#40`, `#43`–`#47`, `#49`, `#53`; nine close with PR #52) |
| HEAD | a43874d — 1b soak fixes (branch `worktree-phase1b`, on `main` b7ad774) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 14 open / 0 closed (nine close when PR #52 merges; `#34` and `#53` are the playtest).

## Blockers / open questions

- **PR #52 needs review and merge**; the user merges. After it: `git pull`, remove worktree `.claude/worktrees/phase1b`, delete the branch. The playtest can run from the branch before that.
- Twelve design questions in *spec.md → Open questions* (`#53`) — none blocks the playtest; each is decided one way in the code.
