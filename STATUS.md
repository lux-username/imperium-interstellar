> Generated 2026-09-20 by /end-session at commit 0987c7a.

# STATUS

## Where things stand

**Phase 1a is built and accepted; Phase 1b is next.** The 1a code lives on branch `worktree-phase1a` as **draft PR #42**, stacked on the docs PR #41; it closes `#18 #19 #20 #22 #23 #24 #25 #26` on merge, and `#27` (the playtest gate) was closed today on the strength of three preview rounds whose feedback all became changes on the branch. What 1a delivers: `Event` records as the unit of news; `Report.channel` and the events a letter mentions; character traits; hull roles scout/patrol/escort/transport with `patrol` and `scout` orders carrying their own progress; charted-first routing with off-lane jumps for hulls the desk sends; commanders' letters from every friendly port; a 14-hull starting fleet; governors who write only on a change of mood (content / neutral / hostile, extremes once per visit) through a 2d6 disclosure roll shaded by loyalty and initiative, 8–12-week "all quiet" letters, and self-serving shading of unrest; rumours that spawn at ports, hop the lanes, degrade a little, arrive as merchant/docks talk in their own pile and never touch the map; one orders dialog (hull · where to send it — last known / destination / rendezvous, or a courier in port to carry it along its own run · destination · task · disposition · afterwards); any hull carrying copies of the letters waiting at a port when its run reaches their destination; every dossier claim linking to its letter. A fresh game brings about one letter a week. Save format v2.

Design settled today and recorded in `spec.md`/`decisions.md`: *the courier is the mail* (no nested orders; historically grounded), stranded mail loaded only where the hull's run reaches its destination, and captured couriers and packets destroy their mail.

Current thinking: **1b starts with `#28` world states** (loyal / unrest / revolt / independent / Warlord-held, unrest dynamics, garrisons), then `#29` pirates and `#30` combat, which `#43` (mail destroyed on capture) and `#47` (pirates disrupt mail and rumour) hang off; `#32` the Warlord and `#33` agents after; `#21` map colour once world states exist; `#11`'s remainder as each piece needs it; `#34` playtest closes the milestone. `#44`–`#46` are later (rendezvous for orders, controlled-port packet lines, player-established lines).

## Derived facts

| Fact | Value |
|---|---|
| Test status | 74 passed (74) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `events.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `ships.ts`, `types.ts`, `view.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout` |
| Open issues | 28 (`#11`, `#18`–`#47` less `#13`, `#27`; eight close with PR #42) |
| HEAD | 0987c7a — Spec and decisions: captured couriers and packets destroy their mail (branch `worktree-phase1a`, on `worktree-phase1-milestones` 2fbc8e5, on `main` aa3a898) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 13 open / 0 closed. (1a: 8 open / 2 closed; the 8 close when PR #42 merges.)

## Blockers / open questions

- **PR #41 (docs) then PR #42 (1a code) need merging**, in that order; the user merges. PR #42 is a draft until #41 is in. After both: `git pull`, remove worktrees `.claude/worktrees/phase0-prototype` and `.claude/worktrees/phase1-milestones`, delete the branches. 1b should branch from `main` after that.
- No open design questions.
