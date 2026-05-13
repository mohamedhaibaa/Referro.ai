# REF-21 — Pinned chat composer + remove no-op Edit button

**Branch:** `feat/REF-21-pinned-composer-textarea`
**Status:** shipped
**Merged:** commit `a626156`, PR #7

## Scope

**Changed.** The Ref chat composer is now pinned to the bottom of the
chat panel during the editing activity (`drafted` && not yet approved).
The "📝 Edit" action button — a no-op that did nothing on click — is
removed from the state machine and the type union. The edits-left
counter moves from the per-draft_card to a single live indicator above
the composer. Enter submits the edit; Shift+Enter inserts a newline
(was Cmd/Ctrl+Enter before).

**Not changed.** Edit-loop mechanics: revisions still appear as inline
chat messages via `ref_chat_messages` rows. `DRAFT_EDITS_INITIAL = 2`
unchanged. Server-side edit-count enforcement (`ref_chat.py:573-579`)
unchanged. AI revision path in `ref_ai.py` unchanged. The `show_counter`
field still flows through the API payload; the client just stops
rendering it (backend cleanup is a separate micro-ticket if anyone
cares). No state-machine work past `drafted` (Issue 5 territory). Hooks
(`useSendRefChat`, `useInitRefChat`, `useRefChatMessages`) unchanged.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/ref_chat.py` | modified | +0 / −5 |
| `frontend/src/types/refChat.ts` | modified | +0 / −1 |
| `frontend/src/components/room/RefChatPanel.tsx` | modified | +14 / −17 |
| `docs/ROADMAP.md` | modified | +2 (Issue 3 Status flip + Updates line) |
| `docs/modifications/REF-21.md` | new | this file |

Net code change: **~−8 lines**.

## Test plan

Programmatic (run by the agent):

- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean, only
  the 3 pre-existing `data/jobs.ts` errors (CLAUDE.md §9).
- `grep -rn "edit_draft" frontend/src/ backend/app/` — zero hits.

Manual (deferred to reviewer; agent cannot drive a browser):

1. Open a `not_contacted` contact → intel card + intro + "I sent the
   connection request ✅". **Composer not rendered.**
2. Click "She accepted (simulate)" → AI generates initial draft →
   composer pins to bottom; counter reads "2 edits left"; placeholder
   "Tell me what to tweak…".
3. Type "make it shorter", press Enter → user bubble appears; AI
   revises; new `draft_card` rendered inline; counter drops to "1 edit
   left".
4. Type "less formal", press Enter → revision; counter "0 edits left";
   textarea disabled; placeholder "0 edits left — hit Looks fire 🔥 to
   send".
5. Typing further is blocked client-side. Server's 400 rejection at
   `ref_chat.py:578` is now unreachable from the UI (defensive only).
6. Click "Looks fire 🔥" → user chip, "Let's go 🚀" message, 3-button
   row (Copy / Open LinkedIn / Mark sent) appears. **Composer
   disappears.**
7. Click "Mark sent" → existing chained flow continues; popup
   re-renders into `MessageDraftView` per the unchanged conditional
   at `ContactPopup.tsx:209`.
8. Reopen a `drafted` contact from before this ticket → `init_chat`
   re-seeds. Composer appears with `edits_left=2`. No "📝 Edit"
   button anywhere in chat history.
9. Test Shift+Enter inserts a newline; Enter submits.
10. Resize viewport to ~600px tall. Verify popup +
    `flex-1 overflow-y-auto` chat scroll region + pinned composer all
    render reasonably. Nested scroll (parent `max-h-[60vh]
    overflow-y-auto` at `ContactPopup.tsx:199` + child `flex-1
    overflow-y-auto` at `RefChatPanel.tsx:190`) is the risk surface.

## Decisions

1. **`not_contacted` composer is hidden, not visible-disabled.** No
   draft exists; the activity is "send the connection request," not
   "edit a draft." Slack pattern: no composer when there's nothing
   to write against.

2. **Post-approve composer is hidden.** After "Looks fire 🔥," the
   activity shifts from editing to sending. The 3-button row is the
   new focus.

3. **Enter sends, Shift+Enter newline.** Was Cmd/Ctrl+Enter. The new
   pattern matches Slack/iMessage chat mental model. Multi-line
   edit instructions are rare in practice (most edits are one short
   sentence); the Shift+Enter cost is acceptable. Paper-plane button
   stays for non-keyboard users.

4. **Counter moved from `DraftCard` to composer area; not duplicated.**
   The counter is a live state of the input, not a property of any
   one draft. Per-card counters across revision history read as
   noise — only the latest count matters.

5. **`show_counter` API field retained, just ignored client-side.**
   Field is preserved for forward compatibility. Backend cleanup is
   its own micro-ticket if anyone cares.

6. **Existing "Couldn't send. Try again?" generic onError toast
   kept.** Server's "No edits remaining" 400 (`ref_chat.py:578`) is
   unreachable from the new UI (client disables the textarea at 0
   edits). Code-level cleanup to surface the specific server message
   is explicitly out of scope per the spec.

7. **No state-machine work past `drafted`.** Issue 5 (Post-Send
   Navigation, ROADMAP.md) will widen the chat conditional and add
   coverage for `sent`, `followup_*`, `replied`, etc. This ticket
   stays inside the `drafted` boundary.

## Plug-in points

No `TODO(REF-21)` markers left. The `show_counter` field is dead
weight in the payload; if cleaned up later it becomes a backend-only
modification with no frontend change.
