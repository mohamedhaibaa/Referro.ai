# Session Log

Append-only log of work sessions. **Newest entry at top.** Each entry is a factual record of what happened — state, decisions, files — not aspirations or commitments. Future readers benefit more from "what is the actual state" than "what was someone thinking about doing next."

For per-ticket detail, see [`/docs/modifications/`](./modifications/).
For project context, see [`/CLAUDE.md`](../CLAUDE.md).
For env setup, see [`/RUNBOOK.md`](../RUNBOOK.md).

---

## Entry format template

```
## YYYY-MM-DD — Session N

**Branch worked on:** feat/REF-XX-description (or develop)
**State at start:** brief
**State at end:** brief

### What was done
- Bullet
- Bullet

### Tickets touched
- REF-XX: status (shipped / queued / blocked / abandoned)

### Decisions made
- Brief rationale of any non-obvious choice

### Loose ends at end of session
- State (not a commitment): "X not yet ticketed", "Y not yet started"

### Files changed
- backend/...
- frontend/...
```

---

## 2026-05-08 — Session 2

**Branch worked on:** `develop` (after PR #3 merge), then `feat/REF-13-chat-popup-not-contacted`, then `chore/REF-18-runbook-and-session-log`.
**State at start:** Stages 1-7C had just merged into develop via the prior session's commit (`0a98bbe`). REF-13 not yet started. CLAUDE.md still claimed Vite ran on 5173.
**State at end:** REF-13 shipped to develop via PR #3 (squash merge `c00d832`). Migration head is `l2m3n4o5p6q7`. Three new docs on develop (`docs/CODEBASE_AUDIT.md`, `docs/UX_FLOW.md`, `INTERVIEW_BRIEF.md`). DD-workflow conventions in place (modification records under `/docs/modifications/`).

### What was done
- **Codebase audit (1376 lines).** End-to-end walkthrough at `/docs/CODEBASE_AUDIT.md`. Covers stack, data model, every router, every worker consumer, every frontend page/component, the lifecycle state machine, migration history, and a modification cheat sheet.
- **UX_FLOW.md (399 lines).** Design rationale doc at `/docs/UX_FLOW.md`, walking through the happy path, every unhappy path, and the "why" behind each design choice.
- **INTERVIEW_BRIEF.md (494 lines).** Project narrative for external use; not Claude-facing.
- **REF-13 implementation.** Chat-driven popup for `not_contacted` and `drafted` lifecycle states. Replaces the relevant branches inside `MessageDraftView`; everything else (`sent`, `followup_*`, post-reply states) untouched. Stub state machine in `backend/app/api/v1/ref_chat.py` (635 lines, pure `_generate_ref_response` function + handler that resolves side effects in a single transaction).
- **Migration `l2m3n4o5p6q7`** added the `ref_chat_messages` table (id, contact_id with `ON DELETE CASCADE`, user_id, role, kind enum, content JSONB, created_at). Round-trip verified locally (upgrade → downgrade → re-upgrade) before push.
- **Programmatic smoke test (19/19 PASS).** `/tmp/ref13_smoke.py` exercised every transition end-to-end against the live Azure DB, then cleaned up its own artifacts.
- **Photo + logo bug diagnosis (no fix).** `/docs/modifications/REF-13.md` records nothing; the diagnosis lives in this log entry's loose ends. Two distinct issues confirmed by querying Azure: (a) `_extract_photo_url` (`backend/app/api/v1/contacts.py:23`) only handles string-shaped values, but the `harvestapi~linkedin-company-employees` actor returns `profilePicture` as a dict `{sizes, url}`; the URL is in the DB but unreachable through the serializer. 0 of 50 inspected profiles had any string-shaped photo key. (b) `jobs.company_logo_url` is NULL on 43/43 active jobs; no commit in git history has ever written to that column. Room.tsx page header has no `<img>` element for a logo at all.

### Tickets touched
- **REF-13** — shipped (PR #3 merged as `c00d832`).
- **REF-18** — in progress (this branch, this session): RUNBOOK + SESSION_LOG + CLAUDE.md refresh.
- REF-14 — not yet ticketed (contact photo extraction missing dict-shape handling).
- REF-15 — not yet ticketed (no worker writes `jobs.company_logo_url`).
- REF-16 — not yet ticketed (Room header has no logo render path).
- REF-17 — not yet ticketed (replace REF-13 chat stubs with real Azure agent; markers in place at `_stub_draft` and the `[v{n}]` revision call site in `backend/app/api/v1/ref_chat.py`).

### Decisions made
- **State validation order in REF-13's `she_accepted` handler.** Spec called for 409 on duplicate `OutreachMessage`. Implementation runs state validation first, so a second `she_accepted` returns 400 ("only valid in not_contacted") before the duplicate check fires. Both reject correctly; 409 is dead code unless lifecycle and message rows desync. Kept the 409 branch as defensive code.
- **`init` extended to also seed `drafted` state.** Spec only specified seeding for `not_contacted`. Without the `drafted` seed, any contact already in `drafted` from before REF-13 would mount RefChatPanel on an empty chat with no recovery path. Idempotent; ~25 lines added.
- **Stub revision is intentionally trivial.** `text + " [v{n}]"`. `TODO(REF-17)` markers placed at every plug-in point.
- **DD-workflow conventions established.** Per-ticket modification records (≤150 lines) live in `/docs/modifications/<TICKET>.md`, filed in the same PR as the code. Convention documented in `/docs/modifications/README.md`.

### Loose ends at end of session
- REF-14, REF-15, REF-16, REF-17 not yet ticketed. Diagnoses recorded above and in conversation context.
- REF-13 left a small contract gap: `she_accepted` returns 400 (state) before 409 (duplicate). 3-line swap available if reviewer prefers 409 surface.
- TypeScript strict mode still off. 3 pre-existing errors in `frontend/src/data/jobs.ts` legacy mock — unchanged by REF-13.
- Cofounder ([@scriptd-stack](https://github.com/scriptd-stack)) has not yet pulled REF-13's migration. Push-first rule held; coordination outstanding.

### Files changed
- `backend/migrations/versions/l2m3n4o5p6q7_add_ref_chat_messages.py` — new (42)
- `backend/app/api/v1/ref_chat.py` — new (635)
- `backend/app/api/v1/router.py` — +1 line
- `backend/app/db/models/job.py` — +18 lines (RefChatMessage class)
- `frontend/src/types/refChat.ts` — new (87)
- `frontend/src/lib/api/refChat.ts` — new (33)
- `frontend/src/hooks/useRefChat.ts` — new (54)
- `frontend/src/components/room/RefChatPanel.tsx` — new (402)
- `frontend/src/components/room/ContactPopup.tsx` — +13 lines (3-way ternary + import)
- `docs/modifications/README.md` — new (49)
- `docs/modifications/REF-13.md` — new (128)
- `docs/CODEBASE_AUDIT.md` — new on develop (1376)
- `docs/UX_FLOW.md` — new on develop (399)
- `INTERVIEW_BRIEF.md` — new on develop (494)

---

## 2026-05-07 — Session 1

**Branch worked on:** `feat/new-ux-chat-home`
**State at start:** develop tip was `1408106` (REF-13-db-cleanup merge). No chat-style Home, no Room flow, no contact popup, no lifecycle state machine. Outreach was a placeholder builder on the legacy `/job/:id` page.
**State at end:** 11 commits on `feat/new-ux-chat-home` (Stages 1 → 7C). Branch ready to merge. Production-style flow scaffolded end-to-end: Home → Referroing overlay → Room Phase 1 → Phase 2 → contact popup → 16-state lifecycle → outcome dialog → celebration.

### What was done

Per `git log --oneline` on develop, in chronological order:

- **Stage 1** (`fde99e5`) — `/` route with the chat-style Home, Dashboard demoted to sidebar item, placeholder routes for Room and per-contact prep pages.
- **Stage 2 polish** (`d5b51dd`) — Referroing overlay rebuilt with letter-by-letter animation, phase-aware stage copy, blur constrained to the main content area (sidebar stays crisp).
- **Stage 3** (`8faa4a3`) — Jobs page redesign: card grid replaces table, search, sort by recency/company/stage, archived tab.
- **Stage 4** (`e77c9a8`) — Room Phase 1: contact discovery, selection, photo display path, 3-cap enforcement.
- **Stage 4.5** (`a0212ee`) — Chained `parsing → contact-discovery` so the Referroing overlay covers both workflows in one continuous moment. Worker `job_parsing.py` publishes the chained discovery message itself.
- **Stage 5** (`0c043f5`) — Contact popup with lifecycle states 1-4 (NOT_CONTACTED → DRAFTED → SENT → FOLLOWUP_*_DRAFTED/SENT). Modal framework, message drafting, debounced auto-save, accordion message history, undo, milestone PATCH fix.
- **Stage 6 + 6.5** (`e23c40f`) — Lifecycle states 5-11 (REPLIED → meeting/interview scheduled/completed → outcome). Server-side `_derive_lifecycle_status` priority cascade. Activity timeline. State-aware outcome dialog (different choices per state). Celebration view for `outcome_offer` (confetti + LinkedIn share). Pitch deck placeholder page. Renamed outcome `ghosted` → `lost_touch`.
- **Stage 7A** (`e90fdb3`) — Restore archived jobs with Undo toast, optimistic React Query cache mutations.
- **Stage 7B** (`388d588`) — Empty states for Jobs page (active and archived), Room contact-discovery loading state, Phase 2 all-closed banner.
- **Stage 7C** (`ce4aa84`) — Skeleton loaders for Jobs / Room / popup, inline error states with Retry, global ErrorBoundary, tightened toast copy.

### Tickets touched
- Pre-DD-workflow session — work is branded as "Stage N" rather than REF-XX.

### Decisions made
- **Lifecycle status is stored AND derived.** Single source-of-truth function `_derive_lifecycle_status` in `backend/app/api/v1/outreach.py:44` runs on every contact-mutating endpoint. Storage (vs. always recompute on read) lets us index/filter on it.
- **16 lifecycle states + 8 outcome values.** `lost_touch` replaces `ghosted` (semantic clarity, no schema change — column was already varchar(20)).
- **3-contact selection cap.** Behavioral target. Cap enforced at the API layer (`SELECTION_CAP = 3` in `contacts.py`).
- **Modal-over-blurred-Room pattern** for the contact popup. Rationale captured in `/docs/UX_FLOW.md`.
- **Server permissive, client gated.** Lifecycle transitions are not transition-validated server-side — the API accepts any timestamp/outcome combination and recomputes. The frontend's `canMarkSent`/`canScheduleCoffeeChat`/etc. helpers in `frontend/src/lib/contactLifecycle.ts` enforce the linear-with-skips graph.

### Loose ends at end of session
- Branch not yet merged into develop (merge happened in Session 2 as commit `0a98bbe`).
- Stage 7D / 7E / 7F not yet planned or started:
  - **7D** — copy polish (read every visible string, tighten inconsistencies, fix engineer-flavored phrasing).
  - **7E** — mobile responsiveness ("not broken" target, not "delightful").
  - **7F** — accessibility (keyboard nav, focus rings, ARIA labels).
- No CLAUDE.md / RUNBOOK refresh after the redesign — done in Session 2 / REF-18.
- Photos + logos visibility unverified at this point.

### Files changed
- `frontend/src/pages/Home.tsx`, `Room.tsx`, `Jobs.tsx`, `CoffeeChatPrep.tsx`, `InterviewPrep.tsx`, `PitchDeck.tsx` — new
- `frontend/src/contexts/ReferroingContext.tsx` — new
- `frontend/src/components/referroing/{ReferroingOverlay,ReferroingPill}.tsx` — new
- `frontend/src/components/room/*` — new (PickContactsPanel, Phase2Panel, ContactPopup, MessageDraftView, PostReplyView, ActivityTimeline, OutcomeDialog, CelebrationView, StateTimeline, ContactCard)
- `frontend/src/components/jobs/JobCard.tsx`, `JobsPreview.tsx` — new
- `frontend/src/lib/contactLifecycle.ts`, `jobStagePill.ts` — new
- `frontend/src/components/ui/{EmptyState,ErrorState,EmptyIllustrations}.tsx` — new
- `frontend/src/components/ErrorBoundary.tsx` — new
- `backend/app/api/v1/contacts.py`, `outreach.py` — substantial expansion (lifecycle derivation, post-reply handlers, activity logging)
- 4 alembic migrations: `h8i9j0k1l2m3` (is_selected), `i9j0k1l2m3n4` (lifecycle_status + replied_at), `j0k1l2m3n4o5` (Stage 6 timestamps + activity_log.contact_id), `k1l2m3n4o5p6` (ghosted→lost_touch data migration)
