# REF-24 — Send-flow UX fix: remove debounce, relabel button

**Branch:** `feat/REF-24-send-flow-ux-fix`
**Status:** shipped

## Scope

**Changed.** Two small UX fixes to the send flow shipped in REF-23:

1. **Removed the 5-second `visibilitychange` debounce.** In user
   testing, the real workflow (click button → send DM on LinkedIn
   → tab back) takes 2-3 seconds. The 5s threshold blocked the
   AlertDialog from firing, so the only way it appeared was via the
   60s safety timer — which felt broken. Any hidden→visible
   transition now opens the dialog immediately.

2. **Relabeled the button** from "📨 Send message" to
   "📋 Copy & open LinkedIn". The new label describes what the
   button literally does (copy then open LinkedIn); the prior label
   implied the button itself sent the message, which it doesn't.

**Not changed.** All other REF-23 behavior: the AlertDialog itself,
Yes/Not yet logic, Escape handling, linkedinUrl-null fallback,
disabled-while-sendArmed visual, 60s safety timeout (still useful for
side-by-side-window setups where `visibilitychange` may not fire at
all). Backward-compat handlers for legacy 3-button rows unchanged.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/ref_chat.py` | modified | +1 / −1 |
| `frontend/src/components/room/RefChatPanel.tsx` | modified | +10 / −20 |
| `docs/modifications/REF-23.md` | modified | +5 (new Updates section) |
| `docs/modifications/REF-24.md` | new | this file |

Net code change: **~−10 lines.** Genuinely tiny.

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean
  (only the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).
- `grep -rn "📨 Send message" backend/ frontend/src/` — zero hits.
- `grep -rn "📋 Copy & open LinkedIn" backend/ frontend/src/` — one
  hit at `ref_chat.py:235`.
- `grep -n "hiddenSinceMsRef" frontend/src/components/room/RefChatPanel.tsx`
  — only the comment line documenting the removal; no live references.
- Python AST parse on `ref_chat.py` — OK.

Manual (deferred to reviewer): see the test plan in the original
ticket spec — tests 1-10 cover label verification, the immediate
dialog open on tab-return, the 60s fallback still firing, and the
followup-state uniformity.

## Decisions

1. **Rip out `hiddenSinceMsRef` entirely** rather than keeping it and
   just dropping the threshold check. Cleaner — the ref served only
   the debounce; with no debounce it has no purpose. The
   visibility-change handler now reads
   `if (!document.hidden) setConfirmOpen(true)` directly.

2. **Keep the 60s safety timer.** Still serves the side-by-side
   window case where `visibilitychange` doesn't fire at all. DQ-5
   from REF-23 still applies.

3. **No new error path needed for the "user tabs away briefly and
   returns immediately" case.** Previously this was a deliberate
   false-positive guard (debounce). With the debounce gone, every
   return opens the dialog — including the case where the user
   tabbed away by accident without sending. The Not yet path is
   clean (one click to dismiss; user re-clicks Send to retry). User
   testing showed this is rare and the friction is acceptable.

4. **Label format follows the original 3-button row's convention**
   (emoji + descriptive verb phrase). "📋 Copy & open LinkedIn"
   mirrors the prior "📋 Copy message" + "🔗 Open LinkedIn" buttons
   the user already understood from REF-22 era.

5. **No backend logic change.** Server-side `_send_message_button()`
   only changes the label string; the action kind `"send_message"`
   and all validation rules unchanged.

## Plug-in points

No `TODO(REF-24)` markers. The flow is now production-ready as the
user-tested workflow expects.
