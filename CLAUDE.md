# CLAUDE.md — Referoo.ai

> **Read this file first on every task. It is the single source of truth for how to work in this codebase.**

---

## Identity

**Project:** Referoo V1 — AI-powered job outreach and networking platform
**Stack:** React 18 + Vite 5 + TypeScript 5.8 (frontend) · FastAPI + SQLAlchemy 2 + Alembic (backend) · Python async worker · PostgreSQL 16 · Azure Service Bus · Azure AI Foundry (gpt-4o-mini)
**Repo layout:** Monorepo — `/frontend`, `/backend`, `/worker`, `/docs`

---

## Before You Write Any Code

1. **Read `CONTEXT.md`** — Understand what exists, what's stubbed, what's planned.
2. **Read `SKILLS.md`** — Follow the exact patterns for the layer you're touching.
3. **Read `MEMORY.md`** — Check for decisions, gotchas, and lessons from past sessions.
4. **Read `AGENT.md`** — Understand your working process: ask questions, suggest, confirm.

---

## Golden Rules

### 1. Never Break What Works
Auth, job CRUD, job parsing, dashboard, kanban board, and workflow polling are **production-ready**. Do not refactor these unless explicitly asked. If your change touches these areas, verify they still work.

### 2. Response Envelope — Always
Every backend endpoint returns:
```json
{ "data": {}, "meta": {}, "error": null }
```
No exceptions. Even errors use this shape with `"data": null`.

### 3. User Ownership — Always
Every database query filters by `user_id == current_user.id`. Every job query also filters `is_deleted == False`. No exceptions. This is a security requirement.

### 4. Async Jobs Follow the Lifecycle
```
API: Create WorkflowRun (queued) → Publish to Service Bus → Return 202
Worker: Update to running → Do work → Update to completed/failed
Frontend: Poll /workflow-runs/{id} every 2s → Stop on terminal status
```
Never skip steps. Never go backwards.

### 5. Frontend State Comes From the Server
After any mutation, invalidate the relevant React Query cache. The database is the source of truth. Frontend-computed fields are temporary workarounds.

### 6. Secrets Stay in .env
Never hardcode API keys, database URLs, or JWT secrets. Use `settings.VARIABLE_NAME` in Python, `import.meta.env.VITE_*` in frontend.

---

## Architecture at a Glance

```
User → React SPA (Vite, port 5173)
         ↓ HTTP (Bearer JWT)
       FastAPI REST API (port 8000, /api/v1)
         ↓ SQLAlchemy          ↓ Azure Service Bus
       PostgreSQL 16        Worker (async Python)
                              ↓ AI Foundry / Gamma / Blob Storage
```

**Three services, three terminals:**
- `make frontend` → Vite dev server at :5173
- `make backend` → FastAPI at :8000
- `make worker` → Service Bus consumers

---

## File Conventions

| What | Where | Naming |
|------|-------|--------|
| React pages | `frontend/src/pages/` | PascalCase.tsx |
| React components | `frontend/src/components/{feature}/` | PascalCase.tsx |
| UI primitives | `frontend/src/components/ui/` | lowercase.tsx (shadcn) |
| React hooks | `frontend/src/hooks/` | use{Name}.ts |
| API client functions | `frontend/src/lib/api/` | camelCase.ts |
| Type definitions | `frontend/src/types/` | camelCase.ts |
| Backend routes | `backend/app/api/v1/` | snake_case.py |
| Backend models | `backend/app/db/models/` | snake_case.py |
| Worker consumers | `worker/app/consumers/` | snake_case.py |
| Worker prompts | `worker/app/prompts/` | snake_case.py |
| Worker integrations | `worker/app/integrations/` | snake_case.py |

**Do not** edit files in `frontend/src/components/ui/` — these are shadcn-managed.
**Do not** edit existing Alembic migrations — create new ones.

---

## Commands

```bash
# Setup
make install                    # Install all deps
docker-compose -f docker-compose.local.yml up -d  # Start Postgres (port 5433)
make migrate                    # Run alembic upgrade head

# Development
make frontend                   # Vite dev :5173
make backend                    # FastAPI :8000
make worker                     # Service Bus consumers

# Quality
npm run lint                    # ESLint (frontend)
npx tsc --noEmit                # TypeScript check (frontend)
cd backend && pytest tests/     # Backend tests

# Database
cd backend && alembic revision --autogenerate -m "description"
cd backend && alembic upgrade head
cd backend && alembic downgrade -1
```

---

## Database Quick Reference

**16 tables** — `users`, `jobs`, `job_milestones`, `contacts`, `outreach_messages`, `follow_ups`, `notes`, `tags`, `job_tags`, `activity_log`, `pitch_decks`, `flash_cards`, `outcomes`, `resumes`, `inbox_items`, `workflow_runs`

**Key relationships:**
- `jobs.user_id → users.id` (all tables have user_id for ownership)
- `job_milestones.job_id → jobs.id` (one-to-one, 10 boolean checkpoints)
- `contacts.job_id → jobs.id` (one-to-many)
- `outreach_messages.contact_id → contacts.id`
- `workflow_runs.job_id → jobs.id` (nullable for standalone workflows)

**Job status flow:** Interested → Outreach Ready → Outreach Sent → Replied → Meeting Booked → Interviewing → Offer → Closed

**Progress formula:** `count(true milestones in job_milestones) / 10 × 100`

---

## Service Bus Queues (6)

| Queue | Publisher | Consumer | Status |
|-------|-----------|----------|--------|
| `job-parsing` | `backend/services/queue.py` | `worker/consumers/job_parsing.py` | ✅ Working |
| `contact-discovery` | `backend/services/queue.py` | `worker/consumers/contact_discovery.py` | ✅ Working |
| `outreach-generation` | Stub | Stub | ❌ TODO |
| `follow-up-generation` | Stub | Stub | ❌ TODO |
| `flash-card-generation` | Stub | Stub | ❌ TODO |
| `pitch-deck-generation` | Stub | Stub | ❌ TODO |

Queue names are **kebab-case** and **case-sensitive**. Must match exactly between publisher and consumer.

---

## Third-Party Tool Integrations

**Before connecting any external tool/API/actor, always read its documentation first to get the exact parameter names. Never assume or make up parameter names — use only what the docs confirm.**

Examples of what went wrong: `maxPosts` (wrong) → `maxResults`; `searchKeywords` (wrong) → `titleKeywords`. Both were silently ignored, causing incorrect behavior.

---

## What NOT To Do

- Don't use cookies for auth — JWT in Authorization header only
- Don't hardcode `localhost:8000` — use `VITE_API_BASE_URL`
- Don't write raw SQL — use SQLAlchemy ORM
- Don't use `any` types in new TypeScript code — define interfaces
- Don't use Redux or Zustand — we use React Query + Context
- Don't use synchronous blocking calls in the worker — async/await only
- Don't edit shadcn/ui components directly — extend in new files
- Don't edit old Alembic migrations — create new ones
- Don't commit .env files — use .env.example as template
- Don't skip the WorkflowRun lifecycle steps
- Don't use `isolation_level="AUTOCOMMIT"` in workers — rollback() becomes a no-op
- Don't assume third-party API output schemas — log raw keys and verify before writing extraction logic
- Don't construct LinkedIn company URLs from company name slugs — extract from HTML or use harvestapi/linkedin-company with domain validation
- Don't store display-layer fields (confidence, relationship labels) in the DB — compute them in the API serializer
- Don't forget to renew Service Bus message locks in long-running workers (use `_renew_lock_periodically`)

## Worker Patterns

- Every new consumer must follow: `queued → running → completed/failed` lifecycle
- Every consumer that calls external APIs must renew its Service Bus lock every 30s
- Always log raw AI responses before `json.loads()` — strip markdown fences before parsing
- Delete stale records before inserting new ones (e.g. contacts) to prevent duplicates on re-runs
- Use `python3.12` explicitly when creating venvs — `python3` defaults to 3.9 on this machine

---

## End-of-Ticket Documentation (Required)

At the end of every ticket, before committing:
1. Scan all files in `docs/` to check if the work relates to an existing doc (e.g. `DATABASE_SCHEMA.md`, `WORKFLOW_LIFECYCLE.md`)
2. If a related file exists — update it
3. If no related file exists — create a new file in `docs/` or `docs/learnings/` describing what was built, how it works, and key decisions
4. Commit the docs alongside the code in the same commit

---

## When in Doubt

1. Check `docs/` — there are 14 detailed spec documents
2. Follow the existing pattern in `backend/app/api/v1/jobs.py` (the most complete endpoint)
3. Follow the existing pattern in `worker/app/consumers/job_parsing.py` (the only working consumer)
4. Ask the developer — use the process in `AGENT.md`
