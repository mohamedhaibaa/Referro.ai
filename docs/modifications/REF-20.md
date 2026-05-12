# REF-20 — Allow 1–9 contact selection, kill rounds in UX

**Branch:** `feat/REF-20-allow-1-to-9-contact-selection`
**Status:** shipped

## Scope

**Changed.** The "Pick your contacts" screen on `/jobs/:id/room` now allows
the user to select 1 to 9 contacts (was: exactly 3). Regenerating no longer
replaces the visible pool — each new batch of 3 appends to the screen, up
to 9 cards. The per-round revisit mechanic ("Find 9 more — 0.5 credits") is
removed from the UI. Backend `SELECTION_CAP` raised from 3 to 9, and a new
guard on `PATCH /jobs/:id/milestones` blocks `contactSelected: true` when
zero contacts are selected.

**Not changed.** Database schema (`contacts.round_number` column stays, not
null, default 1 — no migration). Worker logic (`contact_discovery.py`) still
fetches and scores 3 contacts per discover call; accumulation is purely a
frontend render change. `POST /jobs/:id/contacts/revisit` endpoint stays
(orphaned with a `NOTE:` comment, pending separate cleanup ticket). The
per-contact `PATCH is_selected` flow, optimistic update, and rollback in
`useContactSelection` are unchanged. Legacy `/job/:id` UI
(`ContactDiscovery.tsx`) is untouched.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `backend/app/api/v1/contacts.py` | modified | +3 / -1 |
| `backend/app/api/v1/jobs.py` | modified | +14 / -0 |
| `frontend/src/components/room/PickContactsPanel.tsx` | rewritten | +213 / -253 |
| `frontend/src/hooks/useContactSelection.ts` | modified | +1 / -1 |
| `docs/modifications/REF-20.md` | new | this file |

Net change ≈ −24 lines of code (the rewritten panel is shorter because the
revisit branch, `EmptySlot`, and `visible` slicing logic all dropped).

## Test plan

`cd frontend && npx tsc --noEmit -p tsconfig.app.json` → clean (3 pre-existing
errors in `src/data/jobs.ts` legacy mock, unchanged by REF-20).

Backend imports verified — `Contact` was already imported, `func` added to
the `sqlalchemy` import. No new external deps.

Manual smoke test (run in browser, by reviewer):

1. Load a job in room state → 3 contacts visible, Confirm disabled.
2. Tick 1 contact → Confirm enables. Untick → Confirm disables.
3. Tick 1, click "Show me different contacts" → pool grows to 6 cards;
   original tick persists; new 3 unselected.
4. Click "Show me different contacts" again → pool grows to 9; selection
   persists; regenerate button disappears.
5. Try to tick a 10th → blocked client-side, toast "You can only select up
   to 9 contacts".
6. Tick 9, click Confirm → PATCH milestones succeeds; phase advances.
7. Tick 1, click Confirm → succeeds (floor of 1).
8. (Backend probe) PATCH `/jobs/:id/milestones {contactSelected: true}`
   while zero contacts have `is_selected=true` → 400, detail "Select at
   least one contact before confirming."
9. Regression: existing job with `round_number > 1` from before REF-20 →
   still renders the latest round cleanly (Math.max preserved).

**Smoke-test posture for this ticket.** Type check + import verification
were run. Manual browser smoke tests (1-7, 9) and backend probe (8) were
deferred to the user — no local DB was configured (Azure prod only), and
the agent does not drive a browser.

## Decisions

1. **Legacy round data: keep `Math.max(roundNumber)` filter.** Existing
   users mid-flow with `round_number > 1` continue seeing their latest
   round; new users always see round 1. Zero data-migration risk. Round
   advance is now unreachable from the UI (no revisit button), so in steady
   state new jobs stay in round 1 forever.

2. **`SELECTION_CAP` count is not filtered by round.** Defensive edge case
   (user has selections across multiple historical rounds) accepted as too
   narrow to pre-solve. One-line follow-up if it ever bites.

3. **Confirm button stays disabled at 0 selected.** Same visual treatment
   as today — no separate "empty state" styling.

4. **Milestone guard only blocks the `true` direction.** A
   `contactSelected: false` payload is not currently a UI surface and
   doesn't need protection.

5. **`EmptySlot` deleted, no regenerate skeleton.** Spinner on the
   regenerate button is sufficient feedback during the 2–10s polling
   window. Fewer than 3 cards just render fewer grid items.

6. **`POST /contacts/revisit` endpoint kept.** Orphaned (no caller), marked
   with a `# NOTE: REF-20 removed the UI caller…` comment. Deletion is a
   separate future ticket; same posture for `useRevisitContacts` hook
   (still exported, unused).

7. **`contacts.round_number` column not dropped, no migration.** Schema
   cleanup is a separate future ticket per the spec.

8. **No automated tests added.** Project has no test suite yet; bootstrap
   is a separate ticket per the user's call.

9. **Worker untouched.** Each discover call still fetches/scores 3
   contacts. The "growing pool" is a pure frontend render change — the
   backend was already accumulating rows in `contacts` and exposing them
   via `GET /contacts`; only the client's `visible` slicing was hiding
   batches 2 and 3.

## Plug-in points

No `TODO(REF-20)` markers left.

Future cleanup tickets to consider:
- Drop `contacts.round_number` column (and the index on it) once we're
  confident no historical query depends on it.
- Delete `POST /jobs/:id/contacts/revisit` endpoint, `useRevisitContacts`
  hook, and `frontend/src/lib/api/contacts.ts:revisitContacts` client.
- Re-score contacts across batches for cross-batch comparability (open
  question 7 from the recon — relevance scores from separate AI calls
  aren't strictly comparable side-by-side).
