# CLAUDE.md — Referro.ai

> **Read this first on every task.** Single source of truth for how to work in this codebase.
> For env setup: [`/RUNBOOK.md`](./RUNBOOK.md). For recent activity: [`/docs/SESSION_LOG.md`](./docs/SESSION_LOG.md). For the deep dive: [`/docs/CODEBASE_AUDIT.md`](./docs/CODEBASE_AUDIT.md). For design rationale: [`/docs/UX_FLOW.md`](./docs/UX_FLOW.md).

---

## 1. What Claude Code should know first

1. **DD workflow is mandatory.** Branch off `develop` as `feat/REF-XX-description`. Show a plan before writing code. Wait for approval. After shipping, file a per-ticket record at `/docs/modifications/REF-XX.md` in the same PR. Squash merge.
2. **The database is Azure prod, shared with [@scriptd-stack](https://github.com/scriptd-stack).** Migrations applied via `alembic upgrade head` mutate the live DB. **Push-first rule:** push the migration (and dependent code) before the cofounder pulls. Coordinate by DM.
3. **Default ports:** frontend 8080, backend 8000, local Postgres 5433. (`frontend/vite.config.ts:10` pins port 8080 — older docs that say 5173 are wrong.)
4. **REF-13 (chat popup) is the new outreach UI for `not_contacted` and `drafted` states only.** Every other state still uses the legacy `MessageDraftView` / `PostReplyView`. Real AI plugs in at `TODO(REF-17)` markers in `backend/app/api/v1/ref_chat.py`. Do not extend the chat to other states without a plan.
5. **5 of 6 Service Bus consumers are 14-line stubs.** Most "AI generation" features visible in the UI (outreach generation, follow-ups, flash cards, pitch deck) are placeholders. Don't assume any of them work.

---

## 2. Project context

Referro.ai is a job-search assistant. Users paste a LinkedIn job URL; the product helps them reach out to humans inside that company on LinkedIn rather than apply through a portal. AI parses the job, scrapes likely-warm contacts, drafts outreach, and tracks every conversation through a 16-state lifecycle to offer or close.

Pre-MVP. Production at [getreferro.ai](https://getreferro.ai) currently shows the old kanban UI; the new UX (Stages 1-7C + REF-13) lives on `develop`, not yet deployed.

Repo: monorepo (`frontend/`, `backend/`, `worker/`, `docs/`, `landing/`). Branches: default `develop`, `main` is production-only.

---

## 3. Stack

**Frontend** (`frontend/`, port 8080)
- React 18.3, Vite 5.4, TypeScript 5.8 (strict mode OFF — known tech debt)
- Routing: react-router-dom 6.30
- State: `@tanstack/react-query` 5.83 (server state) + custom `AuthContext` + custom `ReferroingContext` (localStorage-persisted). No Redux, no Zustand.
- UI: shadcn/ui + Radix primitives, Tailwind 3.4. Toasts via `sonner` (the shadcn `Toaster` is mounted but unused).
- Other notable: `canvas-confetti`, `date-fns`, `react-day-picker`.

**Backend** (`backend/`, port 8000)
- FastAPI ≥0.115 + Pydantic 2 + `pydantic-settings`
- SQLAlchemy 2.0 (modern `Mapped[]` syntax), `psycopg[binary]` 3, Alembic ≥1.13
- Auth: HS256 JWT via `python-jose` + `bcrypt`. `HTTPBearer` security scheme.
- API routes are sync (`def`, not `async def`); DB session is sync.

**Worker** (`worker/`, no port)
- Single Python 3.12 process. `asyncio.gather` of 7 coroutines: 6 SB consumers + 1 cleanup loop. Per-consumer engine; `contact_discovery.py` uses default isolation, others (`job_parsing.py`, `cleanup.py`) use `AUTOCOMMIT`.

**Database**: PostgreSQL 16, Azure-hosted by default. **17 tables** (audit Section 4). Current migration head: `l2m3n4o5p6q7` (REF-13).

**External services**: Azure Service Bus (6 queues), Azure AI Foundry (`gpt-4o-mini`), Apify (`harvestapi~linkedin-company-employees`, `harvestapi/linkedin-company`), Azure Blob Storage (stub), Gamma API (stub), ScrapingDog (3rd-tier scrape fallback).

---

## 4. Repo layout

```
Referro.ai/
├── CLAUDE.md                    # this file
├── RUNBOOK.md                   # cold-start guide
├── docker-compose.local.yml     # alternative local Postgres (postgres/postgres, db=referoo)
├── Makefile                     # frontend / backend / worker / migrate / install
├── docs/
│   ├── CODEBASE_AUDIT.md        # 1376-line deep dive
│   ├── UX_FLOW.md               # design rationale per moment
│   ├── SESSION_LOG.md           # append-only session log
│   ├── modifications/           # per-ticket records (REF-13.md, etc.)
│   └── (older docs — supplementary)
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app + CORS
│       ├── core/                # config, security
│       ├── db/                  # base, session, models/
│       ├── api/v1/              # one file per resource group
│       └── services/queue.py    # SB publishers
├── worker/app/
│   ├── main.py                  # asyncio.gather entrypoint
│   ├── consumers/               # SB consumers (job_parsing, contact_discovery + 4 stubs)
│   ├── integrations/            # ai_foundry, blob_storage (stub), gamma (stub)
│   ├── prompts/                 # AI Foundry system prompts
│   └── scraper.py               # 3-tier scraper fallback
└── frontend/src/
    ├── App.tsx                  # all providers + router
    ├── pages/                   # one file per route
    ├── components/
    │   ├── room/                # the new outreach flow
    │   ├── referroing/          # overlay + pill
    │   ├── jobs/                # JobCard, JobsPreview
    │   ├── job-detail/          # legacy /job/:id components
    │   ├── kanban/              # legacy, unreferenced
    │   └── ui/                  # shadcn (don't edit) + project-owned (EmptyState, ErrorState)
    ├── contexts/                # AuthContext, ReferroingContext
    ├── hooks/                   # useJobs, useContacts, useRefChat, etc.
    ├── lib/api/                 # API clients
    ├── lib/                     # contactLifecycle, jobStagePill, utils
    └── types/                   # job.ts, refChat.ts, inbox.ts
```

---

## 5. Critical conventions

**Response envelope.** Every backend endpoint returns `{ "data": ..., "meta": {...}, "error": null }`. No exceptions. Errors raised via `HTTPException(status_code, detail)` — FastAPI handles the response shape.

**Wire format.** Outbound responses are **camelCase** (transformed in serializers like `_contact_to_dict`, `_job_to_dict`). Inbound PATCH bodies are **snake_case** (Pydantic field names match DB columns). Helpers like `MILESTONE_TO_SNAKE` in `frontend/src/lib/api/jobs.ts` convert.

**User ownership.** Every query filters `user_id == current_user.id`. Every job query also filters `is_deleted == False`. Security requirement; no exceptions.

**Async lifecycle.** Long-running work goes through `WorkflowRun`:
```
API: insert WorkflowRun (status=queued) → publish to SB → return 202 + workflow_run_id
Worker: status=running → do work → status=completed/failed (always set error_message on fail)
Frontend: poll GET /workflow-runs/{id} every 2s → stop on terminal
```
Never skip steps. Never go backwards. Long consumers must call `_renew_lock_periodically` (template in `worker/app/consumers/contact_discovery.py`) — default SB lock is 60s, longer jobs need the renew task.

**Frontend state from server.** After any mutation, invalidate the relevant React Query cache. Don't compute fields client-side that the server should own. Cache keys observed: `["jobs"]`, `["jobs", id]`, `["jobs", "archived"]`, `["milestones", jobId]`, `["contacts", jobId]`, `["outreach", jobId, contactId]`, `["ref-chat", jobId, contactId]`, `["workflow-runs", id]`, `["credits"]`, `["dashboard"]`.

**Naming.**
- Branches: `feat/REF-XX-description`, `fix/REF-XX-…`, `chore/REF-XX-…`. Default branch: `develop`. PRs squash-merge.
- React pages: `PascalCase.tsx` in `frontend/src/pages/`.
- Feature components: `PascalCase.tsx` in `frontend/src/components/{feature}/`.
- Hooks: `useFooBar.ts` in `frontend/src/hooks/`.
- API clients: `camelCase.ts` in `frontend/src/lib/api/`.
- Backend routes/models/consumers: `snake_case.py`.
- Migrations: `<rev>_<verb_phrase>.py` (e.g. `add_lifecycle_to_contacts.py`).

**Push-first migration rule.** When you create a migration: push the migration file (and ideally the API/UI code that depends on it) **before** [@scriptd-stack](https://github.com/scriptd-stack) pulls. Coordinate via DM. The Azure DB is shared — there is no separate review environment, and `alembic upgrade head` modifies the live system.

**Secrets stay in `.env`.** Never hardcode API keys, DATABASE_URL, JWT secrets. `settings.VARIABLE_NAME` in Python; `import.meta.env.VITE_*` in frontend.

---

## 6. The DD workflow

A formal modification follows this loop:

1. **Plan.** Write a structured plan (scope, files, tests, decisions, ambiguities). Wait for approval.
2. **Branch.** `git checkout develop && git pull && git checkout -b feat/REF-XX-description`.
3. **Build.** Backend → worker → frontend, in that order when all three layers are touched. Migrations push first.
4. **Smoke test.** At minimum: `cd frontend && npx tsc --noEmit -p tsconfig.app.json` clean, `alembic upgrade head` + `alembic downgrade -1` round-trip clean, manual flow in the browser. For programmatic verification of state-machine work, mint a JWT from `JWT_SECRET_KEY` and exercise the API directly (template: `/tmp/ref13_smoke.py` from REF-13).
5. **Commit.** One commit if small; logical grouping if larger. Conventional message format. No `--no-verify`.
6. **PR.** Title `[REF-XX] short description`, target `develop`, **squash merge** after review.
7. **File a modification record** at `/docs/modifications/REF-XX.md` ≤150 lines, in the **same PR** as the code. Format: see [`/docs/modifications/README.md`](./docs/modifications/README.md). Don't edit modification records after the PR ships — open a new modification if a decision changes.

---

## 7. Lifecycle state machine (the single most important model)

Every selected contact carries a `lifecycle_status` in `contacts.lifecycle_status` (varchar 40). Server-derived from raw timestamps + `outcome` + `outreach_messages` rows. **Single source of truth: `_derive_lifecycle_status` in `backend/app/api/v1/outreach.py:44`.** Called by `_recompute_and_persist` (`outreach.py:80`) on every endpoint that mutates a contact-relevant field.

**Priority cascade (highest first, each short-circuits):**
```
outcome > interview_completed > interview_scheduled >
coffee_chat_completed > coffee_chat_scheduled > replied >
(message-derived: followup_2 > followup_1 > initial) > not_contacted
```

**16 states + 8 outcomes** (defined in `frontend/src/lib/contactLifecycle.ts:STATES` and `:OUTCOMES`):

States: `not_contacted`, `drafted`, `sent`, `followup_1_drafted`, `followup_1_sent`, `followup_2_drafted`, `followup_2_sent`, `replied`, `coffee_chat_scheduled`, `coffee_chat_completed`, `interview_scheduled`, `interview_completed`, then `outcome_<X>` for X in: `offer`, `rejected`, `withdrew`, `not_right_person`, `not_a_fit`, `lost_touch`, `cancelled`, `company_cancelled`.

**Server is permissive; client gates.** The API accepts any combination of timestamp/outcome writes and recomputes. The frontend's `canMarkSent` / `canScheduleCoffeeChat` / `canRecordOutcome` / etc. helpers enforce the linear-with-skips graph (coffee chat is optional; you can go `replied → interview_scheduled` directly).

**Undo mechanic.** Clearing a timestamp (`PATCH {field: null}`) or `outcome` (set null → backend also clears `outcome_recorded_at`) reverts to the previous state via re-derivation. Activity log is **not** rewound on undo (intentional — it's an audit trail).

For the full state graph, transitions, and outcome-per-state mapping: [`/docs/CODEBASE_AUDIT.md`](./docs/CODEBASE_AUDIT.md) Section 9.

---

## 8. The chat-driven popup (REF-13)

For contacts in `not_contacted` or `drafted`, the popup body renders a chat panel (`RefChatPanel.tsx`) instead of `MessageDraftView`'s legacy `not_contacted`/`drafted` branches. Every other state continues to use the existing UIs.

**Storage.** New table `ref_chat_messages` (id, contact_id `ON DELETE CASCADE`, user_id, role, kind, content JSONB, created_at). Migration `l2m3n4o5p6q7`.

**Pure state machine.** `_generate_ref_response` in `backend/app/api/v1/ref_chat.py` — given (contact, user action, current_state, edits_left_after) returns Ref's reply messages + side-effect descriptors + optional `requires_followup`. No DB calls inside; the handler resolves side effects. This is the seam for REF-17.

**Lifecycle invariant.** The chat router only mutates lifecycle in one specific place: when the user clicks "She accepted" on a `not_contacted` contact, the handler INSERTs an `OutreachMessage(type='initial', sent_at=NULL)` and calls `_recompute_and_persist`, in a single transaction. **Mark sent is NOT done in the chat router** — it returns `requires_followup="mark_sent"` and the frontend chains `useUpdateOutreach` to PATCH `sent_at`. Lifecycle mutation stays in one place.

**`TODO(REF-17)` markers** for the future Azure-agent integration:
- `backend/app/api/v1/ref_chat.py:_stub_draft` — placeholder template; agent will generate from contact + job context.
- `backend/app/api/v1/ref_chat.py` — `she_accepted` branch in `_generate_ref_response` calls `_stub_draft`.
- `backend/app/api/v1/ref_chat.py` — text-edit branch does the trivial `[v{n}]` revision; agent will rewrite the draft per the user's instruction.

**Init endpoint** (`POST /jobs/.../ref-chat/init`) is idempotent and seeds for both `not_contacted` (full intro) and `drafted` (re-displays existing draft as a draft_card with fresh `edits_left=2`). Serialized by `SELECT FOR UPDATE` on the contact row.

Spec, decisions, file diffs: [`/docs/modifications/REF-13.md`](./docs/modifications/REF-13.md).

---

## 9. Known stubs and tech debt

**Stub Service Bus consumers (4 of 6).** All 14-18 lines, log a startup message and return. No SB messages are processed:
- `worker/app/consumers/outreach_generation.py`
- `worker/app/consumers/follow_up_generation.py`
- `worker/app/consumers/flash_card_generation.py`
- `worker/app/consumers/pitch_deck_generation.py`

**Stub backend endpoints.** All return `[]` / `null` / 202 with no work:
- `app/api/v1/follow_up.py`, `flash_cards.py`, `pitch_deck.py`, `notes.py`, `inbox.py`, `attachments.py`, `activity.py`

**Queued tickets** (not yet ticketed; diagnosed in conversation context):
- **REF-14** — contact photos. `_extract_photo_url` in `backend/app/api/v1/contacts.py:23` only handles string-shaped values; the Apify `harvestapi~linkedin-company-employees` actor returns `profilePicture` as a dict `{sizes, url}`. Photo URL is in the DB but unreachable through the serializer. ~10-line fix.
- **REF-15** — `jobs.company_logo_url` is NULL on every job (column never written by any worker; git history confirms no commit ever set it). Worker fix to populate at parse time.
- **REF-16** — `Room.tsx` page header has no `<img>` element for a logo at all (independent of REF-15; fixing the column doesn't render the logo).
- **REF-17** — replace REF-13 chat stubs with real Azure agent (markers documented above).

**Other tech debt (audit Section 11):**
- TypeScript strict mode is OFF. 3 pre-existing errors in `frontend/src/data/jobs.ts` (legacy mock).
- Credit deduction commented out in `backend/app/api/v1/contacts.py:166-167` and `:208`. Schema is live (table + columns), deductions intentionally disabled until results validated. Sidebar shows balance unchanged.
- `Job.status` (8-state legacy enum) is set to `Interested` on creation and never advanced. The new flow uses `getStagePill(jobStatus, contactStatuses)` from `frontend/src/lib/jobStagePill.ts`. Don't write to it for the new flow; treat it as legacy.
- Legacy routes still wired but deprecated: `/dashboard` (Index.tsx with kanban widgets), `/job/:id` (JobDetail.tsx with old panels). Don't model new pages on them.
- `kanban/`, `job-detail/`, `JobsSection.tsx`, `JobRow.tsx`, `JobFilters.tsx`, `MetricsCard.tsx`, `TasksCard.tsx`, `DailyGoalCard.tsx` — all legacy. Some imported only by `Index.tsx`; the kanban tree is unreferenced.
- Migration `a476a52207e1_placeholder.py` is a no-op that documents an out-of-band manual fix to the live DB. Lessons-learned artifact; don't replicate.
- 1 of the 17 tables (`outcomes`) is unused. The 1:1 unique constraint on `job_id` is set up but no code path inserts.
- `tags` and `job_tags` tables exist but no code uses them.
- `inbox_items` table exists; the Inbox page generates actions client-side from jobs anyway.

---

## 10. Where to find things

| You need… | Look here |
|---|---|
| Env setup, terminal commands, common failures | [`/RUNBOOK.md`](./RUNBOOK.md) |
| What was done recently | [`/docs/SESSION_LOG.md`](./docs/SESSION_LOG.md) |
| Per-ticket detail (decisions, files, line counts) | [`/docs/modifications/`](./docs/modifications/) |
| Codebase deep dive (every router, every component, the data model) | [`/docs/CODEBASE_AUDIT.md`](./docs/CODEBASE_AUDIT.md) |
| Why a specific UX choice was made | [`/docs/UX_FLOW.md`](./docs/UX_FLOW.md) |
| Service Bus payload schemas | [`/docs/MESSAGE_SCHEMAS.md`](./docs/MESSAGE_SCHEMAS.md) |
| Async job lifecycle | [`/docs/WORKFLOW_LIFECYCLE.md`](./docs/WORKFLOW_LIFECYCLE.md) |
| Operational lessons learned | [`/docs/lessons.md`](./docs/lessons.md) |
| Per-ticket teach-backs | [`/docs/learnings/`](./docs/learnings/) |
| Blob-storage path convention (aspirational, when implemented) | [`/docs/BLOB_PATHS.md`](./docs/BLOB_PATHS.md) |

---

## 11. What NOT to do

- **Don't apply migrations to Azure without coordinating with [@scriptd-stack](https://github.com/scriptd-stack).** Push-first rule.
- **Don't model new pages on `/dashboard` or `/job/:id`.** Those are legacy. New work goes through `/jobs/:id/room`.
- **Don't write to `Job.status` for the new flow.** Derive from contact lifecycle via `getStagePill`. The enum is set on creation and otherwise inert.
- **Don't edit committed alembic migrations.** Create a new revision instead.
- **Don't edit `frontend/src/components/ui/` shadcn files directly.** Extend in new files. (Project-owned files in that dir — `EmptyState.tsx`, `ErrorState.tsx`, `EmptyIllustrations.tsx` — are fine to edit.)
- **Don't use cookies for auth.** JWT in `Authorization: Bearer` header only.
- **Don't hardcode API URLs.** Frontend uses `import.meta.env.VITE_API_BASE_URL`.
- **Don't write raw SQL in API code.** SQLAlchemy ORM. (The worker uses `text(...)` deliberately for performance and explicitness; that's fine there.)
- **Don't use `any` types in new TS code.** Define interfaces. The 3 pre-existing errors in `frontend/src/data/jobs.ts` are tracked debt; don't add to that file.
- **Don't add Redux or Zustand.** React Query + Context is the pattern.
- **Don't use synchronous blocking calls in the worker.** `async`/`await` only.
- **Don't use `isolation_level="AUTOCOMMIT"` in workers that do multi-step writes.** `db.rollback()` becomes a silent no-op. (`contact_discovery.py` was switched to default isolation for this reason; lesson preserved.)
- **Don't assume third-party API output schemas.** Log raw keys and verify before writing extraction logic. The `harvestapi~linkedin-company-employees` actor schema bit us multiple times (`currentPositions` vs `experience[]`, `position` vs `title`, `profilePicture` as dict not string).
- **Don't construct LinkedIn company URLs from name slugs.** Extract from page HTML or use `harvestapi/linkedin-company` with domain validation.
- **Don't store display-layer fields** like `confidence` or `relationship` labels in the DB. Compute them in the API serializer (so threshold tweaks don't need a data migration).
- **Don't forget `_renew_lock_periodically`** in any worker that calls external APIs. Default SB lock is 60s; long jobs need 30s renews.
- **Don't call the disabled posts scraper** (`apimaestro/linkedin-profile-posts`). Removed in REF-PRICING for cost reasons. Only re-enable with a product decision.
- **Don't commit `.env` files.** Use `.env.example`-style committed templates (the `.env.azure` / `.env.local` examples are not yet shipped — REF-19 territory).
- **Don't skip the WorkflowRun lifecycle steps.** queued → running → completed/failed. Always set `error_message` on failure.
- **Don't mutate lifecycle in the REF-13 chat router** except for the explicit `she_accepted` atomic transition. "Mark sent" routes through the existing `useUpdateOutreach` PATCH; don't duplicate that logic.
- **Don't merge your own PRs.** The user reviews and merges.
