# REF-29 — Hotfix: connected-state chat content doesn't render

**Branch:** `feat/REF-29-connected-state-rendering-fix`
**Status:** shipped

## Scope

**Changed.** REF-28's `ACTION_SENT_CONNECTION` handler in
`backend/app/api/v1/ref_chat.py` was side-effect-only — it emitted
`MarkConnected()` but no response messages. The plan assumed
`init_chat`'s CONNECTED seed would re-fire on lifecycle update.
**That assumption was wrong.** `init_chat` is a first-load helper
gated on `existing_count > 0 → early-return` (line ~707); it never
re-fires for a conversation that already has chat history. After
clicking "🔗 Send connection request" the lifecycle correctly
advanced to `connected` but the chat sat there showing the stale
not_contacted seed with the still-visible button. The
"✅ {first} accepted" affordance never appeared.

REF-29 restores response messages to the handler. It now emits BOTH
the `MarkConnected()` side effect AND the connected-state chat
content (the same "Nice work, {user_first}! Connection request
sent to {first}…" text + "✅ {first} accepted" button that
`init_chat`'s CONNECTED seed produces). Visual parity verified:
both surfaces produce byte-identical text and button.

**Not changed.** The `init_chat` CONNECTED seed itself
(`ref_chat.py` ~line 779) — still correct for users who reopen a
CONNECTED contact with empty chat history (legacy/hypothetical
paths). Migration, cascade, frontend code, all unchanged.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/ref_chat.py` | modified | +22 / −5 |
| `docs/modifications/REF-29.md` | new | this file |
| `docs/modifications/REF-28.md` | modified (Updates) | +5 |

Net code change: **+17 / −5 = +12 net.** Hotfix-sized.

## Test plan

Programmatic:
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean
  (only the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).
- Python AST parse on `ref_chat.py` — OK.
- `grep -n "Connection request sent to" ref_chat.py` — two hits
  (the action handler at ~line 329, the init_chat seed at ~line 786),
  identical content.
- `grep -n "f\"✅ {first} accepted\"" ref_chat.py` — two hits, same
  shape.

Manual (deferred to reviewer): open fresh `not_contacted` contact;
click "🔗 Send connection request"; verify (a) LinkedIn opens, (b)
status header reads "Connection sent", (c) chat now shows the new
"Nice work, …!" message + "✅ {first} accepted" button below the
prior history. Click that button → AI draft flow fires as before.
Close+reopen the popup mid-flow — same content reappears (chat
history is persistent, so init_chat doesn't re-fire; the
parity-matched content was already persisted by REF-29's handler).

## Decisions

1. **Reverse REF-28's Option H-A.** The plan's "side-effect-only,
   let init_chat re-render" assumption broke because init_chat is
   gated on empty chat history. Re-instating response-message
   emission on state-transition actions matches how every other
   handler in the codebase works (`mark_sent`, `she_accepted`,
   `draft_followup_*`, etc. all emit next-state content alongside
   any side effects).

2. **Keep parity between the two surfaces.** Both the
   `ACTION_SENT_CONNECTION` handler and `init_chat`'s CONNECTED
   seed produce byte-identical text + button. If they drift, two
   users in the same logical state would see different content.
   Defended via grep (two hits each, same lines).

3. **`init_chat`'s CONNECTED branch stays.** It covers the empty-
   chat-history reopen case — legacy contacts that somehow arrive
   in `connected` without going through REF-29's handler (rare
   today, but defensive). REF-29 doesn't replace it; the two paths
   coexist.

4. **No frontend change.** The bug was entirely backend — frontend
   `useSendRefChat` already appends `response.newMessages` to the
   chat cache on success. Once the server emits messages again,
   the UI updates naturally.

## Plug-in points

No `TODO(REF-29)` markers. The two-surface parity is a maintenance
hazard for future changes to CONNECTED-state copy — flagged in
inline comments at both sites. If a third surface ever wants to
produce CONNECTED chat content, factor into a shared helper at
that point.
