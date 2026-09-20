> Generated 2026-09-20 by /end-session at commit 205d9d3.

# STATUS

## Where things stand

**Phase 1a is built and awaiting playtest.** Session 6 implemented every code issue in the 1a milestone on branch `worktree-phase1a`, open as **draft PR #42** (stacked on the docs PR #41; closes `#18 #19 #20 #22 #23 #24 #25 #26` on merge). The sim now has: `Event` records as the unit of news; `Report.channel` and the events a letter mentions; character traits (loyalty, initiative, competence, ambition); hull roles scout/patrol/escort/transport with `patrol` and `scout` orders that carry their own progress (courier leg index included); charted-first routing with off-lane jumps within jump rating for hulls the desk sends; commanders' letters on reaching the ordered world and at the end of a patrol; hulls carrying stranded off-lane mail home; a 14-hull starting fleet with rolled commanders; governors who write on events through a 2d6 disclosure roll shaded by severity, self-loyalty and initiative, with 8–12-week "all quiet" letters and self-serving governors shading unrest down; rumours that spawn from events at ports, hop one lane a week, degrade a little, and arrive as `merchant`/`docks` reports. The UI has Rumours and Fleet tabs, an order form in every dossier, orders in Outgoing, and a "what the docks say" section per world. Checked end to end in a browser: a scout ordered from the dossier sailed, looked, and its commander's letter landed in the inbox. Save format is v2 (old autosaves are discarded).

Current thinking: the user plays 1a (`#27`) before 1b starts; the question is whether a subordinate feels like a person through letters alone. Two things to watch in that playtest: whether subject lines built from events read well at inbox width, and whether rumours arrive at a rate that feels like texture rather than noise. `#11` moved to 1b for its remainder (Faction fields, escort/blockade/transport orders, the agent post, contact posture). After the playtest, 1b begins with `#28` world states and `#29` pirates.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 66 passed (66) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `events.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `ships.ts`, `types.ts`, `view.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout` |
| Open issues | 24 (`#11`, `#18`–`#40` less `#13`; eight of them close with PR #42) |
| HEAD | 205d9d3 — Spec: record 1a's neutral valence, commander letters, off-lane jumps and carried mail (branch `worktree-phase1a`, on `worktree-phase1-milestones` 2fbc8e5, on `main` aa3a898) |

## Active milestone

[Phase 1a — Hulls and people](https://github.com/lux-username/imperium-interstellar/milestone/2) — 9 open / 1 closed; 8 close when PR #42 merges, leaving `#27` (playtest).

## Blockers / open questions

- **PR #41 (docs) then PR #42 (1a code) need merging**, in that order; the user merges. PR #42 is a draft until #41 is in. After both: `git pull`, remove worktrees `.claude/worktrees/phase0-prototype` and `.claude/worktrees/phase1-milestones`, delete the branches.
- `#27` playtest is the gate for 1b.
- No open design questions.
