# CODEBASE_AUDIT.md — Referro.ai

> A complete walkthrough of the Referro.ai codebase as it stands today (branch `feat/new-ux-chat-home`, last commit `ce4aa84` — Stage 7C). Written for a senior engineer who is starting Monday morning.

---

## Table of Contents

1. [Executive summary](#1-executive-summary)
2. [Stack and infrastructure](#2-stack-and-infrastructure)
3. [Repository structure](#3-repository-structure)
4. [The data model](#4-the-data-model)
5. [Backend architecture](#5-backend-architecture)
6. [Worker architecture](#6-worker-architecture)
7. [Frontend architecture](#7-frontend-architecture)
8. [Critical user flows (end-to-end traces)](#8-critical-user-flows-end-to-end-traces)
9. [The state machine (deep dive)](#9-the-state-machine-deep-dive)
10. [Migrations history](#10-migrations-history)
11. [Tech debt and known issues](#11-tech-debt-and-known-issues)
12. [The "modification cheat sheet"](#12-the-modification-cheat-sheet)
13. [Conventions and norms](#13-conventions-and-norms)
14. [Things I learned that surprised me](#14-things-i-learned-that-surprised-me)
15. [Glossary](#15-glossary)

---

## 1. Executive summary

- **Referro.ai** is a B2C job-search assistant. The premise: instead of submitting cold applications, a candidate pastes a job URL and the product helps them reach out to the right humans inside the company. AI parses the posting, scrapes LinkedIn for likely-warm contacts, and tracks every conversation through a 16-state lifecycle until the job is closed (offer, rejected, lost touch, etc.).
- **Three runtime services:** a React/Vite SPA (port 5173 in CLAUDE.md, 8080 in `vite.config.ts` — see surprises), a FastAPI REST API (port 8000), and an async Python worker process consuming Azure Service Bus. Postgres 16 backs everything.
- **The product is in a UX redesign.** Recent commits read `Stage 1 … Stage 7C`. The new flow lives at `/` (Home → paste URL → "Referroing" overlay → land in `/jobs/:id/room`). The legacy flow at `/dashboard` and `/job/:id` (kanban + job-detail panels) still exists, still imports working hooks, but is not the primary surface area anymore.
- **The "Referroing" moment is the heart of the new product.** A single button click triggers a chained pipeline (parse → contact discovery), shows a fullscreen blur with letter-stagger animation, downgrades to a pill if the user navigates away, and lands them in the Room when discovery finishes. State is held in a single Context (`ReferroingContext`) and persisted to localStorage so a refresh resumes the flow.
- **The lifecycle state machine has two layers.** Per-contact `lifecycle_status` (16 values) is the source of truth, derived server-side from raw timestamps + outcome + outreach messages. The job-level "stage pill" is computed client-side from the array of selected contacts' statuses (`getStagePill` in `frontend/src/lib/jobStagePill.ts`). The legacy `Job.status` enum still exists but is largely cosmetic — it falls back when no contacts have been selected yet.
- **Selection is hard-capped at 3 contacts per job per round.** Contacts come back in batches of 3 (max 9 per round); a "revisit" creates a new round and runs a fresh Apify call, deduplicating against existing `linkedin_url` values. Credits exist in the schema (Numeric 6.1) but the deduction code paths are commented out in `backend/app/api/v1/contacts.py:166-167` and `:208`. Frontend still surfaces the credit balance.
- **Only 2 of 6 worker consumers actually do anything.** `job_parsing.py` (~284 lines) and `contact_discovery.py` (~490 lines) are real. `outreach_generation`, `follow_up_generation`, `flash_card_generation`, `pitch_deck_generation` are 14-line stubs that just log "Listening on queue: …". The Sidebar shows menu items (Resume, Support, Settings) for routes that don't exist yet — they 404.
- **Worker chains parsing → discovery in one moment** (Stage 4.5). The job_parsing worker, after writing the parsed job and company research, inserts a queued `workflow_runs` row with type `contact-discovery` and publishes the message itself. The output payload includes a `_chained_discovery_run_id` field that the frontend's ReferroingContext picks up to pivot polling without unmounting the overlay.
- **The "draft message" feature is real but the AI generation isn't.** When the user clicks "Draft message," a placeholder template is created (`buildStub` in `MessageDraftView.tsx:29`). Auto-save writes to the real `outreach_messages` table on a 500ms debounce. "Mark sent" sets `sent_at`. The lifecycle state machine then moves the contact through drafted → sent → followup_1_drafted → … → outcome. None of this requires AI to function; AI is a future replacement of the stub.
- **Things a new engineer should know in week one:** (1) the response envelope `{ data, meta, error }` is universal; (2) every query filters by `user_id`; (3) every job query also filters `is_deleted == False`; (4) the wire format is camelCase outbound (in serializer), snake_case for PATCH bodies (Pydantic field names); (5) the lifecycle state is *derived* server-side from raw timestamps — never write `lifecycle_status` directly; (6) `_recompute_and_persist` in `backend/app/api/v1/outreach.py:80` is the single function that updates it.

**Primary user flow in one paragraph:** A user lands on `/`, pastes a job URL (LinkedIn or company careers page), hits Enter. Frontend POSTs `/jobs` which creates the Job row + JobMilestone row, publishes a `job-parsing` message to Azure Service Bus, returns `{ data: { ..., workflowRunId } }`. Frontend stashes the active Referro in localStorage and shows the blurred "Referroing" overlay with letter-stagger animation. Worker `job_parsing.py` picks up the message, scrapes the URL with a 3-tier fallback (httpx → Playwright → ScrapingDog), calls Azure AI Foundry to parse the page into structured fields, calls AI Foundry again for "company research" (case studies, talking points), then publishes a chained `contact-discovery` message and writes the new run id into the parsing run's `output_data`. Frontend's `useWorkflowRun` polling detects the parsing completion, ReferroingContext pivots `currentRunId` to the chained discovery run, and continues to poll without re-rendering. Worker `contact_discovery.py` calls Apify's `harvestapi~linkedin-company-employees` actor (using the `company_linkedin_url` extracted at parse time, with multiple fallbacks), filters to active employees, scores all profiles via GPT-4o-mini, takes the top 3 for this batch (1 of 3), and writes them to the `contacts` table with `batch_number=1, round_number=1`. When discovery completes, the overlay either auto-navigates to `/jobs/:id/room` (if still blurred) or just invalidates queries (if pilled). The Room shows three contact cards, the user picks 3, hits Confirm, the JobMilestone `contact_selected` flag is set, and the Room re-renders into Phase 2 — three tiles, each opening a modal that walks the contact through the 16-state lifecycle until an outcome is recorded.

**Key architectural decisions, my reading:**

- **Good:** Service Bus + WorkflowRun lifecycle is robust and the right call. Long AI/scraper jobs would otherwise wedge HTTP requests. The chained parsing→discovery is a clean optimization that keeps the UX one continuous "moment."
- **Good:** Server-derived lifecycle status from raw timestamps + outcome. The single source-of-truth function (`_derive_lifecycle_status`) makes "undo" trivial — clear a timestamp, recompute. The 16-state enum is large but every state is meaningful.
- **Good:** React Query everywhere. Cache keys are consistent (`["jobs"]`, `["contacts", jobId]`, `["outreach", jobId, contactId]`, `["workflow-runs", id]`, `["milestones", jobId]`, `["credits"]`). Polling is configured per-hook (jobs every 5s, workflow runs every 2s).
- **Questionable:** Two parallel routing surfaces (`/dashboard` + `/job/:id` legacy vs `/` + `/jobs/:id/room` new). The legacy still imports the working hooks but its components (`KanbanBoard`, `OutreachBuilder`, `FollowUpScheduler`, …) duplicate behavior the Room now owns. Carrying both forward indefinitely is a maintenance burden.
- **Questionable:** Credit deduction is half-built. Schema exists (`credit_transactions` table, `credits_remaining` Numeric column, signup grants 3.0 credits), the frontend surfaces the balance, but the actual deduction in `discover_contacts` and `revisit_contacts` is commented out. Every campaign is currently free.
- **Questionable:** `frontend/src/components/ui/EmptyState.tsx` is named like a shadcn component but isn't shadcn-managed. The CLAUDE.md rule "don't edit `components/ui/`" doesn't quite line up — `EmptyState.tsx`, `ErrorState.tsx`, `EmptyIllustrations.tsx` are project-owned components living in the shadcn directory. Not wrong, but worth knowing.
- **Mildly weird:** `app/db/base.py` only imports `user, job` modules. The `credit` module containing `CreditTransaction` is imported wherever it's needed but isn't wired into Alembic's autogenerate path. The pricing migration (`g7h8i9j0k1l2`) was hand-written, so this hasn't bitten anyone yet.
- **Mildly weird:** `backend/migrations/versions/a476a52207e1_placeholder.py` is an empty migration whose comment says "applied directly to the database without being committed to git." It exists purely to keep the chain consistent — a story of an out-of-band manual fix.

---

## 2. Stack and infrastructure

### Frontend
- **Framework:** React 18.3 + Vite 5.4 + TypeScript 5.8 (`vite_react_shadcn_ts`).
- **Routing:** `react-router-dom` v6.30 (BrowserRouter + Routes/Route).
- **State:**
  - Server state: `@tanstack/react-query` v5.83 with per-hook polling intervals.
  - Auth state: a custom `AuthContext` backed by localStorage.
  - Referroing state: a custom `ReferroingContext` backed by localStorage (versioned schema, key `referroing:active`).
  - No Redux. No Zustand. No Jotai.
- **Styling:** Tailwind CSS 3.4 + `tailwind-merge` + `class-variance-authority`. Theming via CSS variables (HSL tokens like `hsl(var(--card-yellow))`). PostCSS with autoprefixer.
- **UI primitives:** shadcn/ui (Radix primitives + Tailwind), every component installed in `frontend/src/components/ui/`. The `components.json` is the shadcn config.
- **Notifications:** `sonner` (modern toast lib) is the active toaster. The shadcn `toaster.tsx` also renders but the codebase uses `sonner.toast()` exclusively. Both are mounted in `App.tsx` (lines 32-33) — `<Toaster />` is shadcn, `<Sonner />` is sonner.
- **Icons:** `lucide-react`.
- **Forms:** `react-hook-form` + `@hookform/resolvers` + `zod` are in `package.json` but barely used; auth pages do their own `useState`.
- **Other notable libs:** `canvas-confetti` (used by `CelebrationView.tsx`), `date-fns`, `react-day-picker` (used by Calendar in PostReplyView), `cmdk`, `recharts`, `embla-carousel-react`, `vaul`. Most of these come from the shadcn template and are unused.

### Backend
- **Framework:** FastAPI ≥0.115 with Pydantic 2 + `pydantic-settings`.
- **ORM:** SQLAlchemy 2.0 (modern `Mapped[]` syntax, `mapped_column`).
- **DB driver:** `psycopg[binary]>=3.1`. Connection string must be `postgresql+psycopg://` (per `.env.example`).
- **Migrations:** Alembic ≥1.13.
- **Auth:** `python-jose[cryptography]` for JWT (HS256). `passlib[bcrypt]` is listed but the actual code in `backend/app/core/security.py` calls `bcrypt` directly. `HTTPBearer` is the FastAPI security scheme.
- **Async patterns:** API routes are sync (`def`, not `async def`). DB sessions are SQLAlchemy `sessionmaker` (sync), injected via `Depends(get_db)`. The worker is fully async (`asyncio`).
- **Server runner:** `uvicorn[standard]` (`make backend` → `uvicorn app.main:app --reload --port 8000`).
- **Wire format:** Endpoints return `{ "data": ..., "meta": {...}, "error": null }`. `data` is camelCase. PATCH bodies accept snake_case keys (Pydantic field names).

### Worker
- **Structure:** A single Python process, `python -m app.main`, that fans out via `asyncio.gather()` into 7 coroutines: 6 Service Bus consumers + 1 cleanup loop.
- **Concurrency:** Each consumer is its own `async for msg in receiver:` loop holding the queue lock. Within a consumer, calls run sequentially per message — there's no in-message parallelism.
- **Queues consumed:**
  - `job-parsing` — implemented (284 lines)
  - `contact-discovery` — implemented (490 lines)
  - `outreach-generation` — stub
  - `follow-up-generation` — stub
  - `flash-card-generation` — stub
  - `pitch-deck-generation` — stub
- **Queue published from the worker:** `contact-discovery` (chained from `job_parsing.py:_publish_chained_discovery`). Backend `app/services/queue.py` publishes both `job-parsing` and `contact-discovery` for direct API-triggered runs.
- **DB session:** Worker creates its own `engine` per consumer module. `job_parsing.py` and `cleanup.py` use `isolation_level="AUTOCOMMIT"`. `contact_discovery.py` uses default isolation (transactional). The lessons doc explains this — AUTOCOMMIT made `db.rollback()` a silent no-op when partial writes failed; contact_discovery was switched to standard transactions so rollback actually rolls back.

### Database
- **Engine:** PostgreSQL 16 (image `postgres:16` in `docker-compose.local.yml`).
- **Local port:** 5433 → 5432 mapping (avoids conflicts with system Postgres).
- **Schema:** 16 tables + 1 added later (`credit_transactions`) = 17. Models in `backend/app/db/models/{user,job,credit}.py`. Postgres-specific types: `UUID(as_uuid=True)`, `JSONB`.
- **Indexes:** Selectively per table. `(user_id, status)`, `(user_id, created_at)`, `(job_id, batch_number, round_number)`, etc.

### External services
- **Apify** — LinkedIn scraping. Two actors used:
  - `harvestapi~linkedin-company-employees` — main employee search (paginated by `startPage`, filtered by `titleKeywords` and `locations`).
  - `harvestapi~linkedin-company` — fallback for finding the company's LinkedIn URL when scraping non-LinkedIn job pages.
  - `apimaestro/linkedin-profile-posts` — **disabled in v1.** CLAUDE.md explicitly forbids re-enabling without product approval (cost optimization, REF-PRICING).
  - Auth via `APIFY_API_TOKEN` (in worker `.env` only).
- **Azure AI Foundry** — `gpt-4o-mini` deployment, called via plain HTTPS (`worker/app/integrations/ai_foundry.py`). API version `2024-02-01`. Used for: job parsing (extract title/company/etc. from raw text), company research (case studies, talking points), university extraction from resume, contact relevance scoring (0-100).
- **Azure Service Bus** — message broker. 6 queues, kebab-case names. The `ServiceBusClient.from_connection_string()` is created per-publish in the API and held open for the lifetime of the consumer in the worker. Long-running consumers (contact_discovery) renew the message lock every 30s via `_renew_lock_periodically`.
- **Azure Blob Storage** — schema slot exists (env vars, integration stub), no real upload code (`worker/app/integrations/blob_storage.py` raises `NotImplementedError`).
- **Gamma API** — same: stub only (`worker/app/integrations/gamma.py`).
- **ScrapingDog** — paid scraping fallback for LinkedIn job pages and arbitrary URLs (3rd tier of the scraper). Optional API key.
- **Application Insights** — env var declared, never used.

### Deployment
- **Local dev:** Three terminals:
  - `make frontend` → Vite at port 8080 (config) or 5173 (CLAUDE.md says — see surprises).
  - `make backend` → uvicorn at 8000.
  - `make worker` → blocking `python -m app.main`.
  - `docker-compose -f docker-compose.local.yml up -d` for Postgres.
- **Production deploy:** Not present. CLAUDE.md doesn't describe a deploy pipeline. `Dockerfile` exists in `backend/` and `worker/` but no compose for production, no Helm chart, no Terraform, no GitHub Actions deploy workflow visible (CI workflows existed in an earlier commit per `chore: add GitHub Actions CI workflows for frontend, backend, and worker`, then `chore: remove workflow files for initial push`).
- **Service Bus + AI Foundry are real Azure resources** — assumed always-on.

---

## 3. Repository structure

```
Referro.ai/
├── CLAUDE.md                        # Master project rules — read first
├── CONTEXT.md                       # Phase status / what exists / gaps
├── MEMORY.md                        # Decisions + gotchas + lessons
├── AGENT.md                         # Process Claude/contributor follows
├── SKILLS.md                        # Pattern library (~17k lines, copy-paste)
├── COFOUNDER_GUIDE (1).md           # Onboarding doc explaining the 5-file system
├── PROJECT_KNOWLEDGE.md             # 99k-line comprehensive reference
├── README.md
├── INTERVIEW_BRIEF.md               # untracked, present in working tree
├── Makefile                         # frontend / backend / worker / migrate / install
├── docker-compose.local.yml         # postgres:16 on port 5433
├── .env.example                     # canonical env vars list
├── .github/                         # workflow stubs
├── landing/                         # separate Vercel landing site
├── docs/
│   ├── API_SPEC.md, API_GUIDE.md
│   ├── DATABASE_SCHEMA.md           # tables + columns reference (older)
│   ├── BACKEND_HANDOVER.md          # deepest backend doc (~1.2k lines)
│   ├── FOUNDATION_PACK.md           # foundational components
│   ├── EXECUTION_PLAN.md            # 6-week build plan
│   ├── JOB_CARD_FLOW.md             # job-detail page deep dive (older flow)
│   ├── WEBSITE_BLUEPRINT.md         # frontend wireframes
│   ├── WORKFLOW_LIFECYCLE.md        # async job state diagram
│   ├── MESSAGE_SCHEMAS.md           # SB queue payloads
│   ├── BLOB_PATHS.md                # blob storage path conventions
│   ├── ENVIRONMENT_SETUP.md
│   ├── GIT_WORKFLOW.md              # branch model, PR rules, commit format
│   ├── TECH_STACK.md
│   ├── How to Use Swagger UI for Development.md
│   ├── lessons.md                   # brief append-only learnings log
│   └── learnings/
│       ├── ref12-contact-discovery.md
│       └── ref-pricing-cost-optimization.md
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── migrations/
│   │   └── versions/                # 13 alembic revision files
│   └── app/
│       ├── main.py                  # FastAPI app + CORS + /health
│       ├── core/
│       │   ├── config.py            # Settings (pydantic-settings)
│       │   └── security.py          # bcrypt + JWT helpers
│       ├── db/
│       │   ├── base.py              # SQLAlchemy DeclarativeBase
│       │   ├── session.py           # engine + SessionLocal + get_db
│       │   └── models/
│       │       ├── user.py          # User
│       │       ├── job.py           # Job + 14 other tables
│       │       └── credit.py        # CreditTransaction (added later)
│       ├── api/
│       │   ├── deps.py              # get_current_user
│       │   └── v1/                  # 14 router files + __init__
│       └── services/
│           └── queue.py             # publish_job_parsing / publish_contact_discovery
├── worker/
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── app/
│       ├── main.py                  # asyncio.gather of 7 coroutines
│       ├── core/config.py           # worker Settings (subset of backend)
│       ├── scraper.py               # 3-tier scraper + LinkedIn URL extraction
│       ├── consumers/               # 6 queue consumers + cleanup
│       ├── integrations/
│       │   ├── ai_foundry.py        # gpt-4o-mini wrapper
│       │   ├── blob_storage.py      # NotImplementedError stub
│       │   └── gamma.py             # NotImplementedError stub
│       └── prompts/
│           ├── job_parsing.py       # JOB_PARSING_SYSTEM_PROMPT
│           └── company_research.py  # COMPANY_RESEARCH_SYSTEM_PROMPT
└── frontend/
    ├── package.json
    ├── vite.config.ts               # port 8080, "@" → "./src"
    ├── tsconfig.app.json            # strict: false, noImplicitAny: false
    ├── eslint.config.js             # @typescript-eslint/no-unused-vars: off
    ├── components.json              # shadcn config
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── public/
    └── src/
        ├── main.tsx                 # createRoot
        ├── App.tsx                  # all providers + router
        ├── index.css                # Tailwind layers + CSS variables
        ├── main.tsx
        ├── pages/                   # 12 page components
        ├── components/              # feature components + ui/ (shadcn)
        ├── contexts/                # AuthContext, ReferroingContext
        ├── hooks/                   # 9 custom hooks
        ├── lib/                     # utils, contactLifecycle, jobStagePill, inboxUtils
        ├── lib/api/                 # 8 API client modules
        ├── types/                   # job.ts, inbox.ts
        └── data/                    # legacy mock jobs.ts
```

### Naming conventions observed
- React pages: `PascalCase.tsx` in `pages/`.
- Feature components: `PascalCase.tsx` in `components/{feature}/` (e.g. `room/`, `referroing/`, `inbox/`, `kanban/`, `job-detail/`, `jobs/`).
- Project-owned UI components in `components/ui/` mix lowercase shadcn files with PascalCase project files (`EmptyState.tsx`, `ErrorState.tsx`, `EmptyIllustrations.tsx`).
- Hooks: `useFoo.ts` and one `use-mobile.tsx`, one `use-toast.ts` (kebab-case for shadcn-derived).
- API clients: `camelCase.ts` (`workflowRuns.ts`).
- Backend routers/models: `snake_case.py`.
- Worker consumers: `snake_case.py`.

### Unusual / noteworthy
- `frontend/src/data/jobs.ts` is the only file in `data/` and looks like a legacy mock. Quick `grep` would confirm if anyone still imports it.
- `frontend/src/components/JobsSection.tsx`, `JobRow.tsx`, `JobFilters.tsx`, `MetricsCard.tsx`, `TasksCard.tsx`, `DailyGoalCard.tsx` are dashboard widgets used only by the legacy `Index.tsx` page. They're not part of the new flow.
- `frontend/src/components/kanban/` — referenced only from inside itself. Not imported by any page in the current tree (verified via grep).
- The `landing/` directory at the repo root is a separate Vercel/Resend-driven waitlist site (per commit `Landing page with Vercel + Resend waitlist`). Out of scope for the app.

---

## 4. The data model

The codebase has **17 tables** total. The base 16 from the master schema migration + `credit_transactions` added by the pricing migration. CLAUDE.md still says "16 tables."

### Tables summary

| Table | Rows | Owner | Purpose |
|---|---|---|---|
| `users` | 1 per user | self | Auth identity + credits + plan tier |
| `jobs` | 1 per saved job | `users` | The core entity. Status enum, parsed fields. Soft-deletable. |
| `job_milestones` | 1:1 with `jobs` | `users` | 10 boolean checkpoints. Used for the legacy progress bar. |
| `contacts` | many per job | `users` | Discovered LinkedIn profiles. The lifecycle state machine lives here. |
| `outreach_messages` | many per contact | `users` | Initial / follow-up 1 / follow-up 2 messages with `sent_at`. |
| `follow_ups` | many per job | `users` | Scheduled follow-up reminders (model exists, endpoint stubbed). |
| `notes` | many per job | `users` | Plain text notes (model exists, endpoint stubbed). |
| `tags` | many per user | self | (not used in app code) |
| `job_tags` | M:N | (via parents) | (not used in app code) |
| `activity_log` | many per job | `users` | Insert-only timeline of events (parsing, discovery, contact milestones). |
| `pitch_decks` | many per job | `users` | Gamma deck URLs (stub) |
| `flash_cards` | many per job | `users` | Interview-prep STAR stories (stub) |
| `outcomes` | 1:1 with `jobs` (unique) | `users` | Job-level outcome (model exists, *not used* — outcome lives on contacts) |
| `resumes` | many per user | self | Uploaded resume metadata. Worker reads `extracted_text` to infer university. |
| `inbox_items` | many per user | self | Server-side inbox storage (table exists, no inserts; inbox is generated client-side from jobs) |
| `workflow_runs` | many per user | `users` | Async job tracking. queued → running → completed/failed. |
| `credit_transactions` | many per user | self | Audit log of credit grants and (planned) deductions. |

### Key columns and lifecycle fields

#### `users`
```
id (UUID, PK), email (unique), password_hash, name, avatar_url,
credits_remaining (Numeric 6,1), credits_total (Numeric 6,1),
plan_tier (varchar 20, default 'trial'),
created_at, updated_at
```
Plan tiers per `docs/learnings/ref-pricing-cost-optimization.md`: `trial` (3 credits), `warmup` (20), `grind` (60), `closer` (200 + free revisits).

#### `jobs`
```
id, user_id, title, company, company_logo_url, company_linkedin_url,
url, description, company_research (TEXT, JSON-string),
location, status (varchar 50, default 'Interested'),
fit_score (varchar 10), work_mode (TEXT), role_family (TEXT),
due_date, progress (int), is_deleted (bool),
created_at, updated_at
```
- `status` is the legacy enum: `Interested | Outreach Ready | Outreach Sent | Replied | Meeting Booked | Interviewing | Offer | Closed`. Defaults to `Interested` and *never automatically advances* in the new flow — there's no code path that mutates it from server side based on contact lifecycle. The frontend stage pill derives a label from `contactStatuses` and falls back to this enum only when no contacts have been selected yet.
- `company_research` stores a JSON document (case studies, talking points). Stringified by the worker.
- `is_deleted` is the soft-delete flag. The `restore_job` endpoint flips it back.

#### `job_milestones` (1:1 with jobs, `unique(job_id)`)
10 boolean columns:
```
resume_tailored, contact_selected, outreach_sent, follow_up_sent,
reply_received, interview_scheduled, interview_prep_1, interview_prep_2,
interview_prep_3, outcome_recorded
```
The new Room flow only uses `contact_selected` (set when the user confirms 3 contacts). The other 9 are leftover from the legacy `ProgressTracker.tsx` UI. Job `progress` is computed in `JobDetail.tsx:69` as `Math.round(count(true) / 10 * 100)` — but the new Room never mutates them.

#### `contacts`
```
id, job_id, user_id,
full_name, linkedin_url, title, company, location, university,
tenure_months (int), relevance_score (int 0-100),
profile_data (TEXT, raw Apify JSON),
batch_number (int 1-3), round_number (int default 1),
is_selected (bool default false),
lifecycle_status (varchar 40, default 'not_contacted'),
replied_at, coffee_chat_scheduled_at, coffee_chat_completed_at,
interview_scheduled_at, interview_completed_at,
outcome (varchar 20), outcome_recorded_at,
created_at
```
This is the **state machine table**. `lifecycle_status` is server-derived (see Section 9). `profile_data` is the raw Apify response — the API serializer extracts `photoUrl` from it on read. The cleanup consumer nulls out `profile_data` after 30 days for privacy.

#### `outreach_messages`
```
id, job_id, contact_id, user_id,
message (text), type (varchar 20 — 'initial'|'followup_1'|'followup_2'),
is_ai_generated (bool), sent_at, created_at
```
- One row per `(contact, type)`. Backend returns 409 on duplicate POST.
- `sent_at` set → status moves to `*_sent`. Cleared (PATCH with `sent_at: null`) → moves back to `*_drafted`. Delete the row → fully reverts the message stage.

#### `workflow_runs`
```
id, user_id, job_id (nullable),
type (varchar 50 — same as queue name),
status (queued|running|completed|failed),
input_data (JSONB), output_data (JSONB), error_message,
started_at, completed_at, created_at
```
- 30-day retention for completed, 90-day for failed (via `cleanup.py`).
- Frontend polls this on a 2s interval until terminal.

#### `activity_log`
```
id, job_id, user_id, contact_id (nullable, FK),
type (nullable, varchar 50 — e.g. 'contact_milestone'),
action (varchar 255 — human-readable),
created_at
```
Indexed `(job_id, created_at)` for chronological reads. The contact-popup-driven actions (replied, coffee chat scheduled, etc.) write here via `_log_contact_milestone` in `contacts.py:276`. Worker also writes top-level events (`'Job parsed by AI'`, `'Company research completed by AI'`, `'Contact discovery completed'`).

### Foreign-key relationships (text diagram)

```
users
  ├── jobs.user_id  (and: job_milestones, contacts, outreach_messages,
  │                  follow_ups, notes, tags, activity_log, pitch_decks,
  │                  flash_cards, outcomes, resumes, inbox_items,
  │                  workflow_runs, credit_transactions all carry user_id)
  └── credit_transactions.user_id

jobs
  ├── job_milestones.job_id (1:1 unique)
  ├── contacts.job_id (1:N)
  │     └── outreach_messages.contact_id (1:N)
  │     └── activity_log.contact_id (nullable)
  ├── outreach_messages.job_id (1:N, redundant with contact_id)
  ├── follow_ups.job_id (1:N)
  ├── notes.job_id (1:N)
  ├── activity_log.job_id (1:N)
  ├── pitch_decks.job_id (1:N)
  ├── flash_cards.job_id (1:N)
  ├── outcomes.job_id (1:1 unique — unused)
  ├── inbox_items.job_id (nullable, 1:N)
  ├── workflow_runs.job_id (nullable)
  └── credit_transactions.job_id (nullable)

tags ↔ jobs via job_tags (M:N composite PK)
```

### Subsystem coupling
- **Auth API** uses `users` and `credit_transactions` (signup grants 3 credits).
- **Jobs API** uses `jobs`, `job_milestones`, `contacts` (for the `contactStatuses` array on list/detail).
- **Contacts API** uses `jobs`, `contacts`, `credit_transactions` (deduction code path is currently commented out), `outreach_messages` (via `_recompute_and_persist`), `activity_log`.
- **Outreach API** uses `contacts`, `outreach_messages`. Recomputes `lifecycle_status` on every mutation.
- **Workflow runs API** is read-only — the worker writes status transitions.
- **Worker `job_parsing`** writes to `jobs`, `activity_log`, `workflow_runs`, and inserts a queued `workflow_runs` for the chained discovery.
- **Worker `contact_discovery`** writes to `contacts`, `activity_log`, `workflow_runs`. Reads from `resumes` for university extraction.
- **Worker `cleanup`** updates `contacts.profile_data` and deletes from `workflow_runs`.

### Lifecycle states for stateful entities

#### Job status (`jobs.status`)
Legacy enum, eight values, transitions are **not enforced server-side and almost never set in the new flow**:
```
Interested → Outreach Ready → Outreach Sent → Replied →
Meeting Booked → Interviewing → Offer → Closed
```
Only the legacy JobDetail page has a `<select>` that PATCHes this. The Room never touches it.

#### Contact lifecycle status (`contacts.lifecycle_status`) — 16 values
See Section 9. `not_contacted` (default) → drafted → sent → followup_1_drafted → followup_1_sent → followup_2_drafted → followup_2_sent → replied → coffee_chat_scheduled → coffee_chat_completed → interview_scheduled → interview_completed → outcome_{offer|rejected|withdrew|not_right_person|not_a_fit|lost_touch|cancelled|company_cancelled}.

#### Outcome enum (`contacts.outcome`)
```
offer | rejected | withdrew | not_right_person | not_a_fit |
lost_touch | cancelled | company_cancelled
```
Renamed `ghosted` → `lost_touch` in migration `k1l2m3n4o5p6` (Stage 6.5).

#### WorkflowRun status (`workflow_runs.status`)
```
queued → running → completed | failed
```
See `docs/WORKFLOW_LIFECYCLE.md` for the canonical flow.

---

## 5. Backend architecture

### Entry point
`backend/app/main.py` (23 lines):
- Creates `FastAPI(title="Referoo API", version="1.0.0")`.
- Adds CORS middleware reading `settings.CORS_ALLOWED_ORIGINS` (comma-separated).
- Mounts the v1 router under `/api/v1`.
- Adds `GET /health` returning `{"status": "ok"}`.

### Configuration
`backend/app/core/config.py` — pydantic-settings `Settings` class. Required: `DATABASE_URL`, `JWT_SECRET_KEY`. Everything else has a default of `""`. CORS default `http://localhost:5173`. JWT expiry default 60 minutes.

### Routers (mounted in `api/v1/router.py`)

| Path prefix | Tag | Status | What it does |
|---|---|---|---|
| `/auth` | auth | ✅ | register / login / logout |
| `/jobs` | jobs | ✅ | CRUD + restore + milestones GET/PATCH |
| `/jobs` | contacts | ✅ | list / discover / revisit / patch / delete (mounted at /jobs prefix because routes are nested) |
| `/jobs` | outreach | ✅ | list / create / patch / delete contact-scoped messages |
| `/jobs` | follow-up | 🟡 stub | stubs return `[]` and 202s |
| `/jobs` | flash-cards | 🟡 stub | stubs |
| `/jobs` | pitch-deck | 🟡 stub | stubs |
| `/jobs` | notes | 🟡 stub | stubs |
| `/jobs` | activity | 🟡 stub | returns `[]` |
| `/attachments` | attachments | 🟡 stub | upload / download URL stubs |
| `/dashboard` | dashboard | ✅ | aggregates job counts by status |
| `/inbox` | inbox | 🟡 stub | actions list / complete / snooze stubs (frontend generates client-side) |
| `/workflow-runs` | workflow-runs | ✅ | GET single run for polling |
| `/credits` | credits | ✅ | GET /me — returns balance + plan |

### Auth flow
1. Register or login → returns `{ access_token, token_type: "bearer", user }`. Token stored in `localStorage.access_token`.
2. Every subsequent request: `Authorization: Bearer <token>`.
3. `app/api/deps.py:get_current_user` is the FastAPI `Depends` that decodes the token and loads the user.
4. Token decode failure → 401 with detail `Invalid or expired token`. Missing user → 401 with detail `User not found`.
5. Token is HS256-signed by `JWT_SECRET_KEY`. Subject is the user UUID stringified.
6. Logout is stateless on both sides — frontend clears localStorage, backend just returns 204.

A 401 from any endpoint causes `frontend/src/lib/api/client.ts` to drop the token, drop the user, and `window.location.href = "/login"`.

### Endpoint groups (deeper)

#### `auth.py` (93 lines)
- POST `/register` (201): hashes password with bcrypt, creates User, grants 3.0 credits + writes a `plan_grant` CreditTransaction in the same flush, issues JWT.
- POST `/login`: verifies bcrypt, issues JWT.
- POST `/logout` (204): noop, returns nothing.

#### `jobs.py` (279 lines) — **the most complete reference endpoint**
- GET `/jobs?archived=bool` — bulk-loads selected contacts' lifecycle statuses in a single query and groups by job, populating `contactStatuses` per job. Filters `is_deleted == archived`.
- POST `/jobs` (201) — body `{ url, title?, company? }`. Creates Job (status="Interested", progress=0), creates JobMilestone (all false), commits, then publishes to `job-parsing` queue via `queue.publish_job_parsing` and refreshes. Returns Job + `workflowRunId`.
- GET `/jobs/{id}` — single job + its `contactStatuses`. Filters `is_deleted=False`.
- PATCH `/jobs/{id}` — accepts subset of fields. Special case: when status changes to `Interviewing` or `Closed`, runs a bulk UPDATE setting `profile_data = NULL` for all contacts on the job (privacy/cleanup).
- DELETE `/jobs/{id}` (204) — soft delete (`is_deleted = True`).
- POST `/jobs/{id}/restore` — flips `is_deleted` back to False, returns the job.
- GET `/jobs/{id}/milestones` — single row.
- PATCH `/jobs/{id}/milestones` — partial update of the 10 booleans.

The `_job_to_dict` serializer is the canonical example for camelCase output. The `_contact_statuses_for_job` helper queries `Contact.lifecycle_status` for selected contacts.

#### `contacts.py` (389 lines)
- Constants: `SELECTION_CAP = 3`, `_PHOTO_KEYS` (8 candidate keys to check in profile_data), `_TIMESTAMP_FIELDS` (6 timestamp fields), `_ACTIVITY_LABELS` (5 fields → human strings), `_OUTCOME_LABELS` (8 outcomes → human strings).
- `_extract_photo_url(profile_data)` — defensively pulls a photo URL from the stored Apify blob.
- `_infer_relationship(title)` — heuristics on title text. Recruiter/HR keywords → "Recruiter". Hiring Manager → "Hiring Manager". Engineering Manager / Director / VP → "Team Lead". Plain "manager" → "Team Lead" but **excludes** Account/Project/Product/Case/Client/Relationship/Community/Social Media/Content/Brand/Campaign/Event/Office Manager because those are individual-contributor roles.
- `_infer_confidence(score)` — `>=60 High`, `>=35 Medium`, else Low.
- GET `/jobs/{id}/contacts` — orders by `(round_number, batch_number, relevance_score DESC)`.
- POST `/jobs/{id}/contacts/discover` (body `DiscoverRequest`) — publishes to `contact-discovery`. **Credit deduction commented out** (lines 166-167). Always returns `hasMore = batch_number < 3`.
- POST `/jobs/{id}/contacts/revisit` (202) — finds max `round_number`, increments, publishes batch 1 of new round. **Credit deduction commented out** (line 208).
- PATCH `/jobs/{id}/contacts/{contact_id}` — partial update. Validates outcome against `VALID_OUTCOMES`. Hard cap of 3 selected contacts. Logs activity entries on field transitions. Always calls `_recompute_and_persist` if a lifecycle-relevant field changed.
- DELETE `/jobs/{id}/contacts` (204) — wipes all contacts for a job (rarely needed; mostly used when restarting from scratch).

#### `outreach.py` (286 lines)
This file owns the lifecycle-derivation contract.
- Constants: `VALID_TYPES = {"initial","followup_1","followup_2"}`, `VALID_OUTCOMES` (the 8-item set), `NOT_CONTACTED`.
- `_derive_lifecycle_status(contact, messages)` — the priority-cascade source-of-truth function. **Outcome > interview_completed > interview_scheduled > coffee_chat_completed > coffee_chat_scheduled > replied > (message-derived: followup_2 > followup_1 > initial) > not_contacted.**
- `_recompute_and_persist(contact, db)` — loads all messages for the contact, calls `_derive_lifecycle_status`, writes back to `contact.lifecycle_status`. Caller is responsible for `commit()`.
- POST `/jobs/{id}/contacts/{contact_id}/outreach` — body `{ type, message, is_ai_generated }`. 409 if a row of that type already exists. Recomputes lifecycle and commits.
- PATCH `/jobs/{id}/outreach/{outreach_id}` — patches `message` and/or `sent_at`. Explicit `sent_at: null` clears (un-send). Recomputes lifecycle.
- DELETE `/jobs/{id}/outreach/{outreach_id}` (204) — recomputes lifecycle on the parent contact.
- GET `/jobs/{id}/outreach` — legacy job-level list, kept for compatibility.

#### `workflow_runs.py` (37 lines)
GET `/workflow-runs/{id}` — single read. Returns `{ id, type, status, jobId, outputData, errorMessage, createdAt, startedAt, completedAt }`. Filters by `user_id` for ownership.

#### `dashboard.py`
Single endpoint, aggregates job counts by status and computes `outreachSent`, `meetings`, `offers` derived counts. Used by the legacy `Index.tsx` (the new Home doesn't call it).

#### `credits.py`
GET `/credits/me` — returns the user's `creditsRemaining`, `creditsTotal`, `planTier`. Cached 30s in the Sidebar.

#### Stub endpoints
`activity.py`, `notes.py`, `follow_up.py`, `flash_cards.py`, `pitch_deck.py`, `inbox.py`, `attachments.py` — all return empty arrays / nulls / 202s. Each has a `# TODO` comment in the body. They exist for routing consistency but the corresponding tables are unused.

### Pydantic models
- Defined inline in each router file (no separate `schemas/` directory).
- `CreateJobRequest`, `PatchJobRequest`, `PatchMilestonesRequest`, `DiscoverRequest`, `PatchContactRequest`, `CreateOutreachRequest`, `UpdateOutreachRequest`, `RegisterRequest`, `LoginRequest`.
- All use `Optional` for partial PATCH bodies.

### Database session management
- `app/db/session.py`: standard SQLAlchemy `engine = create_engine(settings.DATABASE_URL)`, `SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)`, `get_db()` yields then closes.
- All endpoints `Depends(get_db)`. Rollback is implicit on raised HTTPException (FastAPI does not auto-rollback, but `db.close()` discards an uncommitted transaction).
- The worker creates its own engine per consumer module (NOT shared with the API process).

### Error handling patterns
- `raise HTTPException(status_code=NNN, detail="...")` everywhere.
- 401 — auth failures.
- 400 — validation (e.g. invalid outcome, empty message body, selection cap exceeded, "Job is not archived" when restoring an active job).
- 402 — insufficient credits (when deduction is enabled).
- 404 — job/contact/message not found.
- 409 — duplicate outreach of same type.
- The `client.ts` swallows the error body and re-throws as a JS `Error(detail || "HTTP NNN")`. React Query mutations surface via `onError`.

### Where business logic lives
- **Lifecycle derivation** lives entirely in `outreach.py:_derive_lifecycle_status` and `_recompute_and_persist`. Every endpoint that mutates a contact-relevant field calls it.
- **Selection cap enforcement** lives in `contacts.py:313-323` (the PATCH handler).
- **Credit deduction** is supposed to live in `contacts.py:_deduct_credits` (defined but call sites commented out).
- **Outcome→lifecycle name mapping** is implicit: `_derive_lifecycle_status` returns `f"outcome_{contact.outcome}"`, so the lifecycle constant must equal `outcome_<enum value>` for the cascade to work.
- **Activity log writes** are scattered — backend writes from `contacts.py:_log_contact_milestone` for contact transitions, worker writes from `job_parsing.py` and `contact_discovery.py` for pipeline events.
- **Job status enum is barely managed** — only `jobs.py` PATCH writes it. No transition validation. Special-case `profile_data` clearing on `Interviewing | Closed`.

---

## 6. Worker architecture

### Entry point
`worker/app/main.py` (31 lines):
```python
asyncio.gather(
    job_parsing.listen(),
    contact_discovery.listen(),
    outreach_generation.listen(),     # stub
    follow_up_generation.listen(),    # stub
    flash_card_generation.listen(),   # stub
    pitch_deck_generation.listen(),   # stub
    cleanup.run_cleanup(),
)
```
All seven coroutines run forever in the same event loop.

### Per-consumer pattern (real ones)

```python
QUEUE_NAME = "job-parsing"
_engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")  # or transactional
_Session = sessionmaker(bind=_engine)

async def _process(payload: dict):
    wf_id, job_id, user_id, ... = payload[...]
    db = _Session()
    try:
        db.execute(text("UPDATE workflow_runs SET status='running', started_at=:t WHERE id=:id"), {...})
        # ... do work, possibly multiple AI / Apify calls ...
        db.execute(text("UPDATE workflow_runs SET status='completed', completed_at=:t, output_data=:out WHERE id=:id"), {...})
        db.commit()
    except Exception as exc:
        db.rollback()
        db.execute(text("UPDATE workflow_runs SET status='failed', error_message=:err, completed_at=:t WHERE id=:id"), {...})
        db.commit()
    finally:
        db.close()

async def listen():
    async with ServiceBusClient.from_connection_string(...) as sb:
        async with sb.get_queue_receiver(queue_name=QUEUE_NAME) as receiver:
            async for msg in receiver:
                # contact_discovery wraps this in a renew_lock_periodically task
                try:
                    await _process(json.loads(str(msg)))
                    await receiver.complete_message(msg)
                except Exception:
                    await receiver.abandon_message(msg)
```

### `job_parsing.py` (284 lines)
**Steps in order:**
1. Update `workflow_runs.status='running'`.
2. Call `scraper.scrape(url)` — returns `(page_text, company_linkedin_url_or_none)`.
3. Call AI Foundry with `JOB_PARSING_SYSTEM_PROMPT` and the page text. Parse JSON.
4. UPDATE jobs SET title/company/description/location/work_mode (←employment_type)/role_family (←seniority_level)/company_linkedin_url.
5. **Fallback chain for company_linkedin_url** when scraper didn't find one and the URL isn't LinkedIn-native:
   - Try `find_linkedin_url_from_homepage(domain)` — fetches the company's homepage and scans for `linkedin.com/company/` patterns in the HTML.
   - If that fails, call Apify `harvestapi~linkedin-company` with the company name. Validate the returned `website` field's domain against the job URL's domain. **Only accept matches** — never guess.
6. Insert "Job parsed by AI" into `activity_log`.
7. Call AI Foundry again with `COMPANY_RESEARCH_SYSTEM_PROMPT`. Parse JSON. UPDATE jobs SET company_research = JSON-stringified result.
8. Insert "Company research completed by AI" into `activity_log`.
9. **Chain to discovery:** `_publish_chained_discovery(...)` inserts a queued `workflow_runs` row of type `contact-discovery` and publishes to the `contact-discovery` Service Bus queue. Soft-fails — if it errors, parsing still counts as completed.
10. Update `workflow_runs.status='completed'` and write `output_data` (the parsed JSON object plus `_chained_discovery_run_id`).

The chained run id flows back to the frontend via `workflow_runs.output_data._chained_discovery_run_id`. The frontend Context picks it up and pivots polling to the new run.

### `contact_discovery.py` (490 lines) — the longest single file in the codebase
**Steps in order:**

1. **Idempotency check** — if any contacts already exist for this `(job_id, user_id, batch_number, round_number)`, mark the run completed with `skipped=true` and return.
2. **Read job context** — title, company, location, `company_linkedin_url`.
3. **Read resume university** — query `resumes WHERE is_active = true LIMIT 1`. If found, ask AI Foundry to extract the most-recent university name.
4. **Build Apify input:**
   - URL: prefer `company_linkedin_url`. Fall back to `https://www.linkedin.com/company/{slug}` from `_company_to_slug(company)` (the lessons doc warns this is unreliable; only used as last resort).
   - `startPage = (round_number - 1) * 3 + batch_number`. So `(round=1, batch=1)` → page 1, `(round=1, batch=3)` → page 3, `(round=2, batch=1)` → page 4.
   - `maxItems = 4` per call (3 desired + 1 buffer).
   - `titleKeywords = [first 3 role-relevant words from job_title] + ["Recruiter", "Talent Acquisition", "HR", "Manager", "Director"]`.
   - `locations = [city]` if location is parsed.
5. **Call Apify** — `_apify_run` polls every 10 seconds for SUCCEEDED status (60s timeout per call as `httpx.AsyncClient(timeout=180.0)`).
6. **Filter to active employees** — `_is_active(profile)`: profile is active if it has any current position (via `currentPositions`/`currentPosition` keys) OR any `experience[]` entry with no `endDate`. (Per the lesson learnings: the Apify schema is not what you'd expect; this was a hard-earned debug.)
7. **Score with AI Foundry** — `SCORING_SYSTEM_PROMPT` (defined inline as a string). Returns a JSON array of `{linkedin_url, score}`. Code strips markdown code fences before `json.loads()`.
8. **Save:**
   - On `(batch_number=1, round_number=1)` only — DELETE all existing contacts for this job (fresh-campaign reset).
   - Dedup against existing `linkedin_url` in DB.
   - Sort by score desc, take top 3 (despite the "12 in one call" doc — the current code grabs 4 per call and saves 3).
   - Insert each contact with `relevance_score`, `batch_number`, `round_number`.
9. Insert "Contact discovery completed" into `activity_log`.
10. Update `workflow_runs.status='completed'`, `output_data = {"contacts_saved": len(top3), "batch_number": ..., "round_number": ...}`.

**Quirk vs. the docs:** `docs/learnings/ref-pricing-cost-optimization.md` describes a 12-profiles-in-one-Apify-call optimization with batch_number assigned by rank. The current code in `contact_discovery.py` actually fetches 4 per Apify call (with `startPage` advancing per batch), which means batches 2 and 3 *do* trigger new Apify runs. The pricing doc and the implementation diverge — the doc is aspirational, the code is the source of truth.

### `cleanup.py` (67 lines)
- Loops forever, sleeping 86,400 seconds (24h) between runs.
- Nullifies `contacts.profile_data` for any row older than 30 days (`profile_data IS NOT NULL AND created_at < cutoff_30`).
- Deletes `workflow_runs` with status != 'failed' older than 30 days.
- Deletes `workflow_runs` with status = 'failed' older than 90 days.
- Uses AUTOCOMMIT.

### Stub consumers
All four (`outreach_generation`, `follow_up_generation`, `flash_card_generation`, `pitch_deck_generation`) are 14-18 line files that just log a startup line and return. They do NOT actually receive messages from their queues.

### Idempotency
- `job_parsing.py` is **not idempotent** — running it twice on the same `workflow_run_id` would update the job twice (but with the same data), and call AI Foundry twice, paying twice.
- `contact_discovery.py` **is idempotent** at the (batch, round) level — early-return short-circuits if contacts already exist.
- Service Bus delivers at-least-once. The current setup tolerates this poorly for `job_parsing`.

### Apify integration details
- `APIFY_BASE = "https://api.apify.com/v2"`. Bearer token auth via `APIFY_API_TOKEN`.
- Runs are async: POST to `/acts/{actor_id}/runs`, poll `/actor-runs/{run_id}` until SUCCEEDED, then GET `/datasets/{dataset_id}/items`.
- Polling intervals: 10s for company-employees, 5s for company-lookup.

### Error handling
- Every `_process` is wrapped in try/except that always writes a "failed" status update.
- The receiver-loop catches errors and calls `abandon_message(msg)` (returns it to the queue for redelivery). The Service Bus broker enforces the max-delivery-count.
- `contact_discovery.py:_renew_lock_periodically` runs as a background task. When the message processes (success or fail), the renew task is cancelled in the `finally` block.

### Retry logic
- No explicit application-level retry. The Service Bus broker handles redelivery on `abandon_message`. No backoff.
- The chained `contact-discovery` publish from `job_parsing.py` is **soft-fail** — if it errors, parsing still completes. The Room's auto-trigger fallback covers this case (see Section 7).

---

## 7. Frontend architecture

### Page routing (`App.tsx:33-49`)
```
/login          → Login                   (public)
/signup         → Signup                  (public)
/               → Home                    (protected — paste URL → start Referroing)
/dashboard      → Index                   (protected — legacy dashboard with widgets)
/inbox          → Inbox                   (protected — client-generated action list)
/jobs           → Jobs                    (protected — card grid, search, sort, archive tab)
/job/:id        → JobDetail               (protected — legacy single-job page)
/jobs/:id/room  → Room                    (protected — the new flow's home)
/jobs/:id/contacts/:contactId/coffee-chat-prep   → CoffeeChatPrep   (placeholder)
/jobs/:id/contacts/:contactId/interview-prep     → InterviewPrep    (placeholder)
/jobs/:id/contacts/:contactId/pitch-deck         → PitchDeck        (placeholder)
*               → NotFound
```
The Sidebar's `/resume`, `/support`, `/settings` items have no routes — they 404.

### Layout primitives
- `Sidebar` (fixed, `w-20`, `ml-20` on every main page) — Home, Dashboard, Inbox, Jobs, (Resume), (Support), (Settings), credit pill, Logout.
- `Header` — only used by `Index` and `Jobs`/`Inbox`. Top-level brand + search box + user info + logout.
- `ErrorBoundary` wraps the entire app at `App.tsx:29`.

### Provider stack (top → bottom in `App.tsx`)
```
QueryClientProvider
  └── ErrorBoundary
       └── AuthProvider
            └── TooltipProvider
                 ├── Toaster (shadcn) + Sonner (the active toast)
                 └── BrowserRouter
                      └── ReferroingProvider          ← needs to be inside Router
                           ├── Routes
                           ├── ReferroingOverlay     ← reads provider state
                           └── ReferroingPill
```

### State management
- **Server state** → React Query. Cache keys observed:
  - `["jobs"]` (5s polling)
  - `["jobs", "archived"]` (no polling, only enabled when archived tab open)
  - `["jobs", id]` (5s polling)
  - `["milestones", jobId]`
  - `["contacts", jobId]`
  - `["outreach", jobId, contactId]`
  - `["workflow-runs", id]` (2s polling, stops on terminal)
  - `["credits"]` (30s staleTime)
  - `["dashboard"]`
- **Auth** → `AuthContext` (user object) + `localStorage.access_token` + `localStorage.user`.
- **Referroing** → `ReferroingContext` + `localStorage.referroing:active` (versioned schema, version 2).
- **No Redux. No Zustand.**
- **Local component state** — handled via `useState`. Notable: search/filter on Jobs, scheduling form in PostReplyView, draft text auto-save in MessageDraftView, snoozed/completed sets in Inbox (in-memory only).

### The Referroing system (provider, overlay, pill) — end-to-end

**`contexts/ReferroingContext.tsx` (211 lines)**
- `STORAGE_KEY = "referroing:active"`, `STORAGE_VERSION = 2`, `STALL_THRESHOLD_MS = 10 * 60 * 1000`.
- Stored shape: `{ version, active: { jobId, parsingWorkflowRunId, discoveryWorkflowRunId, currentRunId, phase: "parsing"|"discovery", jobTitle?, companyName?, startedAt }, uiMode: "blurred"|"pill"|"hidden" }`.
- On load, `loadFromStorage()` validates the version + presence of required fields. **It never restores `blurred` mode** — if the user reloaded mid-flow, they come back to the pill. (Smart: avoids the page re-blurring on F5.)
- `useWorkflowRun(activeReferro?.currentRunId)` polls every 2s.
- Derived `status: "running" | "completed" | "failed" | "stalled"`:
  - `failed` if the raw status is failed.
  - `completed` only when **discovery phase** completes. A completed parsing run mid-chain is still "running" at the top level.
  - `stalled` after 10 minutes elapsed.
- The big `useEffect` at line 127 handles **phase transitions**:
  - parsing completed + chained discovery id present → pivot to discovery (set new `currentRunId`, set `phase: "discovery"`, invalidate `["jobs"]`).
  - parsing completed + no chained id → `openActiveRoom()` (Room's bootstrap auto-trigger picks up).
  - discovery completed → invalidate jobs + contacts, navigate to Room if still blurred.
  - discovery failed → soft-fail, navigate to Room. The Room's existing retry covers it.
- `startReferro` sets `phase: "parsing"`, `uiMode: "blurred"`. `dismissBlur` flips to `"pill"`. `openBlur` flips back. `openActiveRoom` clears state and navigates.

**`components/referroing/ReferroingOverlay.tsx` (107 lines)**
- Renders only when `uiMode === "blurred"` and not on `/login` or `/signup`.
- Failed state → centered card with X icon, error message, "Close" button (clears state).
- Running state → letter-by-letter "Referroing" animation (80ms stagger, 4s loop), three-stage status text ("Scraping job…" → "Parsing details…" → "Finding your company…" for parsing phase; analogous for discovery phase). 7.5s total cycle.
- "keep working →" link in the bottom-right dismisses the blur (downgrades to pill).
- Positioned `left-20 top-0 right-0 bottom-0` so the Sidebar stays visible.

**`components/referroing/ReferroingPill.tsx` (79 lines)**
- Renders only when `uiMode === "pill"`. Top-right.
- Spinner / check / alert icon based on status. Clickable: completed → opens Room; failed → no-op; otherwise → openBlur.
- X button to clear when terminal.

### Custom hooks

| Hook | What it does |
|---|---|
| `useJobs` | List active jobs, 5s poll. |
| `useArchivedJobs(enabled)` | List archived jobs, no poll, conditionally enabled. |
| `useJob(id)` | Single job, 5s poll. |
| `useCreateJob` | Mutation, invalidates `["jobs"]`. |
| `useUpdateJob` | Mutation, sets cache for `["jobs", id]` + invalidates `["jobs"]`. |
| `useDeleteJob` | Mutation, invalidates `["jobs"]`. |
| `useRestoreJob` | Optimistic — moves job from `["jobs", "archived"]` cache to `["jobs"]` cache atomically. Rollback on error. |
| `useJobMilestones(jobId)` | Single read. |
| `useUpdateMilestones(jobId)` | Mutation, sets cache. |
| `useContacts(jobId)` | List, no poll. |
| `useDiscoverContacts(jobId)` | Mutation that polls the resulting workflow_run for completion (manual setTimeout-based polling, 2s interval). Sets `isPolling`, `hasMore` state. |
| `useRevisitContacts(jobId)` | Same pattern as discover. Invalidates `["credits"]` on success. |
| `useToggleContactSelection(jobId)` | Optimistic. Reverts cache on 400 (selection cap). |
| `useContactOutreach(jobId, contactId, enabled)` | List messages for a contact. |
| `useCreateOutreach`, `useUpdateOutreach`, `useDeleteOutreach` | Mutations. All call `invalidate()` on the outreach + contacts caches. |
| `useWorkflowRun(id)` | Polls every 2s, stops on terminal status. |
| `useCredits` | 30s staleTime, no poll. |
| `useDashboard` | One-shot read. |

### Component hierarchy for the Room

```
Room.tsx
├── Sidebar
├── (back link, title, stage pill via getStagePill)
├── if !milestones.contactSelected → PickContactsPanel
│   ├── auto-bootstraps discovery (batch=1, round=1) on first mount with no contacts
│   ├── Shows 3 ContactCard slots with empty placeholders for missing contacts
│   ├── "Show me different contacts" → discoverBatch(currentBatch+1, currentRound), max 3 batches per round
│   ├── "Find 9 more (0.5 credits)" → revisitContacts (when poolExhausted)
│   ├── "Confirm Selection" → updateMilestones({ contactSelected: true }) → re-renders Phase2
│   └── ContactCard (selected/unselected/locked, photo or monogram, fit pill, university chip, LinkedIn link)
└── if milestones.contactSelected === true → Phase2Panel
    ├── 3 ContactTile cards (one per selected contact, lifecycle status badge)
    ├── all-closed-no-offer banner (CircleSlash icon)
    └── ContactPopup (Radix Dialog, fixed left-20 top-0 right-0 bottom-0 backdrop)
        ├── Header: avatar + name + title + statusLabel + LinkedIn link + close
        ├── StateTimeline (5-step progress visualization with currentIdx)
        └── if isPostReplyState(status) → PostReplyView
            │   ├── if status === outcome_offer → CelebrationView (confetti + LinkedIn share)
            │   ├── if isOutcomeState(status) → "outreach is closed, undo to reopen"
            │   ├── else → schedule pickers + state-specific action buttons +
            │   │           "Prep for this" navigation when scheduled
            │   └── ActivityTimeline (chronological list)
            └── else → MessageDraftView
                ├── if status === REPLIED → "Marked replied" terminal card
                ├── if status ∈ {SENT, FU1_SENT, FU2_SENT} → "waiting for reply" + "They replied" + "Draft follow-up" + LinkedIn
                ├── if status === NOT_CONTACTED → "Draft message" CTA + pitch-deck link
                └── else (drafted states) → editable Textarea with 500ms debounced auto-save +
                                            Copy + LinkedIn + "Mark sent"
                MessageHistory (latest expanded, earlier collapsed)
                Always: "Undo" link in the corner with state-specific label
```

### The contact lifecycle state machine
See Section 9 for the deep dive. Key library: `frontend/src/lib/contactLifecycle.ts` — exports `STATES`, `OUTCOMES`, type guards (`canMarkSent`, `canMarkReplied`, `canScheduleCoffeeChat`, `canCompleteCoffeeChat`, `canScheduleInterview`, `canCompleteInterview`, `canRecordOutcome`, `canUndo`), label helpers (`statusLabel`, `shortStatusBadge`, `outcomeLabel`, `undoLabel`), `outcomeOptionsForState` (per-state allowed outcomes), `nextCreatableType` (which OutreachType is allowed next), `currentDraftType`, `timelineIndex` (5-step visualization), `isPostReplyState`, `isOutcomeState`.

### The job stage pill derivation
`frontend/src/lib/jobStagePill.ts` — `getStagePill(jobStatus, contactStatuses?)`:
1. If `contactStatuses` is empty/missing → fall back to `LEGACY_MAP[jobStatus]`.
2. Any `outcome_offer` in array → `Landed 🎉` with tone `landed`.
3. Filter to non-outcome statuses. If any:
   - any interview state → `Interview Stage` (late-active)
   - any coffee chat state → `Coffee Chat` (mid-active)
   - any `replied` → `In Conversation` (early-active)
   - any sent state → `Outreach Sent` (early-active)
   - any drafted state → `Drafting` (neutral)
   - else → `Ready to reach out` (neutral)
4. All terminal outcomes (none offer) → `Closed` (closed).

`stageSortIndex(jobStatus)` is used by Jobs.tsx for the "Stage" sort.

### shadcn UI components in use
40+ components in `components/ui/`. Heavily used: Button, Input, Textarea, Label, Tabs, Tooltip, Calendar, Popover, Dialog, Select, Card, Badge, Skeleton, Collapsible, Toast, Toaster, Sonner, DropdownMenu, AlertDialog, ScrollArea, Separator. Less used: Carousel, Chart, Sidebar (the shadcn one — different from the project's `Sidebar.tsx`), Resizable, etc.

### Custom UI components
- `EmptyState`, `ErrorState` — reusable wrappers (in `components/ui/`).
- `EmptyIllustrations.tsx` — three icon-circle illustrations: `PathForwardIllustration`, `EmptyBoxIllustration`, `RadarSweepIllustration`.

### Form handling
- Auth pages (Login, Signup, Home URL) use plain `useState` + `<input>` — no react-hook-form, no zod despite both being in package.json.
- Schedule picker in `PostReplyView.tsx` uses Radix Popover + shadcn Calendar + native `<input type="time">`.

---

## 8. Critical user flows (end-to-end traces)

### Flow A: Submit URL (Home → Referroing → Room landing)

1. **User pastes URL on `/`.**
   - Component: `frontend/src/pages/Home.tsx`.
   - Form `onSubmit` calls `isLikelyUrl(trimmed)` → if pass, `createJob.mutate({ url: trimmed })`.
2. **`useCreateJob` mutation fires.**
   - Hook: `frontend/src/hooks/useJobs.ts:30`.
   - Calls `createJob(url, "", "")` in `frontend/src/lib/api/jobs.ts:83`.
   - `POST /api/v1/jobs` body `{ url, title: "", company: "" }`.
3. **Backend handler** — `backend/app/api/v1/jobs.py:119 create_job`.
   - Insert Job (`status="Interested"`, `progress=0`).
   - Insert JobMilestone (all false).
   - `db.commit()`.
   - `queue.publish_job_parsing(db, current_user.id, job.id, body.url)` in `backend/app/services/queue.py:46`.
     - Inserts WorkflowRun (`status="queued"`, `type="job-parsing"`, `input_data={...}`).
     - `db.commit()` (commits WF row before publishing — avoids races).
     - Opens Service Bus client, sends `ServiceBusMessage(json.dumps({**payload, "workflow_run_id": str(run.id)}))`.
     - On publish exception, marks WF as `failed`.
   - Returns `{ data: { ...job, workflowRunId: str(run.id) } }`.
4. **Frontend onSuccess** — `Home.tsx:46-67`.
   - If no `workflowRunId` returned → local error.
   - Otherwise `startReferro({ jobId, workflowRunId, jobTitle, companyName })`.
5. **ReferroingContext** — sets `phase="parsing"`, `uiMode="blurred"`. Persists to localStorage.
6. **`ReferroingOverlay`** renders the fullscreen blur with letter animation. **`useWorkflowRun(currentRunId)` polls** `GET /workflow-runs/{id}` every 2s.
7. **Worker `job_parsing.py` `_process(payload)`** picks up the message:
   - Updates WF to `running`.
   - Calls `scrape(url)` (3-tier fallback in `worker/app/scraper.py`).
   - Calls AI Foundry with `JOB_PARSING_SYSTEM_PROMPT`.
   - Updates Job columns (title, company, description, location, work_mode, role_family, company_linkedin_url).
   - **Fallback** chain for company LinkedIn URL if missing.
   - Inserts "Job parsed by AI" into activity_log.
   - Calls AI Foundry with `COMPANY_RESEARCH_SYSTEM_PROMPT`.
   - Updates Job.company_research.
   - Inserts "Company research completed by AI" into activity_log.
   - **Chains discovery:** `_publish_chained_discovery(...)` inserts queued WF row + Service Bus message.
   - Updates parsing WF to `completed`, output_data includes `_chained_discovery_run_id`.
8. **Frontend polling sees parsing completed.** `ReferroingContext`'s effect runs:
   - Reads `output_data._chained_discovery_run_id`.
   - Updates active referro: `phase="discovery"`, `currentRunId=<chained id>`.
   - Invalidates `["jobs"]` (so the Jobs page would update if open).
   - Polling continues against the new run id.
9. **Worker `contact_discovery.py` `_process(payload)`** picks up the chained message:
   - Idempotency check (skip if contacts exist for this batch+round).
   - Reads job + active resume.
   - Calls Apify employee scraper.
   - Filters to active employees.
   - Calls AI Foundry to score.
   - Inserts top 3 contacts into `contacts` table.
   - Inserts "Contact discovery completed" into activity_log.
   - Updates discovery WF to `completed`.
10. **Frontend polling sees discovery completed.** Effect runs:
    - Invalidates `["jobs"]` and `["contacts", jobId]`.
    - If `uiMode === "blurred"` → `openActiveRoom()` → `clearReferro()` + `navigate(/jobs/{jobId}/room)`.
    - If `uiMode === "pill"` → just stays as a "Ready — click to open <company>" pill.
11. **Room page mounts** — `frontend/src/pages/Room.tsx`.
    - `useJob(jobId)` (5s poll) loads the job. `useJobMilestones(jobId)` loads milestones.
    - `milestones.contact_selected === false` → render `PickContactsPanel`.
12. **PickContactsPanel auto-bootstraps** — `bootstrapRef` ensures it only fires once. `useContacts(jobId)` returns the 3 contacts (already in DB). User sees the cards.

**Files involved:**
- Frontend: `pages/Home.tsx`, `contexts/ReferroingContext.tsx`, `hooks/useJobs.ts`, `hooks/useWorkflowRun.ts`, `lib/api/jobs.ts`, `lib/api/client.ts`, `lib/api/workflowRuns.ts`, `components/referroing/ReferroingOverlay.tsx`, `components/referroing/ReferroingPill.tsx`, `pages/Room.tsx`, `components/room/PickContactsPanel.tsx`.
- Backend: `app/api/v1/jobs.py:create_job`, `app/api/v1/workflow_runs.py:get_workflow_run`, `app/services/queue.py:publish_job_parsing`, `app/services/queue.py:_publish`.
- Worker: `worker/app/main.py`, `consumers/job_parsing.py:_process`, `consumers/job_parsing.py:_publish_chained_discovery`, `consumers/contact_discovery.py:_process`, `worker/app/scraper.py`, `worker/app/integrations/ai_foundry.py`, `worker/app/prompts/job_parsing.py`, `worker/app/prompts/company_research.py`.

### Flow B: Selecting 3 contacts and clicking "Confirm Selection"

1. **User clicks a contact card.** `ContactCard.tsx` → `onClick` → `PickContactsPanel.handleToggle(contact)`.
2. **Hard-cap check:** if already 3 selected and trying to add a 4th, return early (no PATCH fired).
3. **`useToggleContactSelection.mutate({ contactId, isSelected: !current })`** in `hooks/useContactSelection.ts`.
   - `onMutate` → optimistically updates `["contacts", jobId]` cache.
   - Calls `setContactSelected` → `PATCH /api/v1/jobs/{jobId}/contacts/{contactId}` body `{ is_selected: true }`.
4. **Backend** — `app/api/v1/contacts.py:289 update_contact`.
   - Loads contact (with user_id ownership filter).
   - If trying to set selected and current count >= 3 → 400 "Selection cap of 3 contacts reached".
   - Sets `contact.is_selected = body.is_selected`.
   - Calls `_recompute_and_persist(contact, db)` (lifecycle is unchanged here, but consistent).
   - Commits.
5. **On 400 error** — `useToggleContactSelection.onError` rolls back the cache and toasts "You can only select 3 contacts".
6. **User clicks "Confirm Selection".** `Room.handleConfirm` → `updateMilestones.mutate({ contactSelected: true })`.
7. **Backend** — `PATCH /api/v1/jobs/{id}/milestones` body `{ contact_selected: true }`.
8. **Frontend** — `useUpdateMilestones` sets the cache. The effect on `Room.tsx` line 66 observes `milestones.contactSelected === true` and re-renders → mounts `Phase2Panel`.

### Flow C: Drafting a message (auto-save, copy, mark sent)

State: `lifecycle_status === "not_contacted"`, contact popup open, MessageDraftView rendered.

1. **User clicks "Draft message"** → `handleDraftMessage`:
   - `creatableType = nextCreatableType(status)` = `"initial"`.
   - `stub = buildStub(contact)` = `"Hi <FirstName>,\n\n[Your AI-generated outreach message will appear here. For now, feel free to write your own.]"`
   - `useCreateOutreach.mutate({ type: "initial", message: stub, isAiGenerated: false })`.
2. **Backend POST** `/api/v1/jobs/{jobId}/contacts/{contactId}/outreach` (`outreach.py:153`).
   - 409 if duplicate `(contact_id, type)` exists.
   - Inserts row, calls `_recompute_and_persist` (lifecycle becomes `drafted`).
3. **Cache invalidation** — `useCreateOutreach.onSuccess` → `invalidate(qc, jobId, contactId)` → invalidates `["outreach", jobId, contactId]` and `["contacts", jobId]`.
4. **Re-render.** `currentDraft` resolves to the new row. `useEffect` syncs `draftText` to its content.
5. **User edits the textarea.**
   - `setDraftText(e.target.value)`.
   - Debounce effect (500ms) → `flush.current()` → `useUpdateOutreach.mutate({ outreachId, patch: { message: draftText } })`.
6. **Backend PATCH** `/api/v1/jobs/{id}/outreach/{outreachId}` (`outreach.py:202`).
   - 400 if `message.strip() === ""`.
   - Updates row. Recomputes lifecycle (still `drafted`).
7. **User clicks "Copy"** → `handleCopy` flushes the debounce, then `navigator.clipboard.writeText(draftText)` and toast.
8. **User clicks "Mark sent"** → `handleMarkSent`:
   - Flushes pending edit.
   - PATCH with `{ message: draftText, sent_at: new Date().toISOString() }`.
9. **Backend** updates `sent_at`, recomputes → lifecycle becomes `sent`.
10. **Re-render** — `MessageDraftView` now sees `status === STATES.SENT`, renders the "waiting for reply" branch with "They replied" CTA + "Draft follow-up" + "Open LinkedIn" + Undo (which would `delete` if `drafted` or `unsend` if `sent`).

### Flow D: Replied → coffee chat scheduled → completed → interview scheduled → completed → outcome recorded

Starting state: `sent`. Tasks:

1. **They replied** → `MessageDraftView.onMarkReplied` (handler from ContactPopup) → `setReplied.mutate(new Date().toISOString())` → PATCH contact `{ replied_at }`.
   - `_recompute_and_persist` → status becomes `replied`. `_log_contact_milestone` writes activity row "They replied for {name}".
2. **`isPostReplyState(status)` is now true** → `ContactPopup` switches to `PostReplyView`.
3. **Schedule coffee chat** → `handleOpenSchedule("coffee_chat")` shows date+time picker. Confirm → PATCH `{ coffee_chat_scheduled_at: ISO }`.
   - Lifecycle becomes `coffee_chat_scheduled`.
4. **Mark completed** → PATCH `{ coffee_chat_completed_at: now }` → lifecycle `coffee_chat_completed`.
5. **Schedule interview** → `canScheduleInterview` allows from both `replied` and `coffee_chat_completed` → PATCH `{ interview_scheduled_at: ISO }` → `interview_scheduled`.
6. **Mark interview completed** → PATCH `{ interview_completed_at: now }` → `interview_completed`.
7. **Record outcome** — opens `OutcomeDialog`. Available outcomes for `interview_completed`: `[offer, rejected, lost_touch, withdrew]` per `outcomeOptionsForState`. User picks `offer`.
8. **PATCH** `{ outcome: "offer" }`. Backend sets `outcome_recorded_at = now()` automatically (line 360), writes activity log "Recorded outcome: got the offer", recomputes → `outcome_offer`.
9. **`PostReplyView` renders `CelebrationView`** because `status === OUTCOME_OFFER`. Confetti fires once (gated by `localStorage["referroing:celebrated:<contactId>"]`). LinkedIn share button.

### Flow E: Recording outcomes from each terminal state

Per `outcomeOptionsForState` in `lib/contactLifecycle.ts`:

| From state | Allowed outcomes |
|---|---|
| `replied` | withdrew, not_right_person, lost_touch |
| `coffee_chat_scheduled` | withdrew, cancelled, lost_touch |
| `coffee_chat_completed` | not_a_fit, lost_touch, withdrew |
| `interview_scheduled` | withdrew, company_cancelled, lost_touch |
| `interview_completed` | offer, rejected, lost_touch, withdrew |

Backend validation in `outreach.py` only requires the outcome string be in `VALID_OUTCOMES`; the per-state filtering is **client-only**. A motivated client could PATCH any outcome at any time. Not currently a security or correctness concern but worth knowing.

### Flow F: Archiving and restoring a job

1. **Archive** — Jobs page `JobCard` → DropdownMenu → "Archive" → `Jobs.handleArchive(job)` → `useDeleteJob.mutate(job.id)` → DELETE `/api/v1/jobs/{id}` → soft-delete (`is_deleted=True`) → 204. `onSuccess` invalidates `["jobs"]`.
2. **Toast** with no Undo button (Undo is only on restore).
3. **Restore** — Archived tab → JobCard → "Restore" → `useRestoreJob.mutate(id)`:
   - **`onMutate` (optimistic):** removes job from `["jobs", "archived"]` cache, prepends to `["jobs"]` cache. Stashes both for rollback.
   - **`onError`:** restores both caches.
   - Calls POST `/api/v1/jobs/{id}/restore` → flips `is_deleted=False` → returns updated job.
   - **`onSettled`:** invalidates `["jobs"]`.
4. **Toast** with "Undo" button that calls `useDeleteJob.mutate(id)` (re-archives).

### Flow G: Pitch deck route navigation
From the `MessageDraftView` `not_contacted` state, an "Or send a pitch deck →" link navigates to `/jobs/:id/contacts/:contactId/pitch-deck`. The page (`PitchDeck.tsx`) is currently a placeholder card with an explanatory message — the real Gamma generation isn't implemented. Same for `/coffee-chat-prep` and `/interview-prep`.

---

## 9. The state machine (deep dive)

### The 16 lifecycle states

```
not_contacted              (default)
drafted                    initial message exists, sent_at NULL
sent                       initial message has sent_at
followup_1_drafted         followup_1 message exists, sent_at NULL
followup_1_sent            followup_1 has sent_at
followup_2_drafted         followup_2 message exists, sent_at NULL
followup_2_sent            followup_2 has sent_at
replied                    contact.replied_at IS NOT NULL
coffee_chat_scheduled      contact.coffee_chat_scheduled_at IS NOT NULL
coffee_chat_completed      contact.coffee_chat_completed_at IS NOT NULL
interview_scheduled        contact.interview_scheduled_at IS NOT NULL
interview_completed        contact.interview_completed_at IS NOT NULL
outcome_offer              contact.outcome = 'offer'
outcome_rejected           contact.outcome = 'rejected'
outcome_withdrew           contact.outcome = 'withdrew'
outcome_not_right_person   contact.outcome = 'not_right_person'
outcome_not_a_fit          contact.outcome = 'not_a_fit'
outcome_lost_touch         contact.outcome = 'lost_touch'
outcome_cancelled          contact.outcome = 'cancelled'
outcome_company_cancelled  contact.outcome = 'company_cancelled'
```

(That's actually 19 distinct values if you count each outcome variant, and 16 if you count "an outcome" as a single state. The `STATES` constant in `frontend/src/lib/contactLifecycle.ts` lists 19 individual keys; the timeline visualization collapses outcomes into one "outcome" step.)

### The `_derive_lifecycle_status` priority cascade

In `backend/app/api/v1/outreach.py:44-77`. Each check short-circuits:

```
if contact.outcome ∈ VALID_OUTCOMES:
    return f"outcome_{contact.outcome}"
elif contact.interview_completed_at:
    return "interview_completed"
elif contact.interview_scheduled_at:
    return "interview_scheduled"
elif contact.coffee_chat_completed_at:
    return "coffee_chat_completed"
elif contact.coffee_chat_scheduled_at:
    return "coffee_chat_scheduled"
elif contact.replied_at:
    return "replied"
elif "followup_2" in messages_by_type:
    return "followup_2_sent" if has_sent_at else "followup_2_drafted"
elif "followup_1" in messages_by_type:
    return "followup_1_sent" if has_sent_at else "followup_1_drafted"
elif "initial" in messages_by_type:
    return "sent" if has_sent_at else "drafted"
else:
    return "not_contacted"
```

### Who enforces transitions

- **Server is permissive:** the API will accept any combination of timestamp/outcome writes. There is no transition graph enforcement. You could theoretically PATCH `outcome=offer` directly from `not_contacted` and the server would accept it (and derive `outcome_offer`).
- **Client gates aggressively:** every action button uses one of the `canX` helpers in `lib/contactLifecycle.ts`:
  - `canMarkSent(status)` — allows from any drafted state.
  - `canMarkReplied(status)` — allows from any sent state.
  - `canScheduleCoffeeChat(status)` — only from `replied`.
  - `canCompleteCoffeeChat(status)` — only from `coffee_chat_scheduled`.
  - `canScheduleInterview(status)` — from `replied` OR `coffee_chat_completed` (the "skip coffee chat" path).
  - `canCompleteInterview(status)` — only from `interview_scheduled`.
  - `canRecordOutcome(status)` — from any post-reply non-terminal state.
  - `canUndo(status)` — anything except `not_contacted`.

This is a **linear-with-skips** state graph: replied → (coffee_chat_*) → (interview_*) → outcome. Coffee chat is optional. You can record an outcome at any post-reply state except after another outcome.

### `_recompute_and_persist`

In `outreach.py:80`. The contract:
```python
def _recompute_and_persist(contact, db):
    messages = db.query(OutreachMessage).filter(...).all()
    contact.lifecycle_status = _derive_lifecycle_status(contact, messages)
```
It does not commit. The caller commits. **Every endpoint that mutates a contact's timestamp/outcome or any of its messages must call this function before commit.** Audited:
- `contacts.py:update_contact` — calls it (line 368) when `lifecycle_touched`.
- `outreach.py:create_outreach` — calls it (line 196).
- `outreach.py:update_outreach` — calls it (line 234).
- `outreach.py:delete_outreach` — calls it (line 259).

### Undo mechanics

The frontend `ContactPopup.handleUndo` switches on the current status and figures out what to clear:
- **Outreach states (drafted/sent/FU1/FU2):** find the message of that type. If `drafted`, DELETE the row. If `sent`, PATCH `sent_at: null`. Lifecycle then re-derives.
- **`replied`:** PATCH `replied_at: null` on the contact. Lifecycle drops back to `sent`.
- **`coffee_chat_scheduled`:** PATCH `coffee_chat_scheduled_at: null` → drops back to `replied`.
- **`coffee_chat_completed`:** PATCH `coffee_chat_completed_at: null` → drops back to `coffee_chat_scheduled`.
- **`interview_scheduled`:** PATCH `interview_scheduled_at: null`. If user came from `replied` (skipping coffee chat), drops back to `replied`. If from `coffee_chat_completed`, drops back to `coffee_chat_completed`.
- **`interview_completed`:** PATCH `interview_completed_at: null` → drops back to `interview_scheduled`.
- **Outcome state:** PATCH `outcome: null` → backend also clears `outcome_recorded_at` (line 350). Lifecycle drops back to whatever the underlying timestamps imply.

**Activity log writes are not reversed on undo.** The activity timeline keeps a record of "They replied" even if you undo it. This is intentional — it's an audit log.

### ActivityLog writes

Server-side writes happen in:
- `worker/app/consumers/job_parsing.py` — "Job parsed by AI", "Company research completed by AI".
- `worker/app/consumers/contact_discovery.py` — "Contact discovery completed".
- `backend/app/api/v1/contacts.py:_log_contact_milestone` — called from `update_contact` when:
  - `replied_at` was just set: "They replied for {name}".
  - `coffee_chat_scheduled_at` was just set: "Coffee chat scheduled for {name}".
  - `coffee_chat_completed_at`: "Coffee chat completed for {name}".
  - `interview_scheduled_at`: "Interview scheduled for {name}".
  - `interview_completed_at`: "Interview completed for {name}".
  - Any outcome change: "Recorded outcome: <label> for {name}".
- Outreach mutations do NOT write activity log entries (sent, drafted, etc.).

The activity_log GET endpoint is a stub (`activity.py` returns `[]`), so the client never sees these — they're written but invisible. The Room's ActivityTimeline component derives entries directly from the contact's own timestamps + messages, not from `activity_log`.

### The 8 outcome values

| Value | Meaning | Valid from |
|---|---|---|
| `offer` | They got the offer | interview_completed |
| `rejected` | Company rejected | interview_completed |
| `withdrew` | Candidate pulled out | replied, coffee_chat_*, interview_* |
| `not_right_person` | The contact wasn't the right hire-decision-maker | replied |
| `not_a_fit` | Realized fit was off after meeting | coffee_chat_completed |
| `lost_touch` | Stopped responding (replaces old "ghosted") | any post-reply state |
| `cancelled` | Coffee chat cancelled | coffee_chat_scheduled |
| `company_cancelled` | Interview cancelled by company | interview_scheduled |

The `lost_touch` rename happened in migration `k1l2m3n4o5p6` (data migration, no schema change — column was already varchar(20)).

---

## 10. Migrations history

13 migration files in `backend/migrations/versions/`, applied in this order. Most map cleanly to a UX redesign stage.

| # | Revision | Created | What it added/changed | Stage / context | Down? |
|---|---|---|---|---|---|
| 1 | `47c7352809d7` | 2026-03-07 | Initial schema: users (with `first_name`, `last_name`), jobs (with `source_url`), workflow_runs. Tiny, only 3 tables. | Phase 0 boot | yes |
| 2 | `3fdbe56b0709` | 2026-03-07 | "Full schema 16 tables": adds the other 13 tables, adds `jobs.url`/`fit_score`/`role_family`, drops `jobs.source_url`/`notes`, replaces `users.first_name+last_name` with single `name`. | Phase 0 boot completion | yes |
| 3 | `a1b2c3d4e5f6` | 2026-03-31 | Adds `jobs.company_research` TEXT. | REF-11 (company research) | yes |
| 4 | `b2c3d4e5f6a7` | 2026-04-01 | Reshapes `contacts`: drops `name`/`relationship`/`confidence`/`source`/`profile_url`/`is_selected`, adds `full_name`/`linkedin_url`/`company`/`location`/`university`/`tenure_months`/`relevance_score`/`profile_data`, makes `title` nullable. | REF-12 (contact discovery) | yes |
| 5 | `c3d4e5f6a7b8` | 2026-04-01 | Adds `jobs.location`. | REF-12 | yes |
| 6 | `d4e5f6a7b8c9` | 2026-04-06 | Adds `jobs.company_linkedin_url`. | REF-12 polish | yes |
| 7 | `a476a52207e1` | 2026-04-12 | **Empty placeholder.** Comment: "applied directly to the database without being committed to git. This placeholder file exists solely to satisfy Alembic's revision chain." | Out-of-band fix | no-op |
| 8 | `f6a7b8c9d0e1` | 2026-04-12 | Widens `jobs.work_mode`/`role_family` from `String(20)` to `Text`. | REF-12 | yes |
| 9 | `g7h8i9j0k1l2` | 2026-04-16 | Pricing schema: adds `contacts.batch_number`/`round_number`, adds `users.credits_remaining`/`credits_total`/`plan_tier`, creates `credit_transactions` table. | REF-PRICING | yes |
| 10 | `h8i9j0k1l2m3` | 2026-04-17 | Adds `contacts.is_selected`. | Stage 4 (Room phase 1) | yes |
| 11 | `i9j0k1l2m3n4` | 2026-04-17 | Adds `contacts.lifecycle_status`/`replied_at`. | Stage 5 (popup, lifecycle 1-4) | yes |
| 12 | `j0k1l2m3n4o5` | 2026-04-18 | Adds `contacts.coffee_chat_scheduled_at/completed_at`, `interview_scheduled_at/completed_at`, `outcome`, `outcome_recorded_at`. Adds `activity_log.contact_id` FK + `activity_log.type`. | Stage 6 (lifecycle 5-11) | yes |
| 13 | `k1l2m3n4o5p6` | 2026-04-18 | Data migration: renames contact outcome `'ghosted'` → `'lost_touch'`. | Stage 6.5 | yes |

### Notes
- Down migrations exist for everything except #7 (the no-op placeholder).
- `b2c3d4e5f6a7` is the riskiest — it drops 6 columns and adds 8. The downgrade re-adds the dropped columns with `NOT NULL` + `server_default ''` to avoid violating NOT NULL constraints, but this is destructive in practice (data lost).
- The `a476a52207e1_placeholder` is a code smell that hints at a workflow break: someone applied a migration directly to the database before pushing. Worth knowing.

---

## 11. Tech debt and known issues

### TypeScript / linting
- **Strict mode is OFF.** `tsconfig.app.json`: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. Tracked in MEMORY.md as a Phase 4 TODO.
- ESLint config at `frontend/eslint.config.js` disables `@typescript-eslint/no-unused-vars` entirely. So unused variables compile and lint clean.
- I did not run `npm run lint && npx tsc --noEmit` so I cannot give a current warning count.

### `any` types
- A handful of files still use `any`: `frontend/src/data/jobs.ts:9` (legacy mock), `frontend/src/lib/api/jobs.ts:7` (interface field), `frontend/src/lib/contactLifecycle.ts:5` (probably a type assertion), `frontend/src/components/job-detail/OutreachBuilder.tsx:1` (legacy panel), and a few more. None are critical but they exist.

### Stubs and dead code
- **Worker:** `outreach_generation`, `follow_up_generation`, `flash_card_generation`, `pitch_deck_generation` consumers are 14-line stubs. The corresponding API endpoints (`outreach generate`, `follow-up generate`, `flash-cards generate`, `pitch-deck generate`) are also stubs that don't even publish to the queue.
- **Backend stubs:** `activity.py` returns `[]`. `notes.py` GET returns `[]`, PATCH returns `null`. `inbox.py` returns `[]`. `flash_cards.py` returns `[]`. `pitch_deck.py` returns `null`. `attachments.py` upload returns `null`. `follow_up.py` GET returns `[]`.
- **Frontend integrations not yet wired:**
  - The shadcn `Toaster` is mounted but never used (sonner is the active toaster).
  - `frontend/src/data/jobs.ts` is a leftover mock, possibly unused.
  - `frontend/src/components/JobsSection.tsx`, `JobRow.tsx`, `JobFilters.tsx` are only used by `Index.tsx` (legacy dashboard).
  - `frontend/src/components/kanban/*` is legacy — not imported by any active page.
  - `frontend/src/components/job-detail/*` is used only by the legacy `JobDetail.tsx` page at `/job/:id`.
  - The Sidebar's Resume/Support/Settings items have no routes.

### Commented-out credit deduction
- In `backend/app/api/v1/contacts.py` lines 166-167 and 208, the `_deduct_credits(...)` call is commented out: "Credit deduction disabled until results validated". The `_deduct_credits` function is implemented correctly (raises 402 if `credits_remaining < amount`, decrements, writes a CreditTransaction row), but no caller invokes it. **Every campaign and revisit is currently free.**
- Implications:
  - The Sidebar shows the user's signup grant of 3 credits indefinitely.
  - The `useCredits` cache invalidation in `useDiscoverContacts.onSuccess` (line 31 of `useContacts.ts`) is anticipating deductions that don't happen.
  - `useRevisitContacts` shows the user "Find 9 more (0.5 credits)" copy but doesn't actually deduct.

### Idempotency / robustness gaps
- `job_parsing` is **not idempotent.** A redelivered Service Bus message would re-run the AI calls and overwrite job columns. Acceptable risk because the broker rarely redelivers a successfully completed message, but worth knowing.
- The chained `contact-discovery` publish in `_publish_chained_discovery` is a separate transaction from the parsing run's status update. If the publish fails *after* the parsing status is committed as `completed`, the user sees parsing finished but no contacts arrive. The Room has an auto-bootstrap fallback, but this is a fragile coupling.
- No retry policy. Apify failures in `contact_discovery._apify_run` propagate up and mark the workflow as failed. The user has to click "Try again" in the Room.
- AI Foundry response parsing strips markdown fences (good) but doesn't validate fields. If the model returns malformed JSON, `json.loads` throws and the workflow fails.

### Wire-format inconsistencies
- **Outbound responses** are camelCase (`fullName`, `linkedinUrl`, `coffeeChatScheduledAt`). Set in `_contact_to_dict`, `_job_to_dict`, etc.
- **Inbound PATCH bodies** are snake_case (`is_selected`, `replied_at`, `coffee_chat_scheduled_at`). Pydantic `BaseModel` field names directly. The frontend has helper objects (e.g. `MILESTONE_TO_SNAKE` in `lib/api/jobs.ts:134`) to translate before sending.
- This bifurcation is annoying but consistent. Don't try to "fix" it without a coordinated server+client refactor.

### Subtle bugs / smells I'd bet money on
- **Race condition on chained discovery WF id.** The frontend Context's `useEffect` reads `workflowRun?.outputData?._chained_discovery_run_id`. There's a window where parsing has just completed, the WF row has `output_data` set, but the workflow_run query hasn't refreshed yet (it's polling, may have stale data). The next 2s tick should pick it up — but the user could see "Referroing failed" briefly if the parsing run's `status` flickers in a weird order. Probably benign in practice.
- **Photo URL extraction fails silently.** `_extract_photo_url` checks 8 candidate keys (`photo`, `photoUrl`, `profilePictureUrl`, `pictureUrl`, `avatarUrl`, `picture`, `profilePicture`, `profile_picture_url`). If LinkedIn changes the field name, photos disappear with no error and contacts fall back to monograms.
- **`_recompute_and_persist` is not called by the resume-related paths.** If a resume is uploaded, the worker doesn't currently re-derive any contact lifecycle. (Not an issue today because resume upload is unimplemented.)
- **CelebrationView gates the confetti via `localStorage["referroing:celebrated:<contactId>"]`.** If the user clears localStorage, the confetti will fire again. Probably fine.
- **The `_chained_discovery_run_id` lookup type-checks for `string`** but doesn't validate it's a UUID. A malformed value would pass the typeof check and break polling silently.

### Architectural inconsistencies
- **The legacy and new flows share data, not UI.** Both query the same React Query caches, both operate on the same DB rows. But the legacy `JobDetail` uses `KanbanCard`/`OutreachBuilder`/`FollowUpScheduler` (mostly stubbed), while the new Room uses `ContactPopup`/`MessageDraftView`/`PostReplyView` (all live). Decisions made in one don't always propagate to the other (e.g. setting `is_selected` in the Room doesn't update the `JobDetail` UI's idea of "selected" — they don't share state).
- **`Job.status` enum is stale.** It's set to `Interested` on creation and never touched again by the new flow. The stage pill is derived from contact statuses. This means, e.g., the dashboard's `byStatus` aggregation (`dashboard.py:21`) shows everything as `Interested` for users on the new flow.
- **No `MIGRATION_WORKFLOW.md` despite CLAUDE.md / your prompt mentioning a "push-first rule with cofounder."** I checked the docs/ folder and didn't find such a file. The only relevant doc is `docs/GIT_WORKFLOW.md` which says "no direct push to main or develop" and "PR rules: every PR needs 1 approval." There's no codified push-first migration policy for the cofounder. (Worth confirming with you whether this is just unwritten team practice, or if a doc is missing.)

---

## 12. The "modification cheat sheet"

### "I want to add a new page"
1. Create `frontend/src/pages/MyPage.tsx`. Default-export a function component. Match the shell pattern (Sidebar + main with `ml-20 p-8`).
2. Add an import + Route in `frontend/src/App.tsx` (above the catch-all `*`). Use `<ProtectedRoute>` to require auth.
3. Add a Sidebar entry in `frontend/src/components/Sidebar.tsx` (the `navItems` or `bottomItems` array) — pick a `lucide-react` icon and a `to` path.
4. If the page needs server data, build a hook in `frontend/src/hooks/useFoo.ts` that wraps a `lib/api/foo.ts` client call with `useQuery`.

### "I want to add a new lifecycle state"
This is a **multi-file** change. Do it in this order:
1. **Backend `outreach.py`:** Update `_derive_lifecycle_status` priority cascade. Decide where the new state slots in.
2. **Migration:** Add any new columns to the `contacts` table (timestamp/flag/whatever drives the state).
3. **Backend `contacts.py`:** Add the new column to `_TIMESTAMP_FIELDS` (if a timestamp), `_ACTIVITY_LABELS`, `PatchContactRequest`. Update `_contact_to_dict` to expose it.
4. **Frontend `types/job.ts`:** Add the field to `Contact` interface.
5. **Frontend `lib/contactLifecycle.ts`:** Add a constant in `STATES`. Add a label in `statusLabel`, `shortStatusBadge`. Add membership in `OUTCOME_STATES` / `MEETING_STATES` / `POST_REPLY_STATES` if relevant. Update `timelineIndex`. Update the relevant `canX` functions. Update `outcomeOptionsForState` / `nextCreatableType` / `currentDraftType`. Update `undoLabel`.
6. **Frontend `lib/jobStagePill.ts`:** If the new state should affect the job-level pill, update `getStagePill`.
7. **Frontend Room components:** Most likely you only touch `PostReplyView.tsx` to add a new action button conditional on the new state. If you're adding a pre-reply state, you may need `MessageDraftView.tsx` and `ContactPopup.handleUndo` instead.
8. **Frontend `Phase2Panel.tsx`:** Update `statusBadgeClasses` color mapping if needed.

Test: PATCH the contact through every transition, verify lifecycle_status flips.

### "I want to add a new outcome"
1. **Backend `outreach.py`:** Add the new value to `VALID_OUTCOMES`.
2. **Backend `contacts.py`:** Add to `_OUTCOME_LABELS` for activity-log copy.
3. **Migration:** No schema change needed — outcome is `varchar(20)`. Add a data migration if you're renaming an existing value (see `k1l2m3n4o5p6_rename_ghosted_outcome.py` as the template).
4. **Frontend `lib/contactLifecycle.ts`:** Add to `OUTCOMES`, `STATES.OUTCOME_*`, `OUTCOME_STATES` set, `statusLabel`, `shortStatusBadge`, `outcomeLabel`. Add to `outcomeOptionsForState` for whichever pre-states it should be available from.
5. **Frontend `room/ActivityTimeline.tsx`:** Add the outcome to `outcomeVisual` for icon + tone + label.
6. **Frontend `room/PostReplyView.tsx`:** No changes — `OutcomeDialog` reads from `outcomeOptionsForState`.

### "I want to change the popup design"
The contact popup is `frontend/src/components/room/ContactPopup.tsx`. It composes:
- Header with avatar/name/title/status + LinkedIn + close → directly in `ContactPopup.tsx`.
- `StateTimeline` → `frontend/src/components/room/StateTimeline.tsx`.
- Body: `MessageDraftView` (pre-reply) or `PostReplyView` (post-reply).

For a styling-only change, edit `ContactPopup.tsx` and the `Dialog` content className. For body content changes, edit the relevant view.

### "I want to add a new background job"
1. **Migration:** if it needs new fields.
2. **Define payload schema** in `docs/MESSAGE_SCHEMAS.md`.
3. **Backend `app/services/queue.py`:** add `publish_my_job(...)` mirroring `publish_job_parsing`.
4. **Backend API endpoint:** import `queue.publish_my_job`, call it from your endpoint, return `{ workflowRunId }`.
5. **Worker `consumers/my_job.py`:** copy the structure from `job_parsing.py`. Define `QUEUE_NAME`, `_engine`, `_Session`, `_process(payload)`, `listen()`. Use the WorkflowRun lifecycle religiously.
6. **Worker `app/main.py`:** add `my_job.listen()` to the `asyncio.gather`.
7. **Azure portal:** create the queue in Service Bus.
8. **Frontend hook:** if user-triggered, add a mutation that polls the resulting workflow_run via `useWorkflowRun`.
9. **Long-running?** Add `_renew_lock_periodically` (template in `contact_discovery.py`).

### "I want to change the celebration moment"
- **Trigger:** lifecycle becomes `outcome_offer`. Conditional in `frontend/src/components/room/PostReplyView.tsx:124`.
- **Component:** `frontend/src/components/room/CelebrationView.tsx`. Confetti is `canvas-confetti`. Colors are in `CONFETTI_COLORS`. The "celebrated once" gate is `localStorage["referroing:celebrated:<contactId>"]`.
- **Share copy:** `buildShareUrl` in the same file constructs the LinkedIn share URL.

### "I want to migrate the DB"
1. `cd backend && alembic revision --autogenerate -m "describe change"`. (Make sure the model classes are imported in `app/db/base.py` or a module that runs at import time — `app/db/models/__init__.py` is currently empty, so `base.py` does the import.)
2. Inspect the generated file in `backend/migrations/versions/`. Hand-edit if needed (e.g., default values, data migrations, indexes).
3. Run locally: `cd backend && alembic upgrade head`.
4. Push the migration **first**, before any code that depends on it. (Per CLAUDE.md and your prompt, this is the cofounder push-first rule — though I didn't find a doc that codifies it; ambient norm.)
5. Add a new alembic revision rather than editing an existing one. CLAUDE.md is explicit about this.

### "I want to add a new shadcn component"
- Use the shadcn CLI: `cd frontend && npx shadcn-ui@latest add <component>`. It writes to `src/components/ui/`.
- These files **are** committed to the repo and **should not be edited directly**. Extend them by composing in new files.

### "I want to add a new toast / error / empty state"
- **Toast:** `import { toast } from "sonner"`. `toast.success(...)`, `toast.error(...)`, `toast(message, { description, action })`.
- **Empty state:** `<EmptyState illustration={...} headline={...} body={...} cta={...} />` from `@/components/ui/EmptyState`. Illustrations in `EmptyIllustrations.tsx`.
- **Error state:** `<ErrorState headline body onRetry retryLabel compact />` from `@/components/ui/ErrorState`. Compact mode for inline errors.
- **Skeleton loader:** `<Skeleton className="h-X w-Y" />` from `@/components/ui/skeleton`. See `Room.tsx:RoomSkeleton` for a composed skeleton card.

---

## 13. Conventions and norms

### Naming
- React components: `PascalCase`, file matches component name.
- Hooks: `useFooBar` — camelCase prefixed `use`.
- Helpers: `camelCase` for functions, `SCREAMING_SNAKE_CASE` for constants.
- Backend: `snake_case` for functions, modules, fields. `PascalCase` for SQLAlchemy classes and Pydantic models.
- DB columns: `snake_case`. JSON-wire output: `camelCase` (translated by serializers).
- Migration files: `<rev>_<verb_phrase>.py` (e.g. `add_lifecycle_to_contacts.py`).
- Branches: `feat/REF-XX-description`, `chore/...`, `fix/...`. Currently on `feat/new-ux-chat-home`.

### Comments
- The backend uses sparing block comments at the top of complex helpers (e.g., `_derive_lifecycle_status` has a docstring). Inline comments only for non-obvious logic.
- The frontend tends to use comments for "// — Render branches —" headings inside long components and for warning notes (e.g., "// eslint-disable-next-line react-hooks/exhaustive-deps").
- No JSDoc, no docstrings on most functions.

### TypeScript usage
- Strict mode OFF (see Tech Debt). `noImplicitAny: false`, `strictNullChecks: false`.
- Interfaces over `type` aliases for objects (`interface Contact { ... }`).
- Discriminated string-literal unions for enum-like things (`type JobStatus = "Interested" | "Outreach Ready" | ...`).
- `any` is explicitly used in a handful of utility helpers — see Tech Debt.
- Backend: PEP 695 union syntax (`str | None`) is used.

### Error handling
- **Backend:** Raise `HTTPException(status_code=NNN, detail="message")`. Use the response envelope `{ data, meta, error }` for success. No `try/except` for business logic — let exceptions bubble.
- **Frontend (mutations):** `useMutation` `onError` shows a `sonner` toast. Optimistic mutations also rollback the cache.
- **Frontend (queries):** Components branch on `isLoading` / `isError` / `data`. The Room and Jobs pages have full skeleton loaders + ErrorState fallback. Many smaller components have ad-hoc spinners.
- **Frontend global:** `ErrorBoundary` wraps the app for uncaught render errors. `client.ts` redirects to `/login` on 401.

### File organization rules
- **New page** → `pages/`.
- **New section/feature** → `components/<feature>/`.
- **Shared UI primitive** → `components/ui/` (project-owned). Shadcn-managed primitives also live there; don't edit them directly.
- **New hook** → `hooks/`.
- **New API client** → `lib/api/`.
- **New utility helper** → `lib/`.
- **New types** → `types/` if shared, otherwise inline.
- **Backend new endpoint group** → `app/api/v1/<group>.py` + register in `router.py`.
- **Backend new model** → `app/db/models/<file>.py` + import in `app/db/base.py`.
- **Worker new consumer** → `worker/app/consumers/<name>.py` + import in `worker/app/main.py`.

### The "push-first migration rule"
The prompt mentions this as a cofounder workflow. I didn't find it in any doc. Based on inferring from `docs/GIT_WORKFLOW.md` + the placeholder migration `a476a52207e1`, my best read is:

> **Migrations are applied to the shared dev database before merging the code that depends on them.** If two devs are working in parallel and one merges first, the other has to rebase against the new revision. The placeholder migration exists because someone applied a change directly to the DB, then committed the empty file later to keep alembic's chain consistent — exactly the failure mode this rule prevents.

If this is documented somewhere I missed, please point me to it.

---

## 14. Things I learned that surprised me

- **The Room is two distinct UIs in one route.** Whether you see "Pick contacts" or "Reach out" depends entirely on `milestones.contact_selected`. I expected a more visible conditional (a step indicator, a tab, a wizard). The single boolean works but is invisible to a developer skimming the file.
- **The lifecycle state is server-derived but stored.** I'd expect a system this disciplined to either compute on read every time, or store with strict transition validation. Instead it's stored (so you can index and filter on it) but recomputed from raw fields on every relevant write. The `_derive_lifecycle_status` cascade is short and clean — a nice middle ground.
- **The "Referroing" overlay survives across pages.** Because the provider is at the top of the router tree and persists state to localStorage, the user can navigate away (Jobs, Inbox, Home) while the pipeline runs and the pill follows them. Closing the tab and reopening lands them on the pill (not the blur — see the load-from-storage logic that downgrades blurred → pill).
- **The Vite dev port is 8080, not 5173.** CLAUDE.md says 5173 (the Vite default), but `vite.config.ts:10` explicitly sets `server.port = 8080`. Local dev probably uses 8080. The `CORS_ALLOWED_ORIGINS` default in `.env.example` is `http://localhost:5173`, so first-time setup may produce a "Failed to fetch" CORS error until the engineer figures it out (and indeed, `docs/lessons.md` has a section on this exact trap).
- **The chained discovery is async-of-an-async.** The job_parsing worker writes a queued workflow_run row to the DB, *then* publishes the SB message, *all from inside another consumer's processing.* This is unusual — most architectures would have the API trigger the chain. Doing it from the worker keeps the chain "cohesive" but leaves a window where the row exists but the message is in flight.
- **Pricing cost optimization doc and code disagree.** The doc (`docs/learnings/ref-pricing-cost-optimization.md`) describes 12 profiles in one Apify call with batch_number assigned by rank. The code in `contact_discovery.py:267-273` actually uses `maxItems: 4` and increments `startPage` per batch. The current implementation pays 3 Apify calls per round, not 1. Either the doc is aspirational or the code regressed; I'd flag this for verification.
- **Contact `is_selected` and JobMilestone `contact_selected` are separate.** Selecting a single contact toggles `contacts.is_selected`. Confirming the trio of selected contacts toggles `job_milestones.contact_selected` (boolean for the entire job). They're not redundant — the milestone flag is what flips the Room from Phase 1 to Phase 2.
- **`outcomes` table is unused.** The model exists. The migration created it. The 1:1 unique constraint on `job_id` is in place. But no code path in the app inserts, updates, or reads this table. The "outcome" lives entirely on `contacts.outcome`. (Possibly intended for a future job-level outcome that aggregates over contacts, but currently dead.)
- **`tags` and `job_tags` tables exist but no code uses them.** No router writes here. The `Job` type doesn't even include tags by default (it's an optional field used only in the legacy JobDetail's `NotesAttachments` component, which gets a passed prop with `[]`).
- **`inbox_items` table exists. The inbox is generated client-side anyway.** The schema slot exists for a future server-side inbox (mentioned in CONTEXT.md as Phase 3 work). For now `lib/inboxUtils.ts` re-derives the action list from the jobs array on every render.
- **The `DELETE /jobs/{id}/contacts` endpoint deletes ALL contacts for a job.** No filter. It's destructive. Not used by any frontend code path I could find. Probably leftover from early dev.
- **Two `ActivityTimeline` components exist.** `frontend/src/components/job-detail/ActivityTimeline.tsx` (37 lines, generic activity items prop) and `frontend/src/components/room/ActivityTimeline.tsx` (123 lines, derives from contact + messages). They have nothing in common except the name. The job-detail one is used by the legacy JobDetail page; the Room one is the active version.
- **The PostReplyView allows scheduling an interview directly from `replied`** (`canScheduleInterview` allows from both `replied` and `coffee_chat_completed`). This means a candidate who skips coffee chat goes straight from "they replied" → "interview scheduled." The state machine is "linear with skips" — coffee chat is genuinely optional, not just visually demoted.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Referroing** | The branded loading state. Triggered by submitting a job URL. Combines parsing + contact discovery in one continuous "moment." The animated word in the overlay. |
| **Phase 1** | The first half of the Room — "Pick your contacts." Active when `milestones.contact_selected === false`. |
| **Phase 2** | The second half of the Room — "Reach out." Active when `milestones.contact_selected === true`. Three contact tiles open the popup. |
| **Lifecycle status** | The contact-level state from `not_contacted` through `outcome_*`. Stored on `contacts.lifecycle_status`. Server-derived from raw timestamps + outcome + outreach messages. The single source of truth for "what stage is this contact in?" |
| **Outcome** | Terminal state of a contact's outreach. One of: offer, rejected, withdrew, not_right_person, not_a_fit, lost_touch, cancelled, company_cancelled. Stored on `contacts.outcome`; lifecycle_status becomes `outcome_<value>`. |
| **Active job** | `jobs.is_deleted = false`. Shown on Jobs page Active tab. |
| **Archived job** | `jobs.is_deleted = true`. Shown on Jobs page Archived tab. Restorable via `POST /jobs/{id}/restore`. |
| **Contact discovery** | The Apify-powered LinkedIn employee search and AI-scoring pipeline. Implemented in `worker/app/consumers/contact_discovery.py`. |
| **Batch** | One discovery API call's worth of contacts. Up to 3 batches per round (3 contacts per batch = 9 max per round). |
| **Round** | One credit's worth of campaign. Round 1 starts on the first Discover call. "Revisit" creates round 2, 3, etc. Each round is deduplicated against existing contacts on the same job. |
| **Workflow run** | A row in `workflow_runs` tracking one async job. Status: queued → running → completed | failed. Frontend polls these every 2s. |
| **Selected contact** | A contact with `is_selected = true`. The user picks 3 in Phase 1. The Room hard-caps selection at 3. |
| **Stage pill** | The job-level status badge shown in the Room and on JobCards. Computed by `getStagePill(jobStatus, contactStatuses)`. Six tones: neutral, early-active, mid-active, late-active, landed, closed. |
| **Job milestone** | A row in `job_milestones`. 10 booleans (`resume_tailored`, `contact_selected`, `outreach_sent`, …). Only `contact_selected` is actively used in the new flow. |
| **Active referro** | The state object held in `ReferroingContext`. Persisted to `localStorage["referroing:active"]`. Versioned (currently version 2). |
| **Phase (referroing)** | "parsing" or "discovery" — which workflow_run is currently being polled. The chained pipeline pivots phase mid-flow. |
| **Chained discovery** | The pattern in `job_parsing.py` where the worker itself publishes a `contact-discovery` message after parsing succeeds. Output_data carries `_chained_discovery_run_id`. |
| **Pick contacts panel** | Phase 1 UI. `frontend/src/components/room/PickContactsPanel.tsx`. |
| **Contact popup** | Phase 2 modal. `frontend/src/components/room/ContactPopup.tsx`. Built on Radix Dialog. |
| **Message draft view** | Pre-reply branch of the popup body. `frontend/src/components/room/MessageDraftView.tsx`. Auto-saves on 500ms debounce. |
| **Post-reply view** | Post-reply branch of the popup body. `frontend/src/components/room/PostReplyView.tsx`. Schedules + completions + outcome. |
| **State timeline** | The 5-step progress visualization at the top of the popup. Maps 16 lifecycle states to 5 buckets: not contacted / outreach / replied / meeting / outcome. |
| **Activity timeline** | Per-contact chronological log shown below PostReplyView actions. Derives entries from contact timestamps + message sends. (Different from the `activity_log` DB table.) |
| **Outcome dialog** | `frontend/src/components/room/OutcomeDialog.tsx`. Radio-group dialog with state-specific outcome options. |
| **Celebration view** | `frontend/src/components/room/CelebrationView.tsx`. Renders on `outcome_offer`. Confetti + LinkedIn share. |
| **Auto-bootstrap** | The `useEffect` in `PickContactsPanel.tsx:64` that fires `discoverBatch(1, 1)` on first mount when no contacts exist. Backstop for cases where the chained discovery publish failed in the worker. |
| **Revisit** | A new contact-discovery round (round 2+) for a job that has already exhausted its 3 batches. Costs 0.5 credits (eventually — currently free). Deduplicates against existing contacts. |
| **Soft delete** | Setting `is_deleted = true` on jobs. Reversible via `restore_job`. |
| **Response envelope** | The `{ data, meta, error }` shape that every backend endpoint returns. Universal. |
| **Sidebar credit pill** | The yellow "credits remaining" indicator at the bottom of the Sidebar. Reads from `useCredits` (`GET /credits/me`). |
| **WorkflowRun lifecycle** | The 4-state machine for async jobs: queued → running → completed | failed. Documented in `docs/WORKFLOW_LIFECYCLE.md`. |

---

*End of audit. ce4aa84 (`feat/new-ux-chat-home`).*
