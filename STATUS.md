> Generated 2026-09-21 by /end-session at commit 9806568.

# STATUS

## Where things stand

**Phase 1b is merged (PR #52 → `main` 5e761fe); the 1b playtest (`#34`) is next; the culture name pools are complete on draft PR #48, merged up to `main` and ready for the user's review.** 1b delivered worlds that change hands through a garrison contest, space combat by posture with port guns as a bonus, pirates with havens and questioning, a `transport` order with fuel by jumps, scouts as agents and couriers, the Warlord with his own belief state and monthly priorities staged from forward bases, and events that know their sides — `journal/2026-09-20-9.md` and `2026-09-21-1.md` tell it in full, and `spec.md`/`decisions.md` hold the rulings. Two placeholders await a later pass (`#55`): economy/money and recruiting troops. An 8-seed, 80-week soak with a passive desk delivers ~1 letter a week, holds pirate numbers at 2–6, and grows the Warlord from 6 to 6–12 worlds.

**Culture name pools** (branch `worktree-flavor-research`, PR #48): `design/culture-tables.md` sets two heritage weighting tables (imperial core = British Isles; world = 27 cultures in nine groups; worlds roll 1d3 cultures, officers draw 60% core / 40% world). `src/sim/data/names/` holds 31 culture files — 80 men's and 80 women's given names, 80–100 family or second names, 60–90 places, a naming `pattern` per sex, `notes` on thin spots — with `culture.ts` as schema, `index.ts` holding `CORE` and `WORLD` as data, and `names.test.ts` enforcing sizes, uniqueness, pattern tokens and completeness. Patterns cover family-first orders, Vietnamese gender particles, Russian gendered surnames, Central Asian patronymics and Javanese mononyms. Names session 2 spot-checked the five thinnest women's pools (twelve swaps: named real individuals, novel characters, post-period coinages), swept all 31 files for trademarks and fiction (clean), and verified every culture has all four kinds by running the data. One real defect found and filed: the three **South Asian pools pair Hindu and Muslim given and family names at random** (`#54`) — a data-model fix, an optional `communities` sub-pool, is the recommended route. Nothing draws from the pools yet (`#49`).

Current thinking: **merge PR #48, then the 1b playtest (`#34`)**, then 1c. `#49` (wire the pools into `names.ts`, worlds and officers) should follow the playtest, and `#54` should land before or with it so the wiring draws through communities. `#50` (real sources for the thin pools — the user offered to help) and `#51` (famous-individual pass over the 57 pools not yet checked) are polish for any spare session. `#11` keeps survey and governor orders.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 266 passed (266) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `combat.ts`, `events.ts`, `factions.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `ground.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `pirates.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `scouts.ts`, `ships.ts`, `troops.ts`, `types.ts`, `view.ts`, `warlord.ts`, `world.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout`, `transport` |
| Culture files | 31 in `src/sim/data/names/` |
| Open issues | 16 (`#11`, `#34`–`#40`, `#44`–`#46`, `#49`–`#51`, `#54`, `#55`) |
| HEAD | 9806568 — Journal: names session 1 (branch `worktree-flavor-research`, merged up to `main` 5e761fe) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 4 open / 10 closed. The remaining four are the playtest (`#34`), the economy (`#35`) and the later packet-line issues (`#44`–`#46`). The name pools are unmilestoned flavour work.

## Blockers / open questions

- **PR #48 to merge** (the user merges; it is a draft only because the handoff said so — the work is complete and it merges cleanly). After merging: `git pull` on `main`, then `git worktree remove .claude/worktrees/flavor-research` and `git branch -d worktree-flavor-research`. The worktree is locked by the process of names session 1 (pid 58842, exhausted but still alive); if `worktree remove` refuses, kill that process or `git worktree remove --force`.
- `.claude/worktrees/phase1b` and the local `worktree-phase1b` branch were removed by names session 2 after PR #52 merged; the remote branch was auto-deleted. Nothing else is outstanding in git: `main` is at origin, the stash is empty, no other worktrees.
- No open design questions. The thin-pool flags are `#50`; the community-mixing defect is `#54`.
