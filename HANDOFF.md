# Handoff — culture name pools (2026-09-20)

Written because the previous session hit its usage limit. **Delete this file once the work below is done.**

## How to work this handoff

**Use Sonnet subagents with minimal context for every remaining task.** The main session should stay small: read this file, then dispatch each numbered task below to a fresh `Agent` call with `model: "sonnet"`, passing *only* the task text and the file paths it names — not this whole file, not the conversation. Each subagent writes its result to disk and reports in a few lines; the main session commits. Do not have the main session read the 31 culture files itself; they are ~300 lines each and that is what exhausted the last session.

Branch: `worktree-flavor-research` (pushed to origin, tracking). Worktree: `.claude/worktrees/flavor-research`. All work below happens on that branch. Verify with `npx vitest run src/sim/data/names` (128+ tests) and `npm run typecheck` after each task.

## What is done

- `design/culture-tables.md` — the two weighting tables (imperial core = British Isles; world = 27 cultures) and how they are used: worlds roll 1d3 cultures from WORLD; officers 60% CORE / 40% WORLD.
- `src/sim/data/names/` — 31 culture files, each ≥80 men's given, ≥80 women's given, ≥80 family/second names, ≥60 places, a `pattern` per sex, and `notes`. `culture.ts` is the schema, `index.ts` holds `CORE` and `WORLD` as data, `names.test.ts` enforces sizes, uniqueness, pattern tokens and index completeness. All committed; 203 tests pass repo-wide.
- Period is Victorian-era in each tradition's own terms. Cultures without hereditary surnames (Turkish, Persian, Uzbek, Kazakh, Uyghur, Siamese, Javanese) use nisbas, epithets or patronymics; the pattern strings and notes say which.

## Remaining tasks (one Sonnet subagent each)

1. **Open the draft PR.** `gh pr create --draft --base main --head worktree-flavor-research` titled "Culture name pools: 31 Victorian-era cultures for worlds and officers". Body: two paragraphs from the "What is done" section above plus the thin-spots list in §Flags. End the body with the attribution footer the harness provides. Nothing else.

2. **File the wiring issue.** `gh issue create` — title "Wire culture name pools into names.ts, worlds and officers", label `sim`. Body: replace the syllable generator in `src/sim/names.ts` (`worldName`, `personName`) with draws from `src/sim/data/names/index.ts`; a world stores 1–3 culture names and takes its name and settlement names from their `places` pools; a character stores one culture name and a sex, and its name is built from `pattern` with `{given}`, `{family}` (use `familyF` for women when present) and `{father}` (a draw from `given.m`). All draws through `src/sim/rng.ts`. Keep uniqueness of world names via the existing `taken` set. Note the Russian patronymic (`{father}ovich/-ovna`) is optional polish. Reference the design doc.

3. **Spot-check five thin files.** For each of `korean.ts`, `siamese.ts`, `aborigine.ts`, `han.ts` (women only), `javanese.ts` (women only): read the file, check the women's given names against what the subagent knows of nineteenth-century usage, and replace anything anachronistic or misspelled in place. Do not grow the lists; do not touch other fields. Run the test after. One subagent per file, in parallel is fine.

4. **Read-through for accidental borrowings.** One subagent greps all 31 files for names that belong to well-known fictional works or trademarks (the project rule: no third-party setting names or trademarks, and no clusters that read as copied from one novel). Report suspects with file and line; the main session decides. The Igbo file already had one such cluster removed.

5. **Update STATUS.md and journal via `/end-session`** once 1–4 are done — the skill does this; do not hand-write.

## Flags for the user (put these in the PR body and mention in the report)

Pools where the record is thin and the user offered to help find alternate sources:

- **Aborigine** — thinnest. Women's given names are mostly the English names of the era because recorded Aboriginal women's names are very few; men's pool mixes recorded names (some of well-known people) with era English names. Also culturally sensitive (names of the dead). Marked in the file's `notes` as a first draft.
- **Korean** — women's names below the gentry were rarely recorded; pool is reconstructed from vernacular -sun/-nyeo/-ok/-hui forms.
- **Siamese** — no surnames until 1913; `family` holds 1913-style constructed surnames so a full name exists. Honorific form (Nai/Nang + given) is the period-correct alternative.
- **Han** and **Javanese** women — pattern-plausible more than attested.
- **Uzbek/Kazakh/Uyghur** — `family` lists (nisbas, clans, trades) are correct in kind but not used by the patronymic patterns; the wiring task decides whether to use them.

## Do not

- Do not re-read the culture files into the main session. Delegate.
- Do not merge or push to `main`. Draft PR only.
- Do not paste from `references/`; it is gitignored third-party material.
