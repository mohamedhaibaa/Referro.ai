# REF-26 — Fix workflow_run polling failure mode + clean stuck row

**Branch:** `feat/REF-26-polling-failure-fix`
**Status:** shipped

## Scope

**Changed.** Three things:

1. **`useWorkflowRun` now stops polling on persistent error.** The
   `refetchInterval` callback returns `false` when `query.state.error`
   is set, instead of falling through to the 2-second tick. Combined
   with React Query's default `retry: 3`, this previously meant a
   3-retry storm every 2 seconds on persistent errors. Now `retry: 1`
   + `retryDelay: 1000` caps the storm; the next refetch is gated on
   error state.

2. **`client.ts` 401 handler clears `localStorage["referroing:active"]`.**
   The auth-coupled state previously survived 401 cleanup, which
   meant `ReferroingProvider` re-activated polling against a stale
   `currentRunId` after every re-auth. Now the 401 path clears all
   auth-coupled keys atomically.

3. **One-off cleanup script** at
   `backend/scripts/mark_stuck_workflow_run_failed.py` to flip a
   specific stuck workflow_run to `status='failed'` with a clear
   `error_message`. Idempotent (no-op if already terminal or not
   found). Used initially against id
   `72fa78d8-191d-4c0d-b54b-dc355f050550` (the row identified in the
   diagnosis report).

**Not changed.** Worker / Service Bus investigation — the root cause
of why workflow_runs get stuck `queued` (worker offline, SB lock
loss, DLQ) is deferred to a separate future ticket.
`ReferroingContext`'s 10-minute `STALL_THRESHOLD_MS` still labels
stalled state in the UI but doesn't actively stop the poll — future
polish, out of scope here. Other localStorage keys not audited for
similar auth-coupling issues.

## Files

| Path | New/Modified | Lines |
|---|---|---|
| `frontend/src/hooks/useWorkflowRun.ts` | modified | +8 / −1 |
| `frontend/src/lib/api/client.ts` | modified | +3 / 0 |
| `backend/scripts/mark_stuck_workflow_run_failed.py` | new | +64 |
| `docs/modifications/REF-26.md` | new | this file |

Net code change: **+74 / −1.** Bug-fix sized.

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean
  (only the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).
- `grep -n "referroing:active" frontend/src/lib/api/client.ts` — one
  hit (the new `removeItem` line).
- Python AST parse on the new script — OK.

Manual (deferred to reviewer):
1. With a valid session, trigger contact discovery; verify
   `useWorkflowRun` polls every 2s and stops on completion as before.
2. Simulate 401: DevTools → Application → Local Storage → delete the
   `access_token` entry. Wait ≤2s for the next poll → verify the
   request returns 401 → verify polling halts in the Network tab (no
   more requests to `/workflow-runs`).
3. Verify the 401 handler also cleared `referroing:active`
   (DevTools → Local Storage shows it gone).
4. Run the one-off script:

       cd backend
       source venv/bin/activate
       python -m scripts.mark_stuck_workflow_run_failed \
           72fa78d8-191d-4c0d-b54b-dc355f050550

   Verify it prints `UPDATED: ... status 'queued' -> 'failed' ...`.
   Re-run; verify it prints `ALREADY TERMINAL` (idempotency check).

## Decisions

1. **`retry: 1, retryDelay: 1000`** caps the retry storm without
   eliminating retries entirely. A transient network hiccup still
   gets one retry. Persistent auth/server errors fail after the
   single retry, the error state propagates, and the refetchInterval
   shuts the poll off.

2. **The 401 handler stays a hard redirect** (`window.location.href`).
   Not switched to a soft history push or a React Router navigate.
   The hard redirect tears down all in-flight React Query state,
   which is the cleanest way to ensure no zombie queries survive the
   auth invalidation.

3. **Only `referroing:active` is cleared in the 401 path** — not
   other potentially-stateful keys. Audit of other localStorage usage
   is out of scope. If new auth-coupled keys are introduced later,
   add them to the same block.

4. **The cleanup script lives in `backend/scripts/`** (new
   directory). One-off ops scripts that aren't migrations or worker
   code belong here. Future similar scripts can join it. Not added
   to a Makefile target — invocation is explicit
   (`python -m scripts.<name> <args>`) so an accidental run is
   harder.

5. **Script is idempotent** by design. Defensive against re-runs
   (e.g., during deploy hooks, post-merge scripts) and against
   accidentally pointing at an already-terminal row.

6. **No ROADMAP entry.** REF-26 is a bug fix, not a roadmap Issue
   line item. Diagnosis lives in the agent's diagnosis report for
   the current chat; this mod record is the durable artifact.

## Plug-in points

No `TODO(REF-26)` markers. Follow-up tickets worth considering when
the time comes:

- **Worker / Service Bus investigation** — why did the `queued`
  workflow_run never get picked up? Inspect SB queue stats, DLQ,
  worker process health, lock-token behavior.
- **`ReferroingContext` STALL_THRESHOLD_MS overhaul** — currently
  the 10-min label is decorative. Make it actually clear
  `activeReferro` and unmount the poll. Polish ticket.
- **Audit other localStorage keys for auth-coupling** — Sidebar
  preferences, Inbox filters, etc. If any contain stateful
  references that imply authentication, add them to the 401 path.
