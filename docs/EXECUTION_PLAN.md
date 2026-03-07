# Referro V1 — Execution Plan

> **CTO Directive**: This is the full build plan from hard-coded UI → production-ready product.
> Mohamed and Ahmed are both full-stack. Work is split by **feature ownership**, not by frontend/backend.
> Whoever owns a feature builds it end-to-end: UI wiring, API endpoint, database table, AI integration — all of it.
>
> **Timeline:** 6–7 Weeks
> **Shipping on:** React (Vite) + TypeScript — no Next.js migration in V1

---

## What We Have Today

A fully designed React/TypeScript frontend with:
- **Dashboard** — DailyGoalCard, MetricsCard, TasksCard, InboxPreview, JobsPreview (all hard-coded)
- **Jobs page** — KanbanBoard with filters (hard-coded sample data)
- **Job Detail page** — ProgressTracker, ContactDiscovery, OutreachBuilder, FollowUpScheduler, PitchDeckPanel, FlashCardsPanel, NotesAttachments, ActivityTimeline, OutcomeSection (all hard-coded)
- **Inbox page** — Message list with action items (hard-coded)
- **Sidebar** — Navigation to Home, Inbox, Jobs, Resume (Resume page not built yet)

Everything runs on `sampleJobs` from `src/data/jobs.ts`. Nothing persists. No auth. No backend.

---

## What We Need to Build

1. User authentication (sign up, log in, log out, protected routes)
2. Database tables for all entities (users, jobs, contacts, outreach, etc.)
3. Job creation flow (paste LinkedIn URL → parse → create job card)
4. Contact discovery (AI-powered, per job)
5. Outreach generation (AI-powered, per contact)
6. Follow-up scheduling and tracking
7. Pitch deck generation (Gamma API)
8. Flash cards generation (AI-powered)
9. Real-time inbox with actionable notifications
10. Dashboard metrics from live data
11. Resume upload and storage
12. File storage for exports and attachments

---

## Ground Rules

### How We Split Work
- Work is split by **feature**, not by layer
- If you own "Job Creation Flow", you build the UI form, the API endpoint, the database migration, and the AI call — everything
- This prevents handoff friction and keeps velocity high
- Each feature has a single owner but the other person reviews every PR

### Definition of Done (Every Feature)
- [ ] UI connected to real API (no more sample data for that feature)
- [ ] API endpoint tested manually (Postman/curl)
- [ ] Database table has proper indexes and RLS policies
- [ ] Error states handled in UI (loading, empty, error)
- [ ] PR reviewed and approved by the other person

### Git Workflow
- `main` = production (never push directly)
- `develop` = integration branch
- Feature branches: `feat/REF-XX-description` (e.g. `feat/REF-06-auth`)
- Chore branches: `chore/REF-XX-description` (e.g. `chore/REF-01-azure-infra`)
- Fix branches: `fix/REF-XX-description`
- Commit format: `feat:`, `fix:`, `chore:`, `refactor:`
- Every PR needs 1 approval before merge
- Squash and merge for features, regular merge for hotfixes
- Pull `develop` into your branch daily to avoid drift
- **PRs stay small** — max 400 lines, one logical change, review within 4 hours

### Day 1 Contracts (Sacred — Must Be Agreed Before Any Code)

Before anyone writes a line of code, both devs sit together and agree on:

1. **REST API Contract** — every endpoint, request/response shape, and status code. Written as a shared markdown doc or OpenAPI spec. This is the handshake that enables parallel work.
2. **Database Schema** — all tables, columns, types, foreign keys, indexes. See `DATABASE_SCHEMA.md`.
3. **Service Bus Message Schemas** — the JSON contract for all 6 queues (see Azure Service Bus section below).
4. **Workflow Run Lifecycle** — `queued → running → completed | failed`. Mohamed's API publishes, Ahmed's Worker consumes. Frontend polls status.
5. **Blob Storage Path Convention** — `resumes/{user_id}/{file}`, `exports/{user_id}/{file}`, `ai-outputs/{workflow_run_id}/{file}`.

**If a contract needs to change, talk first.** Don't change it and hope the other person notices.

---

## Azure Infrastructure Map

All services provisioned by Ahmed in Week 1, used by both throughout the project.

| Azure Service | Purpose | Key Details |
|---------------|---------|-------------|
| **Resource Group** | Container for all services | Single RG, consistent naming: `rg-referro-v1-prod` |
| **Azure Database for PostgreSQL** | Main database | Flexible Server, 16 tables (see `DATABASE_SCHEMA.md`) |
| **Azure Container Apps** | Backend hosting | 2 roles: **API** (sync CRUD) + **Worker** (async AI jobs) |
| **Azure AI Foundry** | AI orchestration | 7 Prompt Flows (see below) |
| **Azure Service Bus** | Background job queue | 6 queues (see below) |
| **Azure Blob Storage** | File storage | 3 containers: `resumes`, `exports`, `ai-outputs` |
| **Azure Key Vault** | Secrets management | DB password, AI keys, Gamma key, Service Bus connection string |
| **Azure Application Insights** | Monitoring & alerting | Error rates, latency, AI workflow metrics |
| **Azure Static Web Apps** | Frontend hosting | Production frontend deployment |

### Azure AI Foundry — 7 Prompt Flows

| # | Prompt Flow | Input | Output | Triggered By |
|---|-------------|-------|--------|-------------|
| 1 | Job Parsing | LinkedIn URL/HTML | Structured job data (title, company, description, work mode) | `job-parsing` queue |
| 2 | Company Research | Company name + industry | Company insights, talking points, culture notes | `job-parsing` queue (chained) |
| 3 | Contact Discovery | Job title + company + description | Ranked contacts with confidence scores | `contact-discovery` queue |
| 4 | Outreach Generation | Job + contact + resume context | Personalized outreach message drafts | `outreach-generation` queue |
| 5 | Follow-Up Generation | Original outreach + context + days elapsed | Follow-up message draft | `follow-up-generation` queue |
| 6 | Flash Card Generation | Job + company research + role requirements | 10–15 Q&A cards (title, strength, evidence, impact) | `flash-card-generation` queue |
| 7 | Pitch Deck Content | Resume + job + company research | Structured slide content (5 slides) | `pitch-deck-generation` queue |

### Azure Service Bus — 6 Queues

| Queue Name | Publisher | Consumer | Payload |
|------------|-----------|----------|---------|
| `job-parsing` | API (on `POST /jobs`) | Worker | `{ workflow_run_id, user_id, job_id, url }` |
| `contact-discovery` | API (on `POST /jobs/{id}/contacts/discover`) | Worker | `{ workflow_run_id, user_id, job_id }` |
| `outreach-generation` | API (on `POST /jobs/{id}/outreach/generate`) | Worker | `{ workflow_run_id, user_id, job_id, contact_id }` |
| `follow-up-generation` | API (on `POST /jobs/{id}/follow-up/generate`) | Worker | `{ workflow_run_id, user_id, job_id, outreach_message_id }` |
| `flash-card-generation` | API (on `POST /jobs/{id}/flash-cards/generate`) | Worker | `{ workflow_run_id, user_id, job_id }` |
| `pitch-deck-generation` | API (on `POST /jobs/{id}/pitch-deck/generate`) | Worker | `{ workflow_run_id, user_id, job_id }` |

**Pattern**: API creates a `workflow_runs` row (status = `queued`) → publishes message to Service Bus → returns `workflow_run_id` to frontend. Frontend polls `GET /workflow-runs/{id}` until `completed` or `failed`. Worker picks up message → calls AI Foundry → writes results to DB → updates `workflow_runs.status`.

---

## Phase 0 — Foundation (Week 1)

**Goal**: Auth works, database exists, frontend talks to backend. Nothing fancy, just the pipes.

### Mohamed — Auth & Frontend Wiring

| Task | Branch | Deliverable |
|------|--------|-------------|
| Frontend cleanup — delete dead code | `chore/REF-04-remove-dead-code` | Remove Calendar, InterviewMode, CourseCard, unused components |
| Set up authentication pages | `feat/REF-07-fe-auth` | Build `/login` and `/signup` pages, protected route wrapper, logout button |
| Implement Auth endpoints (API role) | `feat/REF-06-auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, JWT middleware |
| Create the API client layer | `feat/REF-08-api-client` | `src/lib/api.ts` — typed API calls, auth headers, error handling |
| Set up React Query provider + hooks | same branch | `useJobs()`, `useJob(id)`, `useInbox()`, `useDashboardMetrics()` — fallback to sample data until API exists |
| Set up CI/CD — GitHub Actions | `chore/REF-09-cicd` | Lint + type check on PR to `develop` |

### Ahmed — Backend & Database Foundation

| Task | Branch | Deliverable |
|------|--------|-------------|
| Provision all Azure resources | `chore/REF-01-azure-infra` | Resource Group, PostgreSQL, Service Bus (6 queues), Blob Storage (3 containers), Key Vault (all secrets), AI Foundry workspace, Container Apps (API + Worker shells), Application Insights |
| Create DB schema + run migrations | `feat/REF-02-db-schema` | All 16 tables created per `DATABASE_SCHEMA.md`, migration files committed |
| Scaffold FastAPI API role | `feat/REF-05-api-scaffold` | Project structure, health check, CORS config, Pydantic base models |
| Scaffold Worker service | `feat/REF-03-worker-scaffold` | FastAPI worker entry point, Service Bus listener loop, health check |
| Deploy bare API + Worker | `chore/REF-01-azure-infra` | Both running on Container Apps, health checks passing |

### End of Phase 0 Checkpoint
- [ ] User can sign up, log in, see empty dashboard, log out
- [ ] Frontend makes real API calls (even if most return empty data)
- [ ] Database tables exist with correct schema
- [ ] All Azure services provisioned and connected
- [ ] Worker listening on Service Bus queues
- [ ] CI/CD pipeline running on PRs
- [ ] Both Mohamed and Ahmed can deploy independently

---

## Phase 1 — Job Pipeline (Week 2-3)

**Goal**: Users can add jobs and see them on the Kanban board with real data.

### Mohamed — Job Creation & Kanban

| Task | Branch | Deliverable |
|------|--------|-------------|
| Implement Jobs CRUD endpoints | `feat/REF-16-jobs-crud` | `GET /jobs`, `GET /jobs/{id}`, `POST /jobs`, `PATCH /jobs/{id}`, `DELETE /jobs/{id}` |
| Implement Service Bus publish helper | `feat/REF-17-queue-publish` | Utility: API creates `workflow_runs` row + publishes message |
| Wire `POST /jobs` to trigger job-parsing queue | same branch | Creating a job dispatches a parsing message |
| Wire frontend: Kanban → real API | `feat/REF-19-fe-jobs` | Replace `sampleJobs` with `useQuery`, wire create job URL input, drag-and-drop `PATCH` |
| Wire frontend: Job Detail header + status | `feat/REF-20-fe-job-detail` | Job detail page loads from API, status dropdown works |
| Wire frontend: workflow polling | `feat/REF-21-fe-polling` | After creating a job, frontend polls `GET /workflow-runs/{id}` until complete |
| Implement milestones endpoints | `feat/REF-36-fe-milestones` | `GET/PATCH /jobs/{id}/milestones` wired to ProgressTracker |

### Ahmed — AI Job Parsing & Contact Discovery

| Task | Branch | Deliverable |
|------|--------|-------------|
| Build Job Parsing AI workflow (AI Foundry) | `feat/REF-10-ai-job-parsing` | Prompt Flow: LinkedIn URL/HTML → structured job data |
| Build Company Research AI workflow | `feat/REF-11-ai-company-research` | Prompt Flow: company → insights + talking points |
| Build Contact Discovery AI workflow | `feat/REF-12-ai-contact-discovery` | Prompt Flow: job details → ranked contacts with confidence scores |
| Wire Worker: `job-parsing` queue consumer | `feat/REF-13-worker-job-parsing` | Worker picks up message → calls AI Foundry → writes parsed job to DB → updates `workflow_runs` |
| Wire Worker: `contact-discovery` queue consumer | `feat/REF-14-worker-contacts` | Worker picks up message → calls AI Foundry → writes contacts to DB |
| Implement `GET /workflow-runs/{id}` endpoint | `feat/REF-15-workflow-runs-api` | Frontend can poll workflow status |
| Activity logging in Worker | same branches | Every job mutation inserts an `activity_log` row |

### End of Phase 1 Checkpoint
- [ ] User pastes LinkedIn URL → job card appears on Kanban (parsed by AI)
- [ ] Kanban board shows real jobs from database
- [ ] Job Detail page loads real data
- [ ] Status changes and milestones persist
- [ ] Activity timeline shows real history
- [ ] Workflow polling shows progress in UI

---

## Phase 2 — Contact Discovery & Outreach (Week 3-4)

**Goal**: AI finds contacts for a job and generates personalized outreach messages.

### Ahmed — Outreach & Follow-Up AI

| Task | Branch | Deliverable |
|------|--------|-------------|
| Build Outreach Generation AI workflow | `feat/REF-22-ai-outreach` | Prompt Flow: job + contact + resume → personalized message drafts |
| Build Follow-Up Generation AI workflow | `feat/REF-23-ai-followup` | Prompt Flow: original outreach + context → follow-up draft |
| Wire Worker: `outreach-generation` queue consumer | `feat/REF-27-worker-remaining` | Worker processes outreach requests |
| Wire Worker: `follow-up-generation` queue consumer | same branch | Worker processes follow-up requests |

### Mohamed — Outreach & Follow-Up UI + API

| Task | Branch | Deliverable |
|------|--------|-------------|
| Implement Contacts endpoints | `feat/REF-18-contacts-api` | `GET /jobs/{id}/contacts`, `POST /jobs/{id}/contacts/discover` |
| Implement Outreach endpoints | `feat/REF-29-outreach-api` | `POST /jobs/{id}/outreach/generate`, `GET /jobs/{id}/outreach`, `PATCH /outreach/{id}` (mark sent) |
| Implement Follow-Up endpoints | `feat/REF-30-followup-api` | `GET /jobs/{id}/follow-up`, `POST /jobs/{id}/follow-up/generate`, `PATCH /jobs/{id}/follow-up` |
| Wire frontend: ContactDiscovery panel | `feat/REF-35-fe-job-detail-full` | Select contact → triggers outreach generation |
| Wire frontend: OutreachBuilder panel | same branch | Show AI message, edit, copy, mark sent |
| Wire frontend: FollowUpScheduler panel | same branch | Show scheduled follow-up, mark sent |

### End of Phase 2 Checkpoint
- [ ] User clicks "Discover Contacts" → AI returns suggested contacts
- [ ] User selects a contact → outreach is generated
- [ ] User can edit, regenerate, and mark outreach as sent
- [ ] Follow-up is auto-scheduled after outreach sent
- [ ] All milestones update automatically
- [ ] Async jobs don't block the UI

---

## Phase 3 — Pitch Deck, Flash Cards & Resume (Week 4-5)

**Goal**: AI-generated prep materials. Resume upload works.

### Mohamed — Pitch Deck & Flash Cards UI + API

| Task | Branch | Deliverable |
|------|--------|-------------|
| Implement Flash Cards endpoints | `feat/REF-31-flashcards-api` | `POST /jobs/{id}/flash-cards/generate`, `GET /jobs/{id}/flash-cards` |
| Implement Pitch Deck endpoints | `feat/REF-32-pitchdeck-api` | `POST /jobs/{id}/pitch-deck/generate`, `GET /jobs/{id}/pitch-deck` |
| Implement file upload (resume) | `feat/REF-34-resume-upload` | `POST /attachments` with file validation (type, size ≤ 10MB) |
| Implement Blob Storage pre-signed URL endpoint | `feat/REF-33-blob-urls` | `GET /files/{id}/download` returns pre-signed URL |
| Wire frontend: PitchDeckPanel | `feat/REF-35-fe-job-detail-full` | Generate button triggers AI → show progress → display result |
| Wire frontend: FlashCardsPanel | same branch | Generate button → interactive cards from real data |
| Build Resume page | `feat/REF-45-fe-placeholders` | `/resume` — upload, display current, download link |

### Ahmed — Prep Materials AI + Gamma

| Task | Branch | Deliverable |
|------|--------|-------------|
| Build Flash Card Generation AI workflow | `feat/REF-24-ai-flashcards` | Prompt Flow: job + company research → Q&A cards |
| Build Pitch Deck Content AI workflow | `feat/REF-25-ai-pitch-deck` | Prompt Flow: resume + job + company → structured slide content |
| Integrate Gamma API in Worker | `feat/REF-26-gamma-integration` | Worker sends AI output to Gamma → gets deck URL → stores in DB + Blob |
| Wire Worker: remaining queue consumers | `feat/REF-27-worker-remaining` | `flash-card-generation`, `pitch-deck-generation` consumers |
| Implement Blob Storage upload in Worker | `feat/REF-28-blob-worker` | Worker writes pitch deck PDFs, large AI outputs to Blob |

### End of Phase 3 Checkpoint
- [ ] Pitch deck generates and links to Gamma output
- [ ] Flash cards generate and are interactive
- [ ] Resume uploads and persists
- [ ] Resume text is extracted and available for AI context
- [ ] All prep materials are per-job and stored in database

---

## Phase 4 — Dashboard & Inbox (Week 5-6)

**Goal**: Dashboard shows real metrics. Inbox shows real notifications.

### Ahmed — Dashboard & Inbox Data Engine

| Task | Branch | Deliverable |
|------|--------|-------------|
| Implement Dashboard metrics computation | `feat/REF-38-dashboard-metrics` | `GET /dashboard` — daily_goal, metrics (coffee_chats, interviews), tasks summary — all computed from real DB |
| Implement Inbox actions computation | `feat/REF-39-inbox-engine` | `GET /inbox/actions` — priority action items computed from jobs/outreach/follow-up state |
| Inbox action execution endpoints | same branch | `PATCH /inbox/{id}/complete`, `PATCH /inbox/{id}/snooze` |

### Mohamed — Dashboard & Inbox Frontend

| Task | Branch | Deliverable |
|------|--------|-------------|
| Wire frontend: Dashboard — all cards | `feat/REF-43-fe-dashboard` | DailyGoalCard, MetricsCard, TasksCard, InboxPreview, JobsPreview → real API data |
| Wire frontend: Inbox — full functionality | `feat/REF-44-fe-inbox` | Action list, mark done, snooze, filter — all wired |
| Wire frontend: NotesAttachments + ActivityTimeline | `feat/REF-37-fe-notes-activity` | `GET/PATCH /jobs/{id}/notes`, `GET /jobs/{id}/activity` wired |

### End of Phase 4 Checkpoint
- [ ] Dashboard numbers reflect real user data
- [ ] Inbox shows real notifications based on user's pipeline state
- [ ] Inbox actions work (mark sent, open job, etc.)
- [ ] Empty states look good for new users

---

## Phase 5 — Polish & Production (Week 6-7)

**Goal**: Everything works reliably. Ready for real users.

### Both Mohamed & Ahmed

| Task | Branch | Owner |
|------|--------|-------|
| Error handling sweep | `fix/REF-48-error-states` | Both |
| Loading, empty, error states for every API call | same branch | Mohamed |
| Backend proper HTTP status codes + error messages | same branch | Ahmed |
| Add pagination to jobs list and inbox | `feat/REF-49-pagination` | Mohamed |
| Database query indexes (optimize slow queries) | `chore/REF-50-db-indexes` | Ahmed |
| Cache dashboard metrics (5-min TTL) | same branch | Ahmed |
| RLS policies verified: user A cannot see user B's data | `chore/REF-51-security` | Ahmed |
| All endpoints require authentication | same branch | Mohamed |
| File uploads validated (type, size limits) | same branch | Mohamed |
| CORS configured for production domain only | same branch | Ahmed |
| Rate limiting on auth endpoints | `feat/REF-42-rate-limiting` | Ahmed (max 10 attempts/min) |
| Set up Application Insights monitoring | `feat/REF-40-monitoring` | Ahmed |
| Custom metrics: `ai_workflow_duration_ms`, `ai_workflow_failed`, `jobs_created_count` | same branch | Ahmed |
| Alerting rules: 5xx > 5%, P95 > 3s, AI failure > 10% | same branch | Ahmed |
| Production deploy — backend | `chore/REF-41-deploy-prod` | Ahmed |
| Production deploy — frontend | `chore/REF-46-deploy-fe-prod` | Mohamed (Static Web Apps, custom domain) |
| Full CI/CD pipeline | `chore/REF-47-cicd-full` | Mohamed (lint → test → build → deploy → smoke) |
| End-to-end QA | — | Both (manual, all 7 AI pipelines + all pages) |
| Build placeholder pages | `feat/REF-45-fe-placeholders` | Mohamed (`/support`, `/settings` — "Coming in V2") |

### End of Phase 5 Checkpoint
- [ ] Complete flow works end-to-end with no hard-coded data
- [ ] No console errors in production build
- [ ] Monitoring is active and capturing errors
- [ ] CI/CD deploys automatically
- [ ] Product is ready for beta users

---

## Integration Points & Contracts

These are the moments where Ahmed and Mohamed's code touches. Defined on Day 1 so no one blocks:

| Contract | Agreed On | Used By |
|----------|-----------|---------|
| REST API spec (all endpoints, req/res shapes) | Day 1 | Mohamed builds endpoints + frontend against it; Ahmed's Worker writes to same DB |
| Database schema (`DATABASE_SCHEMA.md`) | Day 1 | Both read/write, but through different services |
| Service Bus message schema (JSON format per queue) | Day 1 | Mohamed's API publishes; Ahmed's Worker consumes |
| Workflow run lifecycle (`queued → running → completed/failed`) | Day 1 | Mohamed polls from frontend; Ahmed's Worker updates |
| Blob Storage path convention | Day 1 | Mohamed handles upload endpoints; Ahmed's Worker writes outputs |

---

## Task Assignment Summary

| Phase | Mohamed | Ahmed |
|-------|---------|-------|
| 0 | Auth pages, API scaffold, React Query hooks, CI/CD | All Azure infra, DB schema, Worker scaffold, deploy |
| 1 | Jobs CRUD API, Kanban wiring, Job Detail wiring, polling | Job Parsing AI, Company Research AI, Contact Discovery AI, Worker consumers |
| 2 | Contacts/Outreach/Follow-Up API + frontend wiring | Outreach AI, Follow-Up AI, Worker consumers |
| 3 | Flash Cards/Pitch Deck API, Resume upload, frontend wiring | Flash Cards AI, Pitch Deck AI, Gamma integration, Blob writes |
| 4 | Dashboard + Inbox frontend wiring | Dashboard metrics engine, Inbox actions engine |
| 5 | Both: Error handling, performance, security, QA, deployment |

---

## Critical Dependencies (What Blocks What)

```
Phase 0: Auth ──────────────────► Everything else
Phase 0: DB tables ─────────────► Everything else
Phase 0: Azure infra ───────────► All AI + Worker work
Phase 1: Job CRUD ──────────────► Phase 2 (contacts need a job)
Phase 1: Job Parsing AI ────────► Phase 1 (Kanban needs parsed data)
Phase 2: Contact Discovery ─────► Phase 2 (outreach needs a contact)
Phase 2: Outreach ──────────────► Phase 4 (inbox needs outreach state)
Phase 3: Resume upload ─────────► Phase 2 (outreach uses resume context, but can work without)
Phase 3: Pitch Deck ────────────► Independent (can be built anytime after Phase 1)
Phase 4: Dashboard ─────────────► Needs Phase 1-2 data to be meaningful
```

**The golden rule**: Phase 0 must be rock-solid before anything else starts. If auth, DB, or Azure infra is flaky, everything built on top will be painful.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI workflows take longer than expected | Ahmed starts with the 2 most critical (Job Parsing + Contact Discovery) in Week 2. Others can be simplified. |
| Azure provisioning issues | Ahmed does ALL infra in Week 1. Issues surface early. |
| API contract changes mid-project | Both devs use the shared spec. Any change = both agree + update. |
| Gamma API issues/limitations | Ahmed tests Gamma early in Week 4. Fallback: generate simple PDF without Gamma. |
| Frontend wiring slower than expected | All components already exist — just replacing `sampleJobs` with `useQuery`. |

---

## How to Handle Blockers

- If you're blocked on the other person's work, **build with mock data first** then swap in the real API when ready
- If an AI integration (Azure AI Foundry) isn't ready, **hardcode a sample response** and build the full UI flow — swapping in the real AI call is a 10-minute change
- If Gamma API isn't ready, **return a placeholder URL** and build the UI assuming it works
- Never wait. Always build forward with mocks.

---

## What's Explicitly NOT in V1

- ❌ Interview prep mode (postponed)
- ❌ Calendar / scheduling view (removed)
- ❌ Analytics / Databricks integration (V2)
- ❌ Team collaboration features (V2)
- ❌ Mobile app (V2)
- ❌ Payment / billing (V2)
- ❌ Admin panel (V2)

---

## Branch Reference (Quick Lookup)

| REF # | Branch | Owner | Phase |
|-------|--------|-------|-------|
| REF-01 | `chore/REF-01-azure-infra` | Ahmed | 0 |
| REF-02 | `feat/REF-02-db-schema` | Ahmed | 0 |
| REF-03 | `feat/REF-03-worker-scaffold` | Ahmed | 0 |
| REF-04 | `chore/REF-04-remove-dead-code` | Mohamed | 0 |
| REF-05 | `feat/REF-05-api-scaffold` | Ahmed | 0 |
| REF-06 | `feat/REF-06-auth` | Mohamed | 0 |
| REF-07 | `feat/REF-07-fe-auth` | Mohamed | 0 |
| REF-08 | `feat/REF-08-api-client` | Mohamed | 0 |
| REF-09 | `chore/REF-09-cicd` | Mohamed | 0 |
| REF-10 | `feat/REF-10-ai-job-parsing` | Ahmed | 1 |
| REF-11 | `feat/REF-11-ai-company-research` | Ahmed | 1 |
| REF-12 | `feat/REF-12-ai-contact-discovery` | Ahmed | 1 |
| REF-13 | `feat/REF-13-worker-job-parsing` | Ahmed | 1 |
| REF-14 | `feat/REF-14-worker-contacts` | Ahmed | 1 |
| REF-15 | `feat/REF-15-workflow-runs-api` | Ahmed | 1 |
| REF-16 | `feat/REF-16-jobs-crud` | Mohamed | 1 |
| REF-17 | `feat/REF-17-queue-publish` | Mohamed | 1 |
| REF-18 | `feat/REF-18-contacts-api` | Mohamed | 2 |
| REF-19 | `feat/REF-19-fe-jobs` | Mohamed | 1 |
| REF-20 | `feat/REF-20-fe-job-detail` | Mohamed | 1 |
| REF-21 | `feat/REF-21-fe-polling` | Mohamed | 1 |
| REF-22 | `feat/REF-22-ai-outreach` | Ahmed | 2 |
| REF-23 | `feat/REF-23-ai-followup` | Ahmed | 2 |
| REF-24 | `feat/REF-24-ai-flashcards` | Ahmed | 3 |
| REF-25 | `feat/REF-25-ai-pitch-deck` | Ahmed | 3 |
| REF-26 | `feat/REF-26-gamma-integration` | Ahmed | 3 |
| REF-27 | `feat/REF-27-worker-remaining` | Ahmed | 2-3 |
| REF-28 | `feat/REF-28-blob-worker` | Ahmed | 3 |
| REF-29 | `feat/REF-29-outreach-api` | Mohamed | 2 |
| REF-30 | `feat/REF-30-followup-api` | Mohamed | 2 |
| REF-31 | `feat/REF-31-flashcards-api` | Mohamed | 3 |
| REF-32 | `feat/REF-32-pitchdeck-api` | Mohamed | 3 |
| REF-33 | `feat/REF-33-blob-urls` | Mohamed | 3 |
| REF-34 | `feat/REF-34-resume-upload` | Mohamed | 3 |
| REF-35 | `feat/REF-35-fe-job-detail-full` | Mohamed | 2-3 |
| REF-36 | `feat/REF-36-fe-milestones` | Mohamed | 1 |
| REF-37 | `feat/REF-37-fe-notes-activity` | Mohamed | 4 |
| REF-38 | `feat/REF-38-dashboard-metrics` | Ahmed | 4 |
| REF-39 | `feat/REF-39-inbox-engine` | Ahmed | 4 |
| REF-40 | `feat/REF-40-monitoring` | Ahmed | 5 |
| REF-41 | `chore/REF-41-deploy-prod` | Ahmed | 5 |
| REF-42 | `feat/REF-42-rate-limiting` | Ahmed | 5 |
| REF-43 | `feat/REF-43-fe-dashboard` | Mohamed | 4 |
| REF-44 | `feat/REF-44-fe-inbox` | Mohamed | 4 |
| REF-45 | `feat/REF-45-fe-placeholders` | Mohamed | 3-5 |
| REF-46 | `chore/REF-46-deploy-fe-prod` | Mohamed | 5 |
| REF-47 | `chore/REF-47-cicd-full` | Mohamed | 5 |
| REF-48 | `fix/REF-48-error-states` | Both | 5 |
| REF-49 | `feat/REF-49-pagination` | Mohamed | 5 |
| REF-50 | `chore/REF-50-db-indexes` | Ahmed | 5 |
| REF-51 | `chore/REF-51-security` | Both | 5 |

---

*Last updated: 2026-02-27*
