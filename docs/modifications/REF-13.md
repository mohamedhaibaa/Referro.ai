# REF-13 — Chat popup for `not_contacted` and `drafted` lifecycle states

**Branch:** `feat/REF-13-chat-popup-not-contacted`
**Status:** shipped

## Scope

**Changed.** The contact popup body now renders a chat-driven panel ("Ref")
for `not_contacted` and `drafted` lifecycle states. New persistence layer
(`ref_chat_messages` table) and a stub state-machine endpoint that mirrors
what the Azure agent will do in REF-17. Lifecycle mutation stays in one place:
the chat router only creates an `OutreachMessage` for the "She accepted"
transition; "Mark sent" routes through the existing `useUpdateOutreach` hook.

**Not changed.** PostReplyView, OutcomeDialog, StateTimeline, the popup
header, MessageDraftView's other branches (sent / followup_*), the lifecycle
state machine (`_derive_lifecycle_status`), all useOutreach hooks. No real
AI integration, no copy polish, no accessibility, no mobile.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/migrations/versions/l2m3n4o5p6q7_add_ref_chat_messages.py` | new | 42 |
| `backend/app/api/v1/ref_chat.py` | new | 635 |
| `backend/app/api/v1/router.py` | modified | +1 / -1 |
| `backend/app/db/models/job.py` | modified | +18 |
| `frontend/src/types/refChat.ts` | new | 87 |
| `frontend/src/lib/api/refChat.ts` | new | 33 |
| `frontend/src/hooks/useRefChat.ts` | new | 54 |
| `frontend/src/components/room/RefChatPanel.tsx` | new | 402 |
| `frontend/src/components/room/ContactPopup.tsx` | modified | +13 |
| `docs/modifications/README.md` | new | (this folder's convention) |
| `docs/modifications/REF-13.md` | new | this file |

Total new code: ~1,253 lines across new files; ~33 lines across modified files.

## Test plan

`npx tsc --noEmit -p tsconfig.app.json` clean for new code (3 pre-existing
errors in `src/data/jobs.ts` legacy mock, unchanged by REF-13). Migration
round-trip verified locally:

```
docker-compose -f docker-compose.local.yml up -d
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/referoo \
  alembic upgrade head      # k1l2m3n4o5p6 -> l2m3n4o5p6q7  ✓
DATABASE_URL=...             alembic downgrade -1   # back to k1l2m3n4o5p6  ✓
DATABASE_URL=...             alembic upgrade head   # re-applies cleanly    ✓
```

`ref_chat_messages` confirmed dropped on downgrade; `alembic_version`
correctly tracks the head pointer.

Manual smoke test (run in browser):

1. Open popup on a `not_contacted` contact → typing indicator → intel card +
   Ref intro + "I sent the connection request ✅" button.
2. Click "I sent the connection request" → user chip + Ref text + "She
   accepted! (simulate)" button.
3. Click "She accepted" → user chip + Ref text + draft_card with stub +
   "Edit" / "Looks fire 🔥". Lifecycle moves to `drafted` (Phase 2 panel
   shows "Drafting" badge).
4. Type "make it shorter", send → user bubble + draft_card v1 + counter "1
   left".
5. Type "less formal", send → counter "0 left", input disabled.
6. Click "Looks fire 🔥" → Copy / Open LinkedIn / Mark sent buttons.
7. Click "Mark sent" → existing `useUpdateOutreach` PATCHes `sent_at` →
   lifecycle moves to `sent`. RefChatPanel unmounts. Existing
   MessageDraftView "waiting for reply" UI shows.
8. Reopen popup → existing UI (chat hidden but persisted in DB).
9. Different `not_contacted` contact → fresh chat from step 1.
10. Contact in `replied` state → existing PostReplyView. RefChatPanel does NOT mount.
11. Contact in `followup_1_drafted` state → existing MessageDraftView.

## Decisions

1. **`/docs/UX_FLOW.md` location.** The doc lives on `develop` (commit
   30a20ee), not yet on this branch. Fetched and read directly from
   `origin/develop` for tone reference.
2. **Auto-seed via separate `POST /ref-chat/init` endpoint** rather than a
   GET with side effects. Cleaner read/write separation; serialised by a
   `SELECT FOR UPDATE` on the contact row to prevent double-seeding under
   concurrent loads.
3. **`edits_left` is client-tracked but server-validated.** Frontend reads
   the counter from the latest `draft_card`. Server re-derives from
   `count(role=user, kind=text)` and rejects edits when 0. Client/server
   drift is silently resolved server-side.
4. **Atomic transaction for "She accepted".** A single `db.commit()` writes
   the user chip + new `OutreachMessage` + recomputed lifecycle + Ref's reply
   messages. Any exception rolls back the whole flow.
5. **Stub revision is intentionally trivial.** `text + " [v{n}]"` plus a
   `# TODO(REF-17)` marker at the call site. Real Azure agent will rewrite
   the existing draft per the user's instruction.
6. **`intel_card` seed defends against NULL profile data.** `profile_data`
   is nullified by the cleanup consumer after 30 days; the seed builds the
   card from whatever Contact columns remain (title, company, location,
   tenure_months, university). Falls through to "Limited profile info" only
   if every relevant field is empty.
7. **Test bar:** `tsc --noEmit` + alembic round-trip + manual smoke test.
   No unit tests added (repo has none).
8. **Server validation rejects with 400 + clear `detail`** rather than silent
   no-ops. The client surfaces toasts via the existing `useSendRefChat`
   `onError` handler.

**Implementation deviation from spec:** the `init` endpoint also seeds for
the `drafted` state (re-displays the existing initial message as a
draft_card with fresh edits_left=2). The spec only specified `not_contacted`,
but without this, contacts that predate REF-13 or have had their chat
history wiped would mount RefChatPanel with an empty chat and no recovery
path. The drafted-init seed is idempotent (skipped if any chat row exists),
costs ~25 lines in the backend, and removes a corner-case dead end.

## Plug-in points

`TODO(REF-17)` markers left for the future Azure-agent integration:

- `backend/app/api/v1/ref_chat.py:_stub_draft` — placeholder template for
  initial outreach text. Real agent generates from contact + job context.
- `backend/app/api/v1/ref_chat.py` — `she_accepted` branch in
  `_generate_ref_response` calls `_stub_draft`. Replace with agent invocation.
- `backend/app/api/v1/ref_chat.py` — `text` branch in
  `_generate_ref_response` does the trivial `[v{n}]` revision. Replace with
  agent rewrite per the user's instruction.

REF-14 will migrate the `sent`, `followup_*_drafted`, and `followup_*_sent`
states from MessageDraftView's button UI into the chat. The branching in
`ContactPopup.tsx` (current 3-way ternary) will expand at that time.
