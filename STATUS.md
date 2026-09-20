> Generated 2026-09-20 by /end-session at commit f5f683a.

# STATUS

## Where things stand

**Phase 1a is built, previewed, and revised twice.** Session 8 (after a look at how the Royal Navy's packets and advice boats actually moved orders) settled how orders reach a hull that isn't at the capital: *the courier is the mail* — orders stay dispatches addressed to places; the dialog offers the hull's last known port, its destination and its rendezvous (from orders already sent), and where no packet goes or a hull would land sooner, a line to dispatch a hull in port to carry the letter along its own run and return. A hull now takes stranded mail, and copies of every report waiting at a port, only when its run reaches the destination's lane network. Every "report received" in a dossier links to its letter. Two 1b issues came out of the history: captured packets are captured dispatches (`#43`) and calling at the rendezvous for orders (`#44`). Session 6 implemented every code issue in the 1a milestone on branch `worktree-phase1a`, open as **draft PR #42** (stacked on the docs PR #41; closes `#18 #19 #20 #22 #23 #24 #25 #26` on merge). Session 7 showed the user a preview and made the four changes they asked for: unrest is news only at a change of mood (content 0–1 / neutral 2–5 / hostile 6–10) or at either end of the scale, reported once per visit — a fresh game now brings about one letter a week instead of two or three; commanders write from every friendly port on the lanes so a hull can be followed port to port; rumour never touches the map or the dossier's facts and sits beneath the reports; and orders are written in one dialog (hull, where to send the order, destination, task, disposition, afterwards) opened from a world or from a ship, with disposition and rally point travelling as standing orders. The sim now has: `Event` records as the unit of news; `Report.channel` and the events a letter mentions; character traits (loyalty, initiative, competence, ambition); hull roles scout/patrol/escort/transport with `patrol` and `scout` orders that carry their own progress (courier leg index included); charted-first routing with off-lane jumps within jump rating for hulls the desk sends; commanders' letters from every friendly port on the lanes and at the end of a patrol; hulls carrying stranded off-lane mail home; a 14-hull starting fleet with rolled commanders; governors who write on events through a 2d6 disclosure roll shaded by severity, self-loyalty and initiative, with 8–12-week "all quiet" letters and self-serving governors shading unrest down; rumours that spawn from events at ports, hop one lane a week, degrade a little, and arrive as `merchant`/`docks` reports. The UI has Rumours and Fleet tabs, the orders dialog, orders in Outgoing, and a "what the docks say" section per world beneath the reports. Checked end to end in a browser: a scout ordered from the dossier sailed, looked, and its commander's letter landed in the inbox. Save format is v2 (old autosaves are discarded).

Current thinking: the user plays 1a (`#27`) before 1b starts; the question is whether a subordinate feels like a person through letters alone. Things to watch: whether one letter a week is the right texture now that all-quiet letters are a visible share of it, whether following a hull by its port-to-port letters feels good or becomes its own noise, and whether the dialog's six questions are the right six. `#11` moved to 1b for its remainder (Faction fields, escort/blockade/transport orders, the agent post, contact posture). After the playtest, 1b begins with `#28` world states and `#29` pirates.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 74 passed (74) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `events.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `ships.ts`, `types.ts`, `view.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout` |
| Open issues | 26 (`#11`, `#18`–`#44` less `#13`; eight of them close with PR #42) |
| HEAD | f5f683a — Orders by courier and by expectation (branch `worktree-phase1a`, on `worktree-phase1-milestones` 2fbc8e5, on `main` aa3a898) |

## Active milestone

[Phase 1a — Hulls and people](https://github.com/lux-username/imperium-interstellar/milestone/2) — 9 open / 1 closed; 8 close when PR #42 merges, leaving `#27` (playtest).

## Blockers / open questions

- **PR #41 (docs) then PR #42 (1a code) need merging**, in that order; the user merges. PR #42 is a draft until #41 is in. After both: `git pull`, remove worktrees `.claude/worktrees/phase0-prototype` and `.claude/worktrees/phase1-milestones`, delete the branches.
- `#27` playtest is the gate for 1b.
- No open design questions.
