#!/usr/bin/env python3
"""
Render a Claude Code session .jsonl log into a human-readable Markdown transcript.

Usage:
    python3 render_transcript.py <session.jsonl> <out.md> [--user-label NAME] [--assistant-label NAME]

Design note: this reads the authoritative on-disk session log and formats it.
It never reconstructs the chat from a model's memory — that would be "recall,
not derive," the failure mode the workflow template exists to prevent.

Rendering rules:
  - user / assistant text     -> shown in full
  - thinking blocks           -> omitted (internal reasoning, not part of the chat)
  - tool calls (tool_use)     -> condensed to one-line [tool: name key=...] notes
  - tool results              -> a neutral dim line (belong to no speaker)
  - subagent sidechains       -> skipped (the Task tool-call line already notes them)
  - meta / summary / plumbing -> skipped
  - compaction boundaries     -> marked inline
  - <system-reminder> blocks  -> stripped from user text
"""
import argparse
import datetime
import json
import re
import sys

ARG_KEYS = ("query", "pattern", "file_path", "command", "keywords", "url",
            "prompt", "skill", "description", "old_string")
SYSTEM_REMINDER_RE = re.compile(r"<system-reminder>.*?</system-reminder>", re.DOTALL)


def fmt_ts(ts):
    try:
        return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%H:%M:%S UTC")
    except Exception:
        return ""


def arg_preview(inp):
    if not isinstance(inp, dict):
        return ""
    for k in ARG_KEYS:
        if k in inp:
            v = str(inp[k]).replace("\n", " ")
            return f" {k}={v[:80] + ('…' if len(v) > 80 else '')!r}"
    return ""


def clean_user_text(t):
    return SYSTEM_REMINDER_RE.sub("", t).strip()


def is_compact_boundary(d):
    if d.get("isCompactSummary"):
        return True
    if d.get("subtype") == "compact_boundary":
        return True
    return False


def render(records, user_label, assistant_label):
    out = ["# Chat Transcript (rendered from session log)\n",
           "*Derived from the on-disk session `.jsonl`, not reconstructed from memory. "
           "User and assistant text in full; thinking omitted; tool calls and results "
           "condensed to one-line notes; subagent sidechains skipped.*\n",
           "\n---\n"]

    for d in records:
        if not isinstance(d, dict):
            continue
        if d.get("isSidechain") or d.get("isMeta"):
            continue
        if is_compact_boundary(d):
            out.append("_· · · context compacted here · · ·_\n")
            out.append("\n---\n")
            continue
        typ = d.get("type")
        if typ not in ("user", "assistant"):
            continue  # summary / system / file-history plumbing

        msg = d.get("message", {})
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", typ)
        content = msg.get("content")

        texts, tool_notes, result_only = [], [], False
        if isinstance(content, str):
            texts = [content]
        elif isinstance(content, list):
            has_text = False
            for b in content:
                if not isinstance(b, dict):
                    continue
                t = b.get("type")
                if t == "text" and b.get("text", "").strip():
                    texts.append(b["text"].strip())
                    has_text = True
                elif t == "tool_use":
                    tool_notes.append(f"[tool: {b.get('name', 'tool')}{arg_preview(b.get('input', {}))}]")
                elif t == "tool_result":
                    result_only = True
                elif t == "image":
                    texts.append("*[image]*")
                    has_text = True
                # thinking / redacted_thinking: intentionally omitted
            if not has_text and not tool_notes and result_only:
                out.append("_— tool results returned —_\n")
                out.append("\n---\n")
                continue

        if role == "user":
            texts = [clean_user_text(t) for t in texts]

        body = "\n\n".join(t for t in texts if t)
        if not body and not tool_notes:
            continue

        ts = fmt_ts(d.get("timestamp", ""))
        label = user_label if role == "user" else assistant_label
        out.append(f"**{label}**" + (f"  ·  {ts}" if ts else "") + "\n")
        if tool_notes:
            out.append("_" + "  ".join(tool_notes) + "_\n")
        if body:
            out.append(body + "\n")
        out.append("\n---\n")

    return "\n".join(out)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    p.add_argument("jsonl", help="session .jsonl log")
    p.add_argument("out", help="output .md path")
    p.add_argument("--user-label", default="USER")
    p.add_argument("--assistant-label", default="CLAUDE")
    a = p.parse_args()

    recs = []
    with open(a.jsonl) as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                recs.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"warning: skipped malformed line {i}", file=sys.stderr)

    with open(a.out, "w") as f:
        f.write(render(recs, a.user_label, a.assistant_label))
    print(f"Wrote {a.out} ({len(recs)} records)")


if __name__ == "__main__":
    main()
