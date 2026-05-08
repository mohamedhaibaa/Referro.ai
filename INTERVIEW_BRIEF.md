# Referoo.ai — Technical Interview Brief

> Single-document briefing for the accelerator interview. Covers what the product is, how the three services talk to each other, the AI pipeline, the state machines, the engineering disciplines, and answers to likely tough questions.

---

## 1. One-Liner

**Referoo is an AI outreach platform for job seekers.** A user pastes a job URL → AI parses the job and researches the company → AI scrapes and scores the right people to contact at that company → AI helps draft personalised outreach → a state machine tracks every conversation through to offer.

It is **not** a job board, **not** a generic Kanban tool, and **not** an interview prep app. The Kanban view is a visualisation aid — it is not the product.

**Target user:** Job seekers (students, career changers, professionals) who already know which companies they want to work at and need leverage on their outreach.

**Business model:** Credit-based SaaS (1 credit = 1 outreach campaign), tiered subscriptions.

---

## 2. The Three Services and Their Roles

This is the most important mental model. Referoo is **three independent services** that communicate through two channels: an HTTPS REST contract (browser → API) and an asynchronous message queue (API → worker).

### 2.1 The Frontend — React SPA

**Location:** `/frontend`
**Stack:** React 18 + Vite 5 + TypeScript 5.8 + Tailwind + shadcn/ui + TanStack React Query
**Hosted on:** Azure Static Web Apps (CDN-backed)
**Talks to:** the Backend, only. Never to the worker, never to the database, never to AI Foundry, never to Azure Service Bus.

**Its job:**
- Render the UI (Dashboard, Kanban board, Job Detail, Inbox, Room).
- Hold short-lived UI state (form drafts, open modals, selected contact).
- Send authenticated REST requests to the Backend with a Bearer JWT.
- Cache server responses with React Query and **invalidate that cache on every successful mutation** so the UI always reflects the database.
- Poll `/workflow-runs/{id}` every 2 seconds to track async jobs (parsing, contact discovery, etc.) and stop polling when the run reaches a terminal state.

**Key contract:** the frontend never computes business state. It reads the server's view (e.g. `lifecycle_status`, `progress`) and shows it. The server is the source of truth.

### 2.2 The Backend — FastAPI REST API

**Location:** `/backend`
**Stack:** FastAPI + SQLAlchemy 2 + Alembic + Pydantic + python-jose (JWT) + passlib (bcrypt)
**Hosted on:** Azure Container Apps (HTTP autoscale)
**Talks to:** Postgres (read/write), Service Bus (publish-only), Blob Storage (read/write — when implemented).

**Its job:**
- **Authentication.** Issue and validate JWTs. `get_current_user` dependency runs on every protected endpoint.
- **Synchronous CRUD.** Create/read/update/delete jobs, contacts, milestones, outreach messages, notes, etc. — anything that can be done in milliseconds.
- **Authorization.** Every query filters by `user_id == current_user.id`. Every job query also filters `is_deleted == False`. There is no admin bypass.
- **Queue dispatch.** When the user triggers a long-running AI job, the backend creates a `workflow_runs` row (status `queued`), publishes a message to the right Service Bus queue, and returns `202 Accepted` with a `workflow_run_id` — it does **not** wait.
- **Computed serialisation.** Display fields like `confidence`, `relationship`, `progress` are computed in the response serialiser, not stored — one source of truth.

**Key contract:** every response uses the envelope `{ data, meta, error }`. Even errors. The frontend never has to branch on response shape.

### 2.3 The Worker — Async Python Consumer

**Location:** `/worker`
**Stack:** asyncio + Azure Service Bus SDK + SQLAlchemy + httpx + BeautifulSoup
**Hosted on:** Azure Container Apps (queue-depth autoscale, independent of the API)
**Talks to:** Postgres (read/write), Azure Service Bus (consume), Azure AI Foundry (gpt-4o-mini), Apify, Gamma, Blob Storage.

**Its job:**
- One Python process that runs **six concurrent listeners** in `asyncio.gather` (`worker/app/main.py`) — one per queue.
- Each consumer follows the same lifecycle: receive message → mark `workflow_runs.status = 'running'` → do the work → mark `completed` or `failed`.
- Calls external APIs (AI Foundry, Apify, Gamma) — these are slow (10s–3min) and would block the API if they ran there.
- Writes results back to the database. Inserts an `activity_log` row for every milestone (free audit trail).
- Renews Service Bus message locks every 30s on long-running jobs (default lock is 60s; contact discovery can take minutes).

**Key contract:** the worker never returns data to the user directly. It writes to Postgres. The frontend learns about completion via polling `/workflow-runs/{id}` on the backend.

---

## 3. How the Three Services Talk — End-to-End Walkthrough

The clearest way to explain the architecture is to follow one user action through every layer. Here is what happens when a user pastes a LinkedIn job URL and clicks "Add."

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 1 — Browser → Backend (synchronous HTTP)                                │
└──────────────────────────────────────────────────────────────────────────────┘

   User clicks "Add" on the Kanban board.
   Frontend calls:
       api.post('/jobs', { url })             ← frontend/src/lib/api/client.ts
   The client.ts wrapper attaches:
       Authorization: Bearer <jwt-from-localStorage>
       Content-Type: application/json

┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 2 — Backend handles the request                                         │
└──────────────────────────────────────────────────────────────────────────────┘

   POST /api/v1/jobs hits backend/app/api/v1/jobs.py.
   1. get_current_user dependency validates the JWT, loads the User row.
   2. Endpoint creates a Job row (status='Interested').
   3. Endpoint creates a JobMilestone row (all 10 booleans = false).
   4. Endpoint calls queue.publish_job_parsing(...) which:
        a. INSERTs a workflow_runs row with status='queued' and type='job-parsing'.
        b. db.commit() — so the worker can read it immediately.
        c. Sends a Service Bus message:
             {
               "workflow_run_id": "<uuid>",
               "user_id": "<uuid>",
               "job_id": "<uuid>",
               "url": "https://linkedin.com/jobs/..."
             }
   5. Returns 202 Accepted with { data: { id, workflowRunId } }.

   Total time: ~50ms. The user sees a "Parsing…" card immediately.

┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 3 — Service Bus delivers the message                                    │
└──────────────────────────────────────────────────────────────────────────────┘

   Azure Service Bus holds the message in the "job-parsing" queue.
   The worker has been listening on this queue since startup
   (worker/app/consumers/job_parsing.py → listen()).
   The message is delivered with a 60-second visibility lock.

┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 4 — Worker processes the job                                            │
└──────────────────────────────────────────────────────────────────────────────┘

   The job_parsing consumer runs _process(payload):
   1. UPDATE workflow_runs SET status='running', started_at=now().
   2. Scrape the page (BeautifulSoup → falls back to Apify harvestapi/linkedin-company
      for non-LinkedIn URLs, validating by domain match — not slug guessing).
   3. Call AI Foundry (gpt-4o-mini) with the JOB_PARSING_SYSTEM_PROMPT to extract
      structured JSON: { title, company, description, location, work_mode, role_family }.
   4. UPDATE jobs SET title=..., company=..., description=..., etc.
   5. Call AI Foundry again with COMPANY_RESEARCH_SYSTEM_PROMPT.
   6. UPDATE jobs SET company_research=...
   7. INSERT activity_log rows ("Job parsed by AI", "Company research completed").
   8. **Chain forward**: publish a contact-discovery message so the user gets
      contacts without a second click.
   9. UPDATE workflow_runs SET status='completed', completed_at=now(), output_data=...

   Total time: typically 15–40 seconds.

┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 5 — Frontend learns about completion (polling)                          │
└──────────────────────────────────────────────────────────────────────────────┘

   The instant the frontend received the workflowRunId in step 2, it started:
       useWorkflowRun(workflowRunId)         ← frontend/src/hooks/useWorkflowRun.ts
   which polls GET /workflow-runs/{id} every 2 seconds.

   On each poll, the backend reads the workflow_runs row and returns the status.
   When status flips to 'completed', the hook stops polling and React Query
   invalidates the 'jobs' cache → the Kanban card re-renders with the AI-parsed
   title, company, and description.
```

**Three key things to notice:**

1. **The frontend never talks to the worker.** They are completely decoupled. The frontend talks to the backend; the backend talks to the queue; the worker reads the queue. Polling is the only channel by which the frontend learns the worker finished.
2. **The database is the integration point.** The worker writes results to Postgres; the backend reads them on the next request. Neither service has to know the other's address, API, or schema beyond what's in the `workflow_runs` row.
3. **Service Bus gives durability.** If the worker crashes mid-job, the message lock expires and Service Bus redelivers it — the worker's idempotency check (does a contact for this batch already exist?) makes replays safe.

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                 │
│                                                                         │
│   React SPA (Vite) ─── Azure Static Web Apps                            │
│       • All UI rendering, form state, modals                            │
│       • React Query caches API responses                                │
│       • api.get/post/patch/delete (lib/api/client.ts) attaches JWT      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS · Bearer JWT · JSON envelope
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Azure Container Apps — API Role                        │
│                                                                         │
│   FastAPI (sync)                                                        │
│       • get_current_user (JWT validation)                               │
│       • /api/v1/* endpoints (CRUD, ownership filter)                    │
│       • Response envelope { data, meta, error }                         │
│       • For long jobs: create workflow_run + publish + return 202       │
└───────────┬─────────────────────────────────────┬───────────────────────┘
            │                                     │
            │ SQLAlchemy                          │ ServiceBusClient.send_messages
            ▼                                     ▼
┌─────────────────────────┐       ┌─────────────────────────────────────┐
│  Azure Postgres 16      │       │     Azure Service Bus (6 queues)    │
│   • 16 tables           │       │       job-parsing                   │
│   • UUID PKs            │       │       contact-discovery             │
│   • user_id on every    │       │       outreach-generation           │
│     row (RLS in app)    │       │       follow-up-generation          │
│   • activity_log        │       │       flash-card-generation         │
│     (append-only)       │       │       pitch-deck-generation         │
└────────────▲────────────┘       └─────────────────┬───────────────────┘
             │                                      │
             │ writes results                       │ pulls messages
             │                                      ▼
             │              ┌────────────────────────────────────────────┐
             │              │   Azure Container Apps — Worker Role       │
             │              │                                            │
             └──────────────┤   asyncio.gather(6 listeners + cleanup)    │
                            │     • Update workflow_runs lifecycle       │
                            │     • Renew message lock every 30s         │
                            │     • Idempotency checks                   │
                            │                                            │
                            │   Calls out to:                            │
                            │     ─→ Azure AI Foundry (gpt-4o-mini)      │
                            │     ─→ Apify (LinkedIn scraping)           │
                            │     ─→ Gamma API (pitch decks, planned)    │
                            │     ─→ Azure Blob Storage (resumes)        │
                            └────────────────────────────────────────────┘

Cross-cutting:
  Azure Key Vault — all secrets (DB conn, JWT secret, AI key, Apify token)
  App Insights   — tracing, metrics, alerts (planned)
```

---

## 5. Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend framework | React 18 + Vite 5 + TypeScript 5.8 | Fast dev loop, mature ecosystem, type safety |
| UI primitives | shadcn/ui (on Radix) + Tailwind CSS 3 | Composable, accessible, no lock-in to a component lib |
| Server state | TanStack React Query 5 | Cache + invalidation + polling in one tool |
| Forms | React Hook Form + Zod | Performant validation without re-renders |
| Backend framework | FastAPI 0.115 | Async-capable, auto OpenAPI docs, Pydantic validation |
| ORM | SQLAlchemy 2.0 | Mature, type-safe, supports both sync and async |
| Migrations | Alembic 1.13 | Standard for SQLAlchemy; we have 14 migrations on disk |
| Auth | python-jose (JWT, HS256) + passlib bcrypt | Stateless, no session table |
| Async transport | Azure Service Bus 7.11 | Durable, lock renewal, dead-letter queues |
| Worker runtime | Python 3.12 + asyncio | Single process, six concurrent listeners |
| AI | Azure AI Foundry — gpt-4o-mini deployment | Cost-effective, structured JSON output, native Azure billing |
| LinkedIn data | Apify (`harvestapi/linkedin-company-employees`, `harvestapi/linkedin-company`) | Abstracts away anti-bot detection; swappable actor if one breaks |
| File storage | Azure Blob Storage | Cheap, native to Azure, signed URLs |
| Database | Azure Database for PostgreSQL Flexible Server (PG16) | Managed, point-in-time restore, vertical scale |
| Hosting | Azure Container Apps (API + Worker) + Azure Static Web Apps (FE) | Two roles from one image; queue-depth autoscale |
| Secrets | Azure Key Vault | No secrets in code or env files in production |
| Monitoring | Azure Application Insights (planned) | Traces across API → queue → worker |
| CI/CD | GitHub Actions | 3 workflows (frontend, backend, worker) |

---

## 6. The AI Pipeline (the differentiated part)

### Stage 1 — Job Parsing (works today)

`worker/app/consumers/job_parsing.py`

1. Scrape the URL. BeautifulSoup for normal pages; for non-LinkedIn URLs, fall back to Apify `harvestapi/linkedin-company` searched by company name and validated by **domain matching** (not slug guessing — that was a real bug we hit).
2. AI Foundry call #1 with `JOB_PARSING_SYSTEM_PROMPT` extracts: `title, company, description, location, work_mode, role_family`. Strict "return ONLY JSON" instruction.
3. AI Foundry call #2 with `COMPANY_RESEARCH_SYSTEM_PROMPT` produces a company summary written to `jobs.company_research`.
4. Append two `activity_log` rows.
5. Chain straight into contact discovery (publish a second Service Bus message) — the user gets contacts without a second click.

### Stage 2 — Contact Discovery (works today, ~490 lines, the most differentiated piece)

`worker/app/consumers/contact_discovery.py`

1. Pull the **exact** company LinkedIn URL extracted during parsing (avoids slug-guessing — concrete answer if asked about hard problems).
2. Build `titleKeywords` for the Apify employees actor: role-relevant words from the job title + always include Recruiter, Talent Acquisition, HR, Manager, Director.
3. Call Apify `harvestapi/linkedin-company-employees` with the company URL and keywords.
4. Filter to **active employees only** — the helper `_is_active` is resilient to multiple Apify response shapes (`currentPositions`, `currentPosition`, `experience[]` with no `endDate`).
5. **AI scoring pass.** Send the filtered profiles to AI Foundry with this additive rubric (hard-coded in `SCORING_SYSTEM_PROMPT`):

   | Criterion | Score |
   |-----------|------:|
   | Same role/function as the job (most important signal) | **+45** |
   | Recruiter / TA / HR | **+40** |
   | Direct manager or team lead of the relevant department | **+25** |
   | Same university as the candidate (pulled from parsed resume) | **+20** |
   | Same city as the job | **+15** |
   | 0–18 months at the company (will spill interview tips) | **+10** |
   | Unrelated department (e.g. sales person for an engineering role) | **−20** |
   | 10+ year tenure | **−10** |
   | C-suite | **−15** (too senior for cold outreach) |

6. Top 3 by score are written to `contacts` with `batch_number` and `round_number`.

### Engineering details that show maturity (great for tough questions)

- **Idempotency.** The worker checks if contacts already exist for this `(batch_number, round_number)` and skips the Apify call if so. Safe replays.
- **Service Bus lock renewal.** A custom `_renew_lock_periodically` task renews the message lock every 30 seconds because contact discovery can run for minutes. The default 60s lock would expire mid-job otherwise.
- **Markdown-fence stripping.** Defensive parse of AI JSON output (LLMs sometimes wrap responses in ```` ```json ````).
- **Display fields computed in the serialiser, not stored.** `confidence` ("High"/"Medium"/"Low"), `relationship` ("Recruiter"/"Hiring Manager"/"Team Lead"/"Employee"), `source`. One place to change the mapping; reduces drift.
- **Profile data cleanup policy.** `profile_data` blob is nullified after 30 days or when the job moves to "Interviewing" or "Closed" — privacy and storage hygiene.

---

## 7. State Machines

### Job status (8 states)

```
Interested → Outreach Ready → Outreach Sent → Replied → Meeting Booked → Interviewing → Offer → Closed
```

### Contact lifecycle status (server-derived)

`backend/app/api/v1/outreach.py::_derive_lifecycle_status`. Priority chain — each level short-circuits:

```
outcome
  > interview_completed
    > interview_scheduled
      > coffee_chat_completed
        > coffee_chat_scheduled
          > replied
            > followup_2_(sent|drafted)
              > followup_1_(sent|drafted)
                > (initial) sent | drafted
                  > not_contacted
```

**The server owns this.** Every endpoint that mutates a message or a contact lifecycle column calls `_recompute_and_persist`, which recomputes the status and writes it to the row. The client reads only.

### Job progress

```
progress = count(true milestones in job_milestones) / 10 * 100
```

Ten boolean checkpoints in a 1:1 `job_milestones` table (resume_tailored, contact_selected, outreach_sent, follow_up_sent, reply_received, interview_scheduled, interview_prep_1/2/3, outcome_recorded).

---

## 8. The Engineering Disciplines That Keep It Coherent

These are non-negotiable rules in `CLAUDE.md` — investors love specific engineering rules.

1. **Response envelope, every endpoint:** `{ data, meta, error }`. Even errors. Frontend never branches on response shape.
2. **User ownership in every query:** `user_id == current_user.id`. Job queries also include `is_deleted == False`. Soft delete only — there is no hard delete path in the API.
3. **Async lifecycle:** every long-running job goes `queued → running → completed/failed` via the `workflow_runs` table. Frontend polls every 2s and stops on terminal status.
4. **JWT in Authorization header, not cookies.** Stateless server, no session table. HS256, 60-minute expiry.
5. **camelCase JSON ↔ snake_case DB.** A small `_to_dict` serialiser bridges them per resource — no implicit ORM serialisation.
6. **Server is the source of truth.** Frontend invalidates React Query cache on every successful mutation. Computed fields like `lifecycle_status` are written by the server and read by the client.
7. **Queue names are kebab-case and case-sensitive.** Must match exactly between publisher (`backend/app/services/queue.py`) and consumer (`worker/app/consumers/*.py`).

---

## 9. Database — 16 Tables

`users · jobs · job_milestones · contacts · outreach_messages · follow_ups · notes · tags · job_tags · activity_log · pitch_decks · flash_cards · outcomes · resumes · inbox_items · workflow_runs`

- All UUID primary keys (`default=uuid.uuid4`).
- All have a `user_id` foreign key for ownership enforcement at the application layer.
- All have `created_at`; mutable rows have `updated_at`.
- Schema has evolved through 14 Alembic migrations — including pricing schema, contact lifecycle columns, contact selection cap, and a "ghosted" outcome rename. The migration history is itself evidence of real product iteration.
- `activity_log` is **append-only** — every mutation writes a row. Free audit trail and timeline UI.
- `workflow_runs` is the integration point between API and worker. Frontend polls it; worker writes to it.

---

## 10. Pricing Model (already in the schema)

Migration `g7h8i9j0k1l2_pricing_schema.py` adds credits and a transaction ledger.

- **1 credit = 1 campaign**, which is **12 profiles scraped** in one Apify call. Top 9 are stored, served to the user as **3 batches of 3** — batches 2 and 3 come **from the database instantly**, no extra Apify cost.
- **Revisit = 0.5 credit.** New `round_number`, deduplicated by `linkedin_url` against existing contacts.
- **Tiers:** trial (3) · warmup (20) · grind (60) · closer (200 fair-use + free revisits).
- Insufficient credits returns **HTTP 402** — frontend shows an inline error.

Unit economics framing: one campaign costs roughly $0.10 on Apify + a few cents on AI Foundry. Tiers are priced as fair-use multiples of that COGS.

---

## 11. Where We Are Honestly

### Production-ready
- Auth (register, login, logout, JWT)
- Job CRUD + soft delete + restore (with optimistic UI and Undo)
- Job parsing (URL → structured data)
- Company research (AI-generated summary)
- Contact discovery (full pipeline: scrape, filter, score, store, batch)
- Contact lifecycle tracking (10+ states, server-derived)
- Outreach drafting + send tracking + revision
- Kanban board (8 columns, drag-and-drop)
- Workflow polling (2s polling, stops on terminal state)
- Dashboard metrics (jobs, statuses, outreach sent, meetings, offers)
- Credit ledger schema
- Skeleton loaders, error boundaries, inline error states with Retry, undo toasts (recent commits: Stage 7A/B/C)

### Stubbed (UI exists, worker is a 14-line skeleton)
- Outreach AI generation
- Follow-up AI generation
- Flash cards AI generation
- Pitch deck (Gamma API not connected)
- File upload to Blob Storage
- Notes/inbox server-side persistence

### Not started
- Email integration (send via Gmail/Outlook, track opens/clicks)
- Calendar sync
- Rate limiting
- WebSockets / SSE (currently 2-second polling)
- Automated test coverage (pytest installed, zero test files written)
- Production CI/CD pipeline (GitHub Actions wired but no Azure deploy step)

If asked "how complete is the MVP?" → **"The core outreach pipeline is end-to-end. The AI prompts for follow-ups, flash cards, and pitch decks are scaffolded but not wired. The architecture is built so adding each one is one consumer file plus one prompt file — every queue and contract is in place."**

---

## 12. Likely Investor Questions + Crisp Answers

**"Why Azure and not AWS?"**
AI Foundry. Native Azure OpenAI deployment with managed identity and Key Vault — no separate vendor relationship or billing. Container Apps gives queue-based autoscale out of the box.

**"Why a worker pattern instead of background tasks in FastAPI?"**
Durability and isolation. A worker crash doesn't lose the job — Service Bus redelivers. Slow AI calls don't block the API. Queue depth is a clean signal for autoscale, independent from HTTP traffic.

**"How do you defend against LinkedIn blocking you?"**
We don't scrape directly. Apify is the abstraction layer. If one actor breaks, we can swap to another without touching our worker contract. We learned the hard way to use **domain validation** instead of slug guessing for company URLs.

**"What's the moat?"**
Three things. (1) The scoring rubric — anyone can call gpt-4o-mini, but the additive criteria we've tuned for "who's actually worth messaging" took experimentation. (2) The chained UX — parse → research → discover happens in one continuous flow, not three buttons. (3) The data we accumulate per user across campaigns informs better scoring over time.

**"Cost per user?"**
Per campaign: one Apify scrape (12 profiles, ~$0.10) + ~3 AI Foundry calls (gpt-4o-mini, sub-cent each). Roughly $0.10–$0.15 in COGS per credit. Pricing tiers are 5–10× that.

**"What's the riskiest part technically?"**
Apify response-shape drift. We've already hit it twice — `currentPosition` vs `currentPositions` vs `experience[]`. Mitigated by defensive helpers (`_current_position`, `_is_active`) that probe multiple fields. Documented as a rule in `CLAUDE.md`: "log raw keys before extraction."

**"Tests?"**
Honest answer: pytest is installed, zero test coverage today. Priority for the next sprint. The async lifecycle and the contracts (response envelope, ownership filter, workflow_runs status) make it tractable — clean seams to mock.

**"Security?"**
JWT bcrypt-hashed passwords, ownership filters in every query, secrets in Key Vault not env files in production, CORS allow-listed. Trade-off: relying on application-layer ownership instead of Postgres RLS — would tighten if multi-tenant scale demands it.

**"Why not just use Clay / Apollo / Lemlist?"**
Those are sales tools. They sell people lists; we use scraped LinkedIn data and score it for one specific use case (a job seeker reaching out about a specific role). Our scoring rubric is built around "who will actually reply to a coffee chat ask from a candidate", not "who is the decision-maker for this $50k contract." Different problem, different ranking, different price point.

**"What happens when you scale?"**
The three services scale independently. Frontend is a CDN. API scales on HTTP. Worker scales on queue depth. Postgres goes vertical (managed). The most likely bottleneck is Apify rate limits — solved either with a paid plan or with a request-level cache (we already have idempotency on `(batch_number, round_number)`).

---

## 13. File Map for Quick Reference

```
Referoo.ai/
├── frontend/                  # React SPA
│   └── src/
│       ├── lib/api/client.ts        # JWT injector + fetch wrapper
│       ├── hooks/useWorkflowRun.ts  # 2-second polling on workflow_runs
│       ├── hooks/useJobs.ts         # CRUD via React Query
│       ├── pages/                   # Home, Jobs, JobDetail, Inbox, Room
│       └── components/
│           ├── kanban/              # Drag-drop board
│           ├── job-detail/          # Per-job sub-components
│           └── room/                # New "Room" UX (recent feature)
│
├── backend/                   # FastAPI API
│   └── app/
│       ├── main.py                  # FastAPI app, CORS, /health
│       ├── api/v1/router.py         # Mounts all sub-routers
│       ├── api/v1/jobs.py           # 279 lines — full CRUD reference
│       ├── api/v1/contacts.py       # 389 lines — contact lifecycle
│       ├── api/v1/outreach.py       # 286 lines — message + lifecycle
│       ├── api/v1/credits.py        # Credit ledger
│       ├── api/deps.py              # get_current_user JWT dependency
│       ├── core/security.py         # JWT + bcrypt utilities
│       ├── db/models/               # SQLAlchemy models (16 tables)
│       └── services/queue.py        # Service Bus publisher (single point)
│
└── worker/                    # Async Python worker
    └── app/
        ├── main.py                  # asyncio.gather of all listeners
        ├── consumers/
        │   ├── job_parsing.py            # 284 lines — works
        │   ├── contact_discovery.py      # 490 lines — works (the moat)
        │   ├── outreach_generation.py    # 14 lines — stub
        │   ├── follow_up_generation.py   # 14 lines — stub
        │   ├── flash_card_generation.py  # 14 lines — stub
        │   ├── pitch_deck_generation.py  # 18 lines — stub
        │   └── cleanup.py                # 67 lines — periodic cleanup
        ├── integrations/ai_foundry.py    # gpt-4o-mini wrapper
        ├── integrations/gamma.py         # Pitch deck (planned)
        ├── integrations/blob_storage.py  # Resume storage (planned)
        ├── prompts/job_parsing.py        # System prompt
        ├── prompts/company_research.py   # System prompt
        └── scraper.py                    # BeautifulSoup + Apify fallback
```

---

## 14. The 60-Second Elevator Version

> Referoo helps job seekers reach the right people at the companies they want to work at. They paste a job URL, and our pipeline parses the job, researches the company, scrapes the company's employees on LinkedIn, scores them with a tuned AI rubric for who's actually worth messaging, and helps draft personalised outreach. We track every conversation through a state machine from first message to offer.
>
> Architecturally it's three services on Azure: a React frontend, a FastAPI backend, and an async Python worker, decoupled by Service Bus. The frontend never talks to the worker — they communicate through the database. The worker calls Azure AI Foundry (gpt-4o-mini) and Apify for the LinkedIn data. Pricing is credit-based: 1 credit = 12 profiles scraped, top 9 returned in 3 batches.
>
> Core outreach flow is end-to-end today; the AI prompts for follow-ups and interview prep are scaffolded but not wired — adding each is one consumer file plus one prompt file because every queue and contract is in place.
