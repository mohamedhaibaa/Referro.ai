# REF-28 — `connected` lifecycle state + connection-request deep link

**Branch:** `feat/REF-28-connected-state`
**Status:** shipped

## Scope

**Changed.** The "I sent the connection request" button in the chat
now actually opens the contact's LinkedIn profile in a new tab AND
advances lifecycle to a new state `connected`, sitting between
`not_contacted` and `drafted`.

New state semantics:
- `not_contacted` → `connected`: triggered by clicking the renamed
  "🔗 Send connection request" button. Side-effect-only chat handler
  emits `MarkConnected()`; the `MarkConnected` descriptor sets
  `contact.connected_at = now()` and recomputes lifecycle. Frontend
  also opens `contact.linkedinUrl` in a new tab.
- `connected` → `drafted`: triggered by clicking the existing
  "✅ {first_name} accepted" button. Validation widened from
  `state == NOT_CONTACTED` to `state in (NOT_CONTACTED, CONNECTED)`.
  Legacy contacts that pre-date REF-28 can still complete the
  acceptance step.
- `drafted` → undo → `connected`: automatic via cascade. Deleting
  the initial `OutreachMessage` falls through to the new
  `connected_at IS NOT NULL` check rather than the `NOT_CONTACTED`
  floor. The user's LinkedIn click is preserved.
- `connected` → undo → `not_contacted`: explicit `clearField`
  PATCH of `connected_at: null`.

Schema change: new nullable column `contacts.connected_at TIMESTAMP
WITH TIME ZONE` (migration `m3n4o5p6q7r8`, parent `l2m3n4o5p6q7`).
No backfill — existing rows correctly represent "never connected via
this feature."

Frontend additions: `STATES.CONNECTED` enum, `OUTREACH_STATES` set
membership, `statusLabel` / `shortStatusBadge` / `undoLabel` cases,
`CHAT_OWNED_STATES` membership, `jobStagePill` mapping, `Phase2Panel`
badge classes + "X/N contacted" counter exclusion, dedicated
`sent_connection_request` handler in `RefChatPanel` that opens
LinkedIn before dispatching.

DQ-9: first-name greeting parity. The NOT_CONTACTED `init_chat` seed
now greets the user by first name (`"Hey {user_first}!"` or
`"Alright,"` fallback) matching what the CONNECTED seed does.

**Not changed.** `she_accepted` AI-draft generation path is
unchanged — same `generate_initial_draft` call, same `CreateOutreach`
side-effect, same lifecycle transition to `drafted`. No new AI
functions. No worker changes (lifecycle column was already managed
solely by `_recompute_and_persist` and the worker's `INSERT INTO
contacts` continues to rely on the column's NULL default for
`connected_at`). `MessageDraftView` legacy path untouched (it's no
longer routed for chat-owned states post-REF-22 anyway). `replied`
and post-reply states unchanged.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/migrations/versions/m3n4o5p6q7r8_add_connected_at_to_contacts.py` | new | +20 |
| `backend/app/db/models/job.py` | modified | +3 |
| `backend/app/api/v1/outreach.py` | modified | +9 |
| `backend/app/api/v1/contacts.py` | modified | +3 |
| `backend/app/api/v1/ref_chat.py` | modified | +69 / −22 |
| `frontend/src/lib/contactLifecycle.ts` | modified | +6 |
| `frontend/src/lib/jobStagePill.ts` | modified | +1 |
| `frontend/src/components/room/ContactPopup.tsx` | modified | +8 |
| `frontend/src/components/room/RefChatPanel.tsx` | modified | +13 / −1 |
| `frontend/src/components/room/Phase2Panel.tsx` | modified | +4 / −2 |
| `frontend/src/lib/api/contacts.ts` | modified | +1 |
| `docs/modifications/REF-28.md` | new | this file |
| `docs/modifications/REF-25.md` | modified (Updates section) | +6 |
| `docs/ROADMAP.md` | modified (Issue 1 → Shipped + trim) | net 0 (within ≤500-line cap) |

Net code change: **+114 / −25 = +89 net.** M-sized ticket (lower end)
matching the recon estimate.

## Test plan

Programmatic (run by agent):
- `cd backend && alembic upgrade head` — applied successfully against
  Azure prod (head: `m3n4o5p6q7r8`).
- Azure prod column verification:
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='contacts' AND column_name='connected_at'`
  → `connected_at | timestamp with time zone | YES`.
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean
  (only the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).
- Python AST parse on `ref_chat.py`, `outreach.py`, `contacts.py`,
  `job.py`, the new migration — all OK.
- `grep -rn "STATES.CONNECTED"` in `frontend/src/` — present in 6
  files as expected.
- `grep -n "CONNECTED"` in `outreach.py` — 2 hits (constant + cascade).

Manual (deferred to reviewer): walk the full flow
`not_contacted → connected → drafted → undo → connected → undo →
not_contacted`. Verify the new "🔗 Send connection request" button
opens LinkedIn AND advances lifecycle; the CONNECTED seed renders
with `user_first` greeting; the "✅ {first} accepted" button still
triggers AI draft generation; the drafted-undo correctly falls
through to `connected` (preserving the LinkedIn click); `connected`'s
"Discard connection" PATCHes to NULL → `not_contacted`. Defensive
cases: linkedinUrl null (no `window.open` but state still advances);
legacy contact with `connected_at = NULL` behaves like fresh
`not_contacted`; Phase2Panel "X/N contacted" excludes connected; job
tile pill shows "Connection sent" when no drafts exist.

## Decisions

1. **`CONNECTED` constant exported from `outreach.py`** rather than
   redefining as a literal in `ref_chat.py`. Single source of truth,
   imported via the existing `outreach` import block. Mirrors how
   `NOT_CONTACTED` is shared.

2. **Cascade placement: between message-derived and `NOT_CONTACTED`
   floor.** If an `OutreachMessage(type="initial")` exists, lifecycle
   is at least `drafted` — `connected` shouldn't override. The check
   only fires when there are no messages.

3. **No backfill.** Pre-existing rows have `connected_at = NULL` and
   fall through to `NOT_CONTACTED` as before. Behavior change for
   them is zero. Users who progressed past `not_contacted` via the
   old flow stay where they were.

4. **Click-immediately PATCH** (DQ-8 from recon). Server-bound
   action with `MarkConnected` side-effect. No tab-return detection;
   no AlertDialog confirmation. Undo is cheap if the user changes
   their mind.

5. **DQ-9 first-name greeting parity.** `init_chat`'s NOT_CONTACTED
   seed now uses `user_first` interpolation, matching the CONNECTED
   seed and the REF-25 `_generate_ref_response` pattern. Defensive
   fallback to `"Alright,"` if `User.name` is empty.

6. **`init_chat` CONNECTED branch reuses REF-25's greeting copy.**
   "Nice work, {user_first}! Connection request sent to {first}.
   Come back when they accept and tap the button below to let me
   know." Moved from `_generate_ref_response`'s pre-REF-28 inline
   handler into the new state's init seed. The
   `_generate_ref_response` handler is now side-effect-only; the
   chat re-renders via lifecycle invalidate → `init_chat` re-fires.

7. **REF-25 supersession.** REF-25's mod record gains an Updates
   section noting REF-28 superseded its NOT_CONTACTED post-click
   message path. The `user_first` plumbing on
   `_generate_ref_response` and `init_chat` is unchanged.

8. **Dedicated frontend `sent_connection_request` handler** rather
   than threading `window.open` into the generic server-bound branch.
   Matches the dedicated `copy` / `open_linkedin` / `send_message`
   handler pattern.

9. **`canUndo()` covers `connected` for free** — the helper returns
   true for any state `!= NOT_CONTACTED`. No change needed there.

10. **No `_ACTIVITY_LABELS` entry for `connected_at`.** Activity log
    is reserved for milestones the user explicitly tracks (replies,
    meetings, outcomes). The connection state is visible in the chat
    UI; a redundant activity-log line would be noise.

## Plug-in points

No `TODO(REF-28)` markers. Future considerations: if LinkedIn ever
exposes acceptance detection, the manual "✅ {first} accepted"
button can be replaced (state transition path stays the same).
The "🔗 Send connection request" button isn't currently gated by
`send.isPending` — minor polish if rapid double-clicks become an
issue.
