---
name: weekly-reconciliation
description: Drift audit — cross-check STATUS.md and spec.md against the code and git log, prune stale items, fold buried decisions into decisions.md, and dispose of every finding (fix, file, or journal). Run weekly, or a few times over a multi-week project.
---

# weekly-reconciliation

The audit that produced the workflow template *is* this skill — but with teeth: every finding is **fixed, filed, or journaled**. A report nobody acts on is itself out-of-band state, the exact failure this exists to catch.

## 1. Diff docs against reality

For every factual claim in `STATUS.md` and `spec.md` — versions, counts, flags, file/line references, "X is done/shipped/cut" — verify against the code and `git log` by *running commands*: the **Derived Facts** table in `CLAUDE.md` first, ad-hoc greps for the rest. Check STATUS's stamp date against the last commit date. List every contradiction.

## 2. Prune

- Remove STATUS.md claims no longer true (rewrite the file if needed — it's overwrite-mode).
- `gh issue list --state open`: close anything already fixed (with a comment saying where); confirm nothing closed is still described as open in any doc.
- Any "open item" living outside Issues (docs, code comments, auto-memory) → file it or delete it.

## 3. Fold buried decisions

Scan `journal/` entries since the last reconciliation for "chose X over Y" reasoning not yet in `decisions.md`; append it, dated with the *original* decision date.

## 4. Flag duplication and drift patterns

- The same fact in two homes → pick the home, delete the copy, leave a reference.
- Line-number references in docs → replace with symbol/section names (line numbers always rot).
- Docs restating code-owned facts with no Derived Facts row → add the row to CLAUDE.md.
- Out-of-band state (auto-memory, stale code-header comments) contradicting docs.

## 5. Refresh MAP.md

- Regenerate the derived tree block by command (`git ls-files --cached --others --exclude-standard`, via `tree --fromfile` if available) and overwrite it wholesale. Never hand-edit the tree.
- Reconcile the curated annotation table against the fresh tree: delete rows for paths that no longer exist; add rows for significant new paths (ask the user if a new path's purpose isn't obvious from the code).
- Update the stamp line with today's date.

## 6. Dispose of every finding

- Trivially fixable (stale number, wrong count, dead link) → fix in place, now.
- Non-trivial contradiction or structural problem → `gh issue create`, evidence in the body.
- Append today's `journal/` entry: what was checked, found, fixed, filed. This is the queryable record that the audit ran.

## 7. Commit

One commit for the reconciliation (`chore: weekly reconciliation <date>`), referencing issues opened/closed. Tell the user the counts: claims checked, contradictions found, fixed vs. filed.
