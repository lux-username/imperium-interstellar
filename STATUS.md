> Generated 2026-09-20 by /end-session at commit d9ccaa8.

# STATUS

## Where things stand

**Phase 1a is merged; Phase 1b is being built; the culture name pools are done and up for review.** PRs #41 (docs) and #42 (1a code) merged to `main` at b7ad774. 1b is in progress on `worktree-phase1b` in a separate session — its branch already carries combat and pirates (#29 #30 #43 #47), troops (#31), scouts-as-agents (#33), the Warlord (#32) and the 1b UI (#21); it has not been PR'd yet and its STATUS entry will supersede this one when it closes.

This session finished the **culture name pools** (branch `worktree-flavor-research`, **draft PR #48**): `design/culture-tables.md` sets two heritage weighting tables (imperial core = British Isles; world = 27 cultures in nine groups); `src/sim/data/names/` holds 31 culture files (≥80 given names per sex, ≥80 family/second names, ≥60 places, a naming `pattern` per sex, `notes`), a `culture.ts` schema, `index.ts` with `CORE` and `WORLD` as data, and `names.test.ts` enforcing sizes, uniqueness, pattern tokens and index completeness. Period is Victorian-era in each tradition's own terms; cultures without hereditary surnames use nisbas, epithets or patronymics. The spot-check pass replaced twelve women's given names across Aborigine, Han, Javanese and Siamese (named real individuals, named characters from a classical novel, post-period coinages); Korean needed nothing; a borrowings sweep over all 31 files found no trademarks or fiction-distinctive names. Nothing draws from the pools yet — that is `#49`.

Current thinking: `#49` (wire the pools into `names.ts`, worlds and officers) should land after 1b, since 1b touches `characters.ts` and world generation. `#50` (thin pools: better sources) and `#51` (Aborigine men's pool) are polish the user can pick up whenever.

## Derived facts

| Fact | Value |
|---|---|
| Test status | 203 passed (203) |
| Typecheck | ok |
| Version | 0.0.1 |
| Sim modules | `characters.ts`, `chart.ts`, `events.ts`, `fleet.ts`, `game.ts`, `generate.ts`, `governors.ts`, `hex.ts`, `lanes.ts`, `mail.ts`, `names.ts`, `orders.ts`, `player.ts`, `rng.ts`, `rumours.ts`, `save.ts`, `ships.ts`, `types.ts`, `view.ts` |
| Order types implemented | `courier`, `hold`, `move`, `patrol`, `scout` |
| Culture files | 31 in `src/sim/data/names/` |
| Open issues | 24 (`#11`, `#21`, `#28`–`#40`, `#43`–`#47`, `#49`–`#51`) |
| HEAD | d9ccaa8 — Names: spot-check thin women's pools; remove handoff (branch `worktree-flavor-research`, on `main` b7ad774) |

## Active milestone

[Phase 1b — Trouble](https://github.com/lux-username/imperium-interstellar/milestone/3) — 13 open / 0 closed (the `worktree-phase1b` branch addresses several; they close when it merges). The name pools are unmilestoned flavour work.

## Blockers / open questions

- **PR #48 (culture name pools) awaits the user's review and merge.** It is independent of 1b and conflicts with nothing on `main`.
- **Worktree lock:** `.claude/worktrees/flavor-research` is still locked by the exhausted earlier session's process; this session worked in it regardless (tree was clean). Once PR #48 merges, remove the worktree and delete the branch.
- No open design questions. The thin-pool flags (Aborigine, Korean, Siamese, Han/Javanese women, Central Asian `family` lists) are in PR #48's body and `#50`.
