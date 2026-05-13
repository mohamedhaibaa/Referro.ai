# REF-27 — Fix AlertDialog z-index stacking under ContactPopup

**Branch:** `fix/REF-27-alert-dialog-zindex`
**Status:** shipped

## Scope

**Changed.** The "Did you send the message?" `AlertDialog` introduced
by REF-23/24 now renders ABOVE the `ContactPopup` modal instead of
behind it. Previously the dialog was hidden under the popup's
`backdrop-blur` overlay, which made the send flow look frozen: the
"Waiting…" spinner stayed visible, the user had no way to confirm
sent, and Radix's focus trap silently blocked clicks on everything
else.

**Root cause.** Shadcn's `AlertDialogContent` wrapper at
`frontend/src/components/ui/alert-dialog.tsx:32-43` hardcodes both
its overlay (line 19) and its content (line 37) at `z-50`.
`ContactPopup` (`frontend/src/components/room/ContactPopup.tsx:148-151`)
uses `z-[100]` for its overlay and `z-[101]` for its content. Result:
`50 < 100` → AlertDialog renders below.

**Fix.** Bypass the shadcn `AlertDialogContent` wrapper at the
`RefChatPanel` call site. Render `AlertDialogPrimitive.Overlay` and
`AlertDialogPrimitive.Content` directly with `z-[110]` and `z-[111]`
respectively — both above `ContactPopup`'s stack. Keep all the other
shadcn AlertDialog wrappers (Title, Description, Header, Footer,
Cancel, Action) for styling consistency. The shadcn `ui/alert-dialog.tsx`
file is unchanged (per CLAUDE.md §11: "Don't edit
`frontend/src/components/ui/` shadcn files directly. Extend in new
files.").

**Not changed.** The Send-flow logic — `useEffect` listener, 60s
fallback timer, `confirmOpen` state, `handleConfirmSent` /
`handleNotYet` handlers — all unchanged. The dialog visually appears
when `confirmOpen` flips true; previously it was opening but invisible.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `frontend/src/components/room/RefChatPanel.tsx` | modified | +24 / −9 |
| `docs/modifications/REF-27.md` | new | this file |

Net code change: **+15 net.** XS bug-fix sized.

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean (only
  the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).

Manual (reproduced by user in the bug report):
1. Open a contact, approve a draft, click "📋 Copy & open LinkedIn".
2. Switch to the new LinkedIn tab. Send the DM (or don't).
3. Switch back to Referro.
4. **Verify:** AlertDialog now appears ON TOP of the ContactPopup with
   title "Did you send the message?" and Yes / Not yet buttons.
5. Click "Yes, sent" → spinner stops, message marked sent, sent-state
   buttons appear in chat.
6. Repeat with a "Not yet" click — dialog closes, Send button
   re-enables, no app freeze.

## Decisions

1. **Inline the Radix primitives at the call site** rather than
   creating a new `SendConfirmDialog.tsx` wrapper component. This is
   the only place in the codebase where AlertDialog needs to stack
   above a parent modal; extracting a wrapper would be premature
   abstraction.

2. **Use `z-[110]` / `z-[111]`** (one level above ContactPopup's
   `z-[100]` / `z-[101]`). Leaves room for any future modal that
   needs to stack even higher without forcing a full z-index audit.

3. **Don't edit `ui/alert-dialog.tsx`.** Per CLAUDE.md §11, shadcn
   files in `ui/` are off-limits. The extend-in-place pattern via
   primitives is the supported escape hatch.

4. **Keep all the styling classes from the shadcn wrapper.**
   `AlertDialogPrimitive.Content`'s className mirrors the shadcn
   wrapper's defaults (line 37 of `ui/alert-dialog.tsx`) so the
   visual look is identical apart from z-index.

5. **No backend change.** This was purely a CSS stacking-context
   bug.

## Plug-in points

No `TODO(REF-27)` markers. If another nested modal is ever needed,
the pattern is documented here: bypass the shadcn `*Content` wrapper
and render `*Primitive.Overlay` + `*Primitive.Content` directly with
elevated z-indexes.
