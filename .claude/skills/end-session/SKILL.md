---
name: end-session
description: Close out a work session — derive current facts, rewrite STATUS.md, file GitHub Issues for everything unresolved, append journal and decisions entries, render the session transcript from the on-disk log, and commit. Run at the end of every work session.
---

# end-session

Order matters: docs first, then commit, so the doc updates ride in the same commit as the session's work.

## 0. Pre-flight

- Confirm you're at the project root (`STATUS.md`, `journal/`, `sessions/` exist). If not, stop and say so.
- `gh auth status` — if it fails, continue, but step 3's fallback applies.

## 1. Derive facts — never recall them

Read the **Derived Facts** table in `CLAUDE.md` and run every command in it. Those outputs are the *only* source for versions, counts, test status, and similar in what follows. If a fact you need has no row, add a row (that's a permanent fix), then run it — do not type the fact from memory.

Also derive: `git log --oneline -10`, `git status --short`, today's date (`date +%F`), and `gh issue list --state open`.

## 2. Rewrite STATUS.md — overwrite, never append

Structure, roughly one screen:

1. First line stamp: `> Generated <date> by /end-session at commit <short-sha>.` (sha of HEAD now; the stamp makes staleness self-evident.)
2. Where things stand — short narrative of current state and current thinking.
3. Derived facts from step 1, each traceable to a command output.
4. Active Milestone: name + link. Point at it; don't restate its contents.
5. Blockers / open questions, if any.

If step 3's fallback fires, its warning block goes **above the stamp**.

## 3. File an Issue for everything unresolved

Every problem, TODO, or "should fix later" surfaced this session that isn't already an open Issue gets one now: `gh issue create --title "..." --body "..."` (assign a milestone where it belongs to one). Nothing outstanding may live only in memory or journal prose.

**If `gh` fails:** do not silently continue. Park the items at the top of `STATUS.md` under `## ⚠ UNFILED ISSUES — gh failed <date>` and tell the user out loud. Filing them is the first task of the next session.

## 4. Append the journal entry

`journal/<YYYY-MM-DD>-<n>.md`, where n = 1 + count of existing entries for today.

Contents: what was done; decisions made (one line each — full rationale goes to decisions.md); Issues opened/closed (`#N`); pointer to `sessions/<same-name>.transcript.md`. Narrative is welcome; tracking is not — the journal narrates plans but is never their only home.

## 5. Append decisions — append-only, never rewrite history

For each real "chose X over Y because Z" this session, append a dated entry to `decisions.md`. If there were none, skip — don't manufacture entries.

`decisions.md` is an append-only ledger. **Never edit or delete a past decision, even when this session reverses it.** When a new decision supersedes an old one, append a fresh dated entry that states the reversal and references the entry it supersedes (e.g. "Supersedes the 2026-07-09 decision to …"); leave the original entry untouched so the reasoning trail stays intact. Optionally add a one-line "→ Superseded by <date>" pointer *appended beneath* the old entry, but do not alter its original text.

## 6. Render the transcript — derive, don't reconstruct

Never write the transcript from memory; read the authoritative on-disk session log.

a. **Locate this session's `.jsonl`.** Invent a random nonce (e.g. `es-<date>-<5 random chars>`), then run:
   `grep -l "<nonce>" ~/.claude/projects/<project-dir>/*.jsonl`
   where `<project-dir>` is the cwd with slashes, dots, and underscores all replaced by dashes (verify by listing `~/.claude/projects/` if unsure). The grep command containing the nonce is written to the current session's log *before* it executes, so the single file it matches **is** this session.
   Fallbacks, in order: (1) if it matches nothing, widen to `grep -rl "<nonce>" ~/.claude/projects --include='*.jsonl'`; (2) if still nothing, take the newest-mtime `.jsonl` in the project dir and say the fallback was used.
b. **Render:**
   `python3 .claude/skills/end-session/scripts/render_transcript.py <found>.jsonl sessions/<YYYY-MM-DD>-<n>.transcript.md --user-label <NAME>`
   The output name must match step 4's journal entry.
c. Verify `sessions/` is still gitignored: `git check-ignore sessions/` — if not, fix `.gitignore` before committing.

## 7. Commit

One commit: session work + all doc updates. Reference closed issues (`fixes #N`). Finish by showing the user `git log --oneline -1` and a one-line summary of what was filed, journaled, and rewritten.
