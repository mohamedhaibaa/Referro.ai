# REF-23 — Consolidated send-message flow

**Branch:** `feat/REF-23-consolidated-send-flow`
**Status:** shipped
**Merged:** commit `2f4b315`, PR #9

## Scope

**Changed.** After approving a draft ("Looks fire 🔥") the chat now
shows ONE button — "📨 Send message" — instead of the prior three
(Copy / Open LinkedIn / Mark sent). Clicking it copies the draft to
clipboard, opens LinkedIn in a new tab, then waits for the user to
return. On return (after a ≥5s debounce on `visibilitychange`) an
`AlertDialog` prompts "Did you send the message?" with Yes / Not yet.
Yes dispatches `mark_sent` via the existing chain. Not yet (or
Escape) resets the flow so the user can retry. A 60s fallback timeout
opens the dialog proactively for side-by-side-window setups where
`visibilitychange` may not fire. Backend helper renamed
`_copy_send_buttons` → `_send_message_button`.

**Not changed.** The `mark_sent` action handler, `useUpdateOutreach`
chain, `requires_followup="mark_sent"` flow, all REF-22 chat
coverage. The legacy `"copy"`, `"open_linkedin"`, `"mark_sent"`
client handlers stay in `handleAction` (DQ-7) so historical
action_buttons rows in pre-REF-23 chat histories still work when
clicked. No new AI functions (Issue 6d still future). No state
machine changes — `approve_draft` continues to fire from all
`DRAFT_STATES`, so the consolidated button covers initial + fu1 +
fu2 uniformly through the single `_send_message_button()` helper.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/ref_chat.py` | modified | +9 / −5 |
| `frontend/src/components/room/RefChatPanel.tsx` | modified | +158 / −21 |
| `frontend/src/types/refChat.ts` | modified | +3 / 0 |
| `docs/modifications/REF-23.md` | new | this file |
| `docs/ROADMAP.md` | modified | +8 (Issue 4 status + Updates + Changelog) |

Net code change: **+170 / −26 = +144 net.** Within the S band
(100-200); slight overshoot of the +91 plan estimate due to threading
`sendArmed` through `ChatMessageRow` → `ActionButtons` props (the
spinner-while-armed visual per DQ-11).

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean, only
  the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9.
- `grep -nE '"copy"|"open_linkedin"|"mark_sent"|"send_message"'
  RefChatPanel.tsx` — all 4 handlers present.
- `grep -nE "_copy_send_buttons|_send_message_button" ref_chat.py` —
  only `_send_message_button` (rename complete).
- `grep -rn "edit_draft"` — zero (REF-21 preserved).
- Python AST parse on `ref_chat.py` — OK.

Manual (deferred to reviewer; agent can't drive browser): happy path
(click Send → toast + new tab + Send button shows spinner + tab away
6s → return → AlertDialog → Yes → "Sent! 📤" + sent-state buttons);
linkedinUrl-null case (copy + immediate dialog, adjusted description);
Not yet path (dialog dismiss + Send re-enabled); 60s timeout (open
dialog without tab away); Escape on dialog (= Not yet); outside-click
blocked (default AlertDialog behavior); backward-compat (legacy
3-button row still clickable, mark_sent on stale row triggers REF-22
stale-button toast); followup states (fu1_drafted / fu2_drafted both
show single Send button); mid-flow popup close (no leaks, popup
reopen clean).

## Decisions

1. **DQ-1 button label: "📨 Send message".** Paper-plane connotation
   matches the action; unambiguous about the outcome.

2. **DQ-2 Escape = Not yet.** shadcn `AlertDialog`'s
   `onOpenChange(false)` fires on Escape (and on `AlertDialogCancel`
   click). Routed through `handleNotYet` which resets state. No custom
   `onEscapeKeyDown` needed.

3. **DQ-3 linkedinUrl null degrades gracefully.** Copy still
   succeeds, `window.open` skipped, `confirmOpen` set immediately so
   the dialog appears without waiting for visibilitychange. Dialog
   description copy is conditional: with URL → "Click Yes once the
   DM is sent on LinkedIn." Without URL → "Send the message manually
   on LinkedIn, then come back."

4. **DQ-4 keep the "Copied to clipboard" toast.** Same
   `toast.success` pattern as the legacy copy handler. Brief
   confirmation that one step in the multi-step flow completed.

5. **DQ-5 60s timeout fallback, no manual escape hatch.** The
   visibilitychange listener may not fire in side-by-side-window
   setups. After 60s of `sendArmed` without dialog open, the timer
   proactively opens it. User clicks Not yet if they're afk.

6. **DQ-6 Send button disabled while sendArmed.** Threaded
   `sendArmed` from `RefChatPanel` → `ChatMessageRow` →
   `ActionButtons`. When `sendArmed && kind === "send_message"` the
   button is `disabled` and a `Loader2` spinner is prepended to the
   label.

7. **DQ-7 backward compat: legacy 3-button handlers preserved.**
   `handleAction` still has `"copy"` / `"open_linkedin"` /
   `"mark_sent"` branches. Pre-REF-23 chat histories with the
   3-button action_buttons row still function on click.

8. **DQ-8 helper renamed `_copy_send_buttons` →
   `_send_message_button`.** The name now matches what the helper
   returns (a single button). 2-line rename + docstring.

9. **DQ-11 spinner-prepended label.** "📨 Send message" stays as
   the label; Loader2 icon appears to its left while armed.
   Consistent with the existing composer-send pattern at line ~392
   (`{send.isPending ? <Loader2 .../> : <Send .../>}`).

10. **Race-safe handleConfirmSent.** State resets
    (`setConfirmOpen(false)`, `setSendArmed(false)`) run BEFORE
    `handleAction("mark_sent")` to prevent any window where
    `send.mutate` is in-flight while `sendArmed` is still true.

11. **`sendArmed` and `confirmOpen` are state.** `hiddenSinceMsRef`
    is a ref (internal flag, no re-render needed). `confirmOpenRef`
    mirrors state for the visibility listener's live read (handler
    closes over stale values otherwise).

12. **No new server-side validation.** The `"send_message"` string
    is purely client-side (like `"copy"` and `"open_linkedin"`); it
    never reaches the server. The server only sees `mark_sent`,
    validated by REF-22's existing rules.

## Plug-in points

No `TODO(REF-23)` markers. Future considerations:

- **Reply parsing (Issue 6a/b)** will add a similar
  "send-and-confirm-then-do-X" pattern for capturing the contact's
  reply text. The state-machine shape established here
  (sendArmed + visibility listener + AlertDialog confirmation) is
  the template, but it'll need adaptation for the reply-text flow.

- **Real LinkedIn DM deep-link**: still impossible without URN data
  the codebase doesn't have. Out of scope.

- **The 60s timeout fallback could be made configurable** if user
  feedback suggests it. Currently hardcoded as `60_000` ms.

## Updates

2026-05-13 — REF-24 follow-up: removed 5s debounce (real users move
faster), relabeled button to "📋 Copy & open LinkedIn" for accuracy.
