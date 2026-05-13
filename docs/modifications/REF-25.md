# REF-25 — Connection-pending copy + user name plumbing

**Branch:** `feat/REF-25-connection-pending-copy`
**Status:** shipped
**Merged:** commit `ced866e`, PR #11

## Scope

**Changed.** Two things in `backend/app/api/v1/ref_chat.py`:

1. The post-"I sent the connection request" message now greets the
   user by first name and reframes the wait as "come back when
   they accept" rather than "tap to simulate." New text:

       Nice work, {user_first}! Connection requests usually take a
       day or two — come back here when {contact_first} accepts and
       tap the button below to let me know.

2. The action button below it changes from
   `"🎉 They accepted! (simulate)"` to `"✅ {contact_first} accepted"`.
   Per PD-2: the button is still the user's manual confirmation (no
   real LinkedIn detection exists), just framed honestly instead of
   labeled "simulate."

3. To plumb the user's first name into the pure state machine,
   `_generate_ref_response` gained an optional `user: User` parameter.
   `post_chat` passes `current_user` through. Empty `User.name` (the
   defensive null case) drops the comma cleanly: "Nice work!"

**Not changed.** Action constants — `ACTION_SHE_ACCEPTED` stays as
`"she_accepted"` (action kind is internal contract; renaming would
force a frontend change too, no benefit). Acceptance mechanism — user
still clicks the button to confirm, no API detection. `init_chat`'s
not_contacted seed (different copy — the initial greeting before the
user has clicked anything — verified no duplicate of the changed string
exists in the seed).

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/ref_chat.py` | modified | +20 / −10 |
| `docs/ROADMAP.md` | modified | +5 (Issue 2 status + Updates + Changelog) |
| `docs/modifications/REF-25.md` | new | this file |

Net code change: **+10 lines.** XS as expected.

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean
  (only the 3 pre-existing `data/jobs.ts` errors).
- `grep -n "They accepted!" backend/app/api/v1/ref_chat.py` — zero
  hits (old simulate label gone).
- `grep -n "(simulate)" backend/app/api/v1/ref_chat.py` — zero hits.
- `grep -n "user_first" backend/app/api/v1/ref_chat.py` — two hits
  (declaration + usage).
- Python AST parse on `ref_chat.py` — OK.

Manual (deferred to reviewer): open a new contact in `not_contacted`,
click "I sent the connection request", verify the response message
matches the new copy with both names interpolated; verify the button
below reads "✅ {contact_first} accepted" and clicking it triggers
the AI draft generation flow (lifecycle → drafted) as before.

## Decisions

1. **Optional `user` parameter on `_generate_ref_response`.** Keeps
   the signature backward-compatible if any future caller doesn't
   have a User in scope. The only current caller (`post_chat` at the
   bottom of the file) always has `current_user` and passes it.

2. **Empty-name fallback strips the comma cleanly.** `User.name` is
   NOT NULL in the schema (`backend/app/db/models/user.py:20`) so
   in practice this case shouldn't fire — defensive only. If
   `user.name` is the empty string or whitespace, `user_first` is
   the empty string and the greeting falls back to `"Nice work!"`.

3. **Kept the `ACTION_SHE_ACCEPTED = "she_accepted"` constant
   unchanged.** PD-2 was a label/UX change, not a contract change.
   The frontend's `RefChatActionKind` union still includes
   `"she_accepted"`; touching it would force a synchronized frontend
   PR for zero functional gain.

4. **Did not rename the "(simulate)" framing in the chat-router
   docstrings or comments.** Some legacy mentions remain in
   `init_chat`'s elsewhere-section comments — those refer to other
   states' affordances. The user-facing strings are the only ones
   that mattered.

5. **No frontend change.** `RefChatPanel.tsx`'s `UserActionChip`
   helper (`ACTION_LABELS` map) renders friendly labels for user
   action echoes, and currently maps `she_accepted → "They accepted"`.
   The chip displays after the user clicks the button — this is a
   short echo in the user's column, not the button label itself, so
   it's fine to keep. If you want it to mirror the new button label
   (e.g., chip reads "✅ {first} accepted") that's a separate small
   change — out of scope per ticket spec.

## Plug-in points

No `TODO(REF-25)` markers. Issue 1 (the `connected` lifecycle state
from PD-1) will revisit this state's UX — at that point the button
label may shift again, since acceptance will move lifecycle into the
new `connected` state rather than directly to `drafted`. The
`user_first` plumbing is reusable for any future Ref copy that should
address the user by name.
