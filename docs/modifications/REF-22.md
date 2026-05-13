# REF-22 — Extend chat coverage past `drafted`

**Branch:** `feat/REF-22-extend-chat-coverage`
**Status:** shipped
**Merged:** commit `7c10862`, PR #8

## Scope

**Changed.** Five new lifecycle states now render in `RefChatPanel`
instead of the legacy `MessageDraftView`: `sent`, `followup_1_drafted`,
`followup_1_sent`, `followup_2_drafted`, `followup_2_sent`. Each state
has both a state-machine branch in `_generate_ref_response` and a
matching seed in `init_chat` for legacy contacts with empty chat
history. New chat actions: `they_replied`, `draft_followup_1`,
`draft_followup_2`, `undo`. Side-effect descriptors generalized
(`CreateInitialOutreach` → `CreateOutreach(type)`; `UpdateInitialOutreach`
→ `UpdateCurrentDraft`; added `DeleteCurrentDraft`, `UndoSent`).
Per-draft edit budget fix (counter resets when a new follow-up is
created). Stale-button toast (DQ-2): server emits a consistent
`Action 'X' is not valid in state 'Y'` 400, frontend parses the
substring and shows "That button is no longer valid — the conversation
has moved on" instead of the generic "Couldn't send" message.

**Not changed.** `replied`, `coffee_chat_*`, `interview_*`, all 8
`outcome_*` — still owned by `PostReplyView` (DD-A: conservative scope
band). The `connected` lifecycle state and the LinkedIn deep link from
Issue 1 are deferred. No new AI functions in `ref_ai.py` (DD-B held):
follow-up drafts use a static `_followup_stub_text` template; real
follow-up AI is Issue 6d. No calendar integration (PD-4 deferred).
`OutreachMessage` schema is unchanged. `MessageDraftView` remains
in the codebase but is no longer reachable for chat-owned states —
flagged as dead-code-in-waiting for a future cleanup.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/ref_chat.py` | modified | +449 / −92 |
| `frontend/src/components/room/RefChatPanel.tsx` | modified | +76 / −14 |
| `frontend/src/components/room/ContactPopup.tsx` | modified | +19 / −5 |
| `frontend/src/hooks/useRefChat.ts` | modified | +21 / −9 |
| `frontend/src/types/refChat.ts` | modified | +8 / −4 |
| `docs/ROADMAP.md` | modified | +6 (Issue 5 status + Updates + Changelog) |
| `docs/modifications/REF-22.md` | new | this file |

Net code change: **+573 / −124 = +449 net.** Within the 350–500
conservative band (upper end). `ref_chat.py` grew from ~670 to ~1018
lines; remains a single file, no organizational refactor.

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean, only
  the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9.
- `grep -rn "edit_draft" frontend/src/ backend/app/` — zero hits
  (REF-21's deletion preserved).
- `grep -rn "CreateInitialOutreach\|UpdateInitialOutreach" backend/app/`
  — zero hits (rename complete).
- `python3 -c "import ast; ast.parse(open('backend/app/api/v1/ref_chat.py').read())"`
  — OK.

Manual smoke (deferred to reviewer): verify per-state seed render,
the full transition chain `drafted → sent → fu1_drafted → fu1_sent
→ fu2_drafted → fu2_sent → replied(→PostReplyView)`, undo from each
chat-owned state, per-draft edit budget reset, composer visibility
(visible in `*_drafted` only), stale-button toast, legacy
`coffee_chat_*` / `outcome_*` contacts still render PostReplyView /
CelebrationView, and small-viewport layout (per-state init_chat does
NOT 400 for legacy contacts with empty chat history).

## Decisions

1. **DQ-1: dropped `replied` from REF-22 scope.** The state needs the
   PostReplyView date-picker / OutcomeDialog UX that DD-C explicitly
   deferred. Including `replied` in chat at this scope band would
   require a bridge to PostReplyView for every scheduling/outcome
   action, which doubles the design problem. `replied` stays routed
   to PostReplyView; the `they_replied` action handler emits the
   acknowledgment chat message + `requires_followup="mark_replied"`,
   and the popup's existing conditional naturally swaps the body on
   lifecycle change. No forced bridge needed.

2. **DQ-2: kept history clickable, improved toast.** Server-side
   validation uses a single template — `Action 'X' is not valid in
   state 'Y'` — across all stale-state 400s. Frontend's
   `useSendRefChat.onError` checks for `"is not valid in state"`
   substring and emits a specific toast. Falls back to the existing
   generic toast for any other error.

3. **DQ-3: descriptors generalized.** `CreateInitialOutreach(text)` →
   `CreateOutreach(type, text)`. `UpdateInitialOutreach(text)` →
   `UpdateCurrentDraft(text)`, type inferred via
   `_current_draft_message_for_contact`. Added `DeleteCurrentDraft()`
   for undo from `fu*_drafted` and `UndoSent()` for undo from
   `*_sent`. `UndoReplied()` reserved (not produced by any REF-22
   code path) for a future ticket that brings `replied` into chat.
   Pre-flight grep confirmed descriptors are private to `ref_chat.py`.

4. **DQ-4: undo routes through chat router.** Each undo emits an
   "Undone — back to <state>" chat message + the rolled-back
   state's action_buttons in a single round-trip. The server
   applies the right side-effect descriptor (`DeleteCurrentDraft` /
   `UndoSent`) based on `current_state`. Frontend's `handleAction`
   for `undo` is uniform: just `send.mutate({action: "undo"})`; no
   per-state chained mutation.

5. **Per-draft edit budget.** REF-13's
   `_count_user_text_messages` counted ALL user text rows for a
   contact, which would break follow-up edits (count would already
   be ≥2 from initial-draft edits). Replaced with
   `_count_user_text_messages_since_current_draft` which only counts
   rows created after the current `OutreachMessage.created_at`.
   Counter naturally resets when a new follow-up row is created.

6. **Undo from `drafted` intentionally NOT supported.** Reverting
   from `drafted` deletes the initial OutreachMessage and sends the
   contact back to `not_contacted`, which interacts with the missing
   `connected` state from PD-1 (Issue 1). The
   `_validation_error("undo", "drafted")` correctly rejects the
   click if a user somehow triggers it from a stale historical
   button.

7. **`replied` chat-owned state explicitly excluded from
   `CHAT_OWNED_STATES`** in `ContactPopup.tsx`. The
   `they_replied` action handler's `requires_followup="mark_replied"`
   triggers a contact invalidate, then the popup's conditional
   re-evaluates and `isPostReplyState(replied) === true` routes to
   PostReplyView. Clean handoff via natural conditional rerun.

## Plug-in points

No new `TODO(REF-22)` markers. Future cleanup tickets:
- **REF-23**: convert PostReplyView (`replied` / `coffee_chat_*` /
  `interview_*` / `outcome_*`) to chat-native. Then add to
  `CHAT_OWNED_STATES` and delete `MessageDraftView`.
- **Issue 6d**: replace `_followup_stub_text` with a real
  `generate_followup` AI call; flip `is_ai_generated=True` for fu
  rows.
- **`UndoReplied` descriptor** in the SideEffect union is reserved
  for the future ticket bringing `replied` into chat; no code path
  produces it yet (defensive 500 if anything does).
