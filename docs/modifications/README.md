# Modification records

Every formal modification to Referro.ai is filed here as a single Markdown
record, named for its REF ticket (e.g. `REF-13.md`).

## Convention

- **One file per ticket.** Filename = ticket ID. No nesting.
- **Filed in the same PR as the code.** The record lands alongside the
  implementation so a reviewer reading the diff has the rationale next to it.
- **Concise.** ≤150 lines. Long enough to capture the why; short enough to
  read in one minute. If you need more, link to a longer doc rather than
  inline it.
- **Keep it factual after the PR ships.** This is a record, not a living
  document. Don't edit it later — open a new modification if the decision
  changes.

## Template

```md
# REF-XX — <short title>

**Branch:** feat/REF-XX-...
**Status:** shipped | rolled back

## Scope
What changed. What didn't (explicitly out-of-scope). One paragraph each.

## Files
| Path | New/Modified | Lines |

## Test plan
The smoke test executed before merge. Reproducible steps.

## Decisions
The 3-10 design choices made during planning, with the resolution and any
context the reviewer needs.

## Plug-in points
Any `TODO(REF-XX)` markers left behind for future modifications, with file
paths and line numbers so they're greppable.
```

## Why these exist

The codebase audit (`docs/CODEBASE_AUDIT.md`) is a snapshot. PR descriptions
are ephemeral. Modification records sit between them — a short, durable
record of *why a specific change happened*, filed where future readers will
look first.
