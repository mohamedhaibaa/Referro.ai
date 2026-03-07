# Referro Foundation Pack

This document gives you a clean starting point for the repo, backend contract, environment setup, and collaboration workflow for Referro V1.

It is designed for your situation:
- frontend UI already exists in the Lovable GitHub repo
- you want Lovable to keep pushing frontend code safely
- backend, database, AI workflows, and file storage still need to be built cleanly
- two founders need to work in parallel without stepping on each other

---

## 1) Recommended repo structure

Use **one repo** with clear app boundaries.

```text
referro/
├─ frontend/                         # Lovable-managed React/Vite/TypeScript app
│  ├─ src/
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ pages/
│  │  ├─ features/
│  │  │  ├─ auth/
│  │  │  ├─ jobs/
│  │  │  ├─ contacts/
│  │  │  ├─ outreach/
│  │  │  ├─ dashboard/
│  │  │  ├─ inbox/
│  │  │  └─ resume/
│  │  ├─ lib/
│  │  │  ├─ api/                    # typed API client
│  │  │  │  ├─ client.ts
│  │  │  │  ├─ auth.ts
│  │  │  │  ├─ jobs.ts
│  │  │  │  ├─ contacts.ts
│  │  │  │  ├─ outreach.ts
│  │  │  │  ├─ dashboard.ts
│  │  │  │  └─ inbox.ts
│  │  │  ├─ query.ts                # React Query setup
│  │  │  ├─ env.ts                  # frontend env parsing
│  │  │  └─ utils.ts
│  │  ├─ hooks/
│  │  ├─ types/
│  │  └─ main.tsx
│  ├─ public/
│  ├─ package.json
│  └─ vite.config.ts
│
├─ backend/                          # FastAPI API service
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     ├─ router.py
│  │  │     ├─ auth.py
│  │  │     ├─ jobs.py
│  │  │     ├─ contacts.py
│  │  │     ├─ outreach.py
│  │  │     ├─ follow_up.py
│  │  │     ├─ flash_cards.py
│  │  │     ├─ pitch_deck.py
│  │  │     ├─ attachments.py
│  │  │     ├─ dashboard.py
│  │  │     ├─ inbox.py
│  │  │     ├─ notes.py
│  │  │     ├─ activity.py
│  │  │     └─ workflow_runs.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ security.py
│  │  │  ├─ logging.py
│  │  │  └─ errors.py
│  │  ├─ db/
│  │  │  ├─ session.py
│  │  │  ├─ base.py
│  │  │  └─ models/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  │  ├─ auth_service.py
│  │  │  ├─ job_service.py
│  │  │  ├─ workflow_service.py
│  │  │  ├─ queue_service.py
│  │  │  ├─ file_service.py
│  │  │  └─ dashboard_service.py
│  │  └─ dependencies/
│  ├─ migrations/
│  ├─ tests/
│  ├─ pyproject.toml
│  └─ Dockerfile
│
├─ worker/                           # async worker service
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ consumers/
│  │  │  ├─ job_parsing.py
│  │  │  ├─ contact_discovery.py
│  │  │  ├─ outreach_generation.py
│  │  │  ├─ follow_up_generation.py
│  │  │  ├─ flash_card_generation.py
│  │  │  └─ pitch_deck_generation.py
│  │  ├─ integrations/
│  │  │  ├─ ai_foundry.py
│  │  │  ├─ gamma.py
│  │  │  ├─ blob_storage.py
│  │  │  └─ service_bus.py
│  │  ├─ services/
│  │  │  └─ workflow_updates.py
│  │  └─ core/
│  ├─ tests/
│  ├─ pyproject.toml
│  └─ Dockerfile
│
├─ docs/
│  ├─ API_SPEC.md
│  ├─ DATABASE_SCHEMA.md
│  ├─ MESSAGE_SCHEMAS.md
│  ├─ WORKFLOW_LIFECYCLE.md
│  ├─ BLOB_PATHS.md
│  ├─ ENVIRONMENT_SETUP.md
│  ├─ GIT_WORKFLOW.md
│  ├─ DECISIONS.md
│  └─ RUNBOOK.md
│
├─ .github/
│  └─ workflows/
│     ├─ frontend-ci.yml
│     ├─ backend-ci.yml
│     ├─ worker-ci.yml
│     └─ deploy.yml
│
├─ .env.example
├─ docker-compose.local.yml
├─ Makefile
└─ README.md
```

### Why this is the cleanest setup

- `frontend/` stays isolated for Lovable pushes.
- `backend/` owns sync CRUD and auth.
- `worker/` owns async AI jobs.
- `docs/` becomes the single source of truth for contracts.
- CI can test each service independently.
- You avoid mixing UI generation with backend business logic.

---

## 2) Operating model for you and your co-founder

### Branch model

- `main` = production only
- `develop` = integration branch
- `feat/REF-XX-description`
- `chore/REF-XX-description`
- `fix/REF-XX-description`

### PR rules

- no direct push to `main`
- no direct push to `develop` without PR
- every PR needs one reviewer
- small PRs only
- frontend and backend contracts must be updated in `docs/` in the same PR if behavior changes

### Lovable rule

Lovable may keep pushing to `frontend/`, but:
- no secrets in frontend
- no direct AI calls from frontend
- no direct database logic in frontend
- no business rules duplicated in components
- all real data must come through the backend API

### Ownership rule

Your uploaded execution plan is right to split work by feature, not by layer, and to lock Day 1 contracts before coding starts. It also defines the repo workflow around `main`, `develop`, feature branches, small PRs, and shared contract docs. fileciteturn2file0L42-L79

---

## 3) Recommended REST API design

Use versioned endpoints from day one:

```text
/api/v1
```

### Core resource groups

- `/auth`
- `/jobs`
- `/workflow-runs`
- `/contacts`
- `/outreach`
- `/follow-up`
- `/flash-cards`
- `/pitch-deck`
- `/attachments`
- `/files`
- `/dashboard`
- `/inbox`
- `/notes`
- `/activity`

This aligns with the execution plan, which already defines auth endpoints, jobs CRUD, workflow polling, contact discovery, outreach, follow-up, flash cards, pitch decks, dashboard, inbox, notes, and activity as the main surface area of the product. fileciteturn2file0L126-L188 fileciteturn2file1L213-L323

### HTTP method rules

- `GET` = read
- `POST` = create or trigger async workflow
- `PATCH` = partial update
- `DELETE` = remove

### Response rules

Every success response should be predictable.

Example:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

Every error response should be predictable too.

```json
{
  "data": null,
  "meta": {
    "request_id": "req_123"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format."
      }
    ]
  }
}
```

### Status code rules

- `200` success
- `201` created
- `202` accepted for async workflow start
- `204` deleted / no content
- `400` bad request
- `401` unauthorized
- `403` forbidden
- `404` not found
- `409` conflict
- `422` validation error
- `429` rate limited
- `500` internal server error

The execution plan explicitly expects proper status codes, auth on all endpoints, file validation, rate limiting, security checks, and production-safe CORS before beta. fileciteturn2file1L297-L330

---

## 4) API contract starter template

Put this into `docs/API_SPEC.md`.

```md
# API Spec

Base URL: `/api/v1`
Authentication: Bearer JWT
Content-Type: `application/json`

## Conventions
- All protected endpoints require `Authorization: Bearer <token>`
- All timestamps are ISO 8601 UTC
- All IDs are UUID strings
- All list endpoints support pagination where relevant
- Async generation endpoints return `202 Accepted` with `workflow_run_id`

---

## POST /auth/register
Create a user account.

### Request
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "first_name": "Mohamed",
  "last_name": "Hiba"
}
```

### Responses
- `201 Created`
- `409 Conflict` if user exists
- `422 Unprocessable Entity` for validation errors

### Success body
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "Mohamed",
      "last_name": "Hiba"
    }
  },
  "meta": {},
  "error": null
}
```

---

## POST /auth/login
Log in and return access token.

### Request
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

### Responses
- `200 OK`
- `401 Unauthorized`

### Success body
```json
{
  "data": {
    "access_token": "jwt",
    "token_type": "Bearer",
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  },
  "meta": {},
  "error": null
}
```

---

## GET /jobs
Return current user's jobs.

### Query params
- `page`
- `page_size`
- `status`
- `search`

### Responses
- `200 OK`

### Success body
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Product Manager",
      "company": "Acme",
      "status": "applied",
      "source_url": "https://...",
      "created_at": "2026-03-07T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

---

## POST /jobs
Create a job and trigger async parsing.

### Request
```json
{
  "source_url": "https://www.linkedin.com/jobs/view/..."
}
```

### Responses
- `202 Accepted`
- `422 Unprocessable Entity`

### Success body
```json
{
  "data": {
    "job": {
      "id": "uuid",
      "status": "new",
      "source_url": "https://www.linkedin.com/jobs/view/..."
    },
    "workflow_run": {
      "id": "uuid",
      "type": "job-parsing",
      "status": "queued"
    }
  },
  "meta": {},
  "error": null
}
```

---

## GET /jobs/{job_id}
Return full job detail.

## PATCH /jobs/{job_id}
Update status, notes, milestones, or user-managed fields.

## DELETE /jobs/{job_id}
Delete a job.

---

## GET /workflow-runs/{workflow_run_id}
Return workflow status.

### Success body
```json
{
  "data": {
    "id": "uuid",
    "type": "job-parsing",
    "status": "running",
    "started_at": "2026-03-07T10:02:00Z",
    "completed_at": null,
    "error_message": null
  },
  "meta": {},
  "error": null
}
```

---

## GET /jobs/{job_id}/contacts
Return contacts for a job.

## POST /jobs/{job_id}/contacts/discover
Trigger AI contact discovery.

### Response
- `202 Accepted`

---

## GET /jobs/{job_id}/outreach
Return outreach drafts/history.

## POST /jobs/{job_id}/outreach/generate
Trigger outreach generation for selected contact.

### Request
```json
{
  "contact_id": "uuid"
}
```

### Response
- `202 Accepted`

---

## GET /jobs/{job_id}/follow-up
Return follow-up items.

## POST /jobs/{job_id}/follow-up/generate
Trigger follow-up generation.

### Request
```json
{
  "outreach_message_id": "uuid"
}
```

---

## POST /jobs/{job_id}/flash-cards/generate
Trigger flash-card generation.

## GET /jobs/{job_id}/flash-cards
Return generated flash cards.

---

## POST /jobs/{job_id}/pitch-deck/generate
Trigger pitch deck generation.

## GET /jobs/{job_id}/pitch-deck
Return generated pitch deck metadata and file links.

---

## POST /attachments
Upload a file reference.

### Notes
- validate type
- validate size
- store metadata in DB
- store actual file in blob storage

---

## GET /files/{file_id}/download
Return pre-signed download URL.

---

## GET /dashboard
Return dashboard metrics.

---

## GET /inbox/actions
Return inbox action items.

## PATCH /inbox/{action_id}/complete
Mark action complete.

## PATCH /inbox/{action_id}/snooze
Snooze action.

---

## GET /jobs/{job_id}/notes
## PATCH /jobs/{job_id}/notes
## GET /jobs/{job_id}/activity
```

Your execution plan already defines many of these exact endpoints and the workflow-run polling model, so this starter spec stays close to what you already mapped. fileciteturn2file0L111-L122 fileciteturn2file1L166-L188

---

## 5) Workflow contract starter template

Put this in `docs/WORKFLOW_LIFECYCLE.md`.

```md
# Workflow Lifecycle

Statuses:
- queued
- running
- completed
- failed

Rules:
- API creates workflow row with `queued`
- API publishes message to queue
- Worker moves to `running` when consumption starts
- Worker moves to `completed` when results are written successfully
- Worker moves to `failed` if processing breaks
- Worker always writes `error_message` on failure
- Frontend polls `GET /workflow-runs/{id}` until terminal state
```

This is directly consistent with the Day 1 contract and queue pattern in the execution plan. fileciteturn2file0L73-L77 fileciteturn2file1L111-L122

---

## 6) Service Bus message schemas starter

Put this in `docs/MESSAGE_SCHEMAS.md`.

```md
# Service Bus Message Schemas

## job-parsing
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "url": "https://..."
}
```

## contact-discovery
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid"
}
```

## outreach-generation
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "contact_id": "uuid"
}
```

## follow-up-generation
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "outreach_message_id": "uuid"
}
```

## flash-card-generation
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid"
}
```

## pitch-deck-generation
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid"
}
```
```

Those payloads match the queue definitions already listed in the execution plan. fileciteturn2file1L113-L122

---

## 7) Environment setup checklist

Put this in `docs/ENVIRONMENT_SETUP.md`.

### Local development

#### Shared prerequisites
- GitHub access for both founders
- Node.js LTS installed
- Python 3.12 installed
- Docker Desktop installed
- Azure CLI installed
- PostgreSQL client installed
- access to Lovable GitHub repo configured

#### Frontend local setup
- clone repo
- `cd frontend`
- copy `.env.example` to `.env.local`
- set `VITE_API_BASE_URL=http://localhost:8000/api/v1`
- install dependencies
- run frontend

#### Backend local setup
- `cd backend`
- create virtual environment
- install dependencies
- copy `.env.example` to `.env`
- configure DB URL
- configure JWT secret
- configure local blob / dev storage settings
- run migrations
- start API

#### Worker local setup
- `cd worker`
- create virtual environment
- install dependencies
- copy `.env.example` to `.env`
- configure DB URL
- configure Service Bus connection string
- configure AI Foundry credentials
- start worker

#### Local services
Use `docker-compose.local.yml` for:
- postgres
- optional redis cache
- local storage emulator if desired

### Staging environment
- dedicated staging database
- dedicated staging container apps
- dedicated staging blob storage
- dedicated staging service bus namespace
- separate JWT secret
- separate AI keys
- separate Gamma key
- branch deploy from `develop`

### Production environment
- production secrets only in Key Vault
- production frontend on Static Web Apps
- production backend and worker on Container Apps
- production DB with backups enabled
- monitoring enabled before beta
- CORS restricted to production domain
- auth rate limiting enabled

The execution plan makes Phase 0 the foundation and expects Azure resources, FastAPI scaffolding, worker scaffolding, CI, auth, and environment connection to be stable before the rest of the build. fileciteturn2file1L126-L159 fileciteturn2file1L361-L389

---

## 8) Environment variables starter

Put this in `.env.example`.

```env
# shared
APP_ENV=development
LOG_LEVEL=INFO

# frontend
VITE_API_BASE_URL=http://localhost:8000/api/v1

# backend
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/referro
JWT_SECRET_KEY=change_me
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=60
CORS_ALLOWED_ORIGINS=http://localhost:5173
BLOB_STORAGE_ACCOUNT=
BLOB_STORAGE_CONTAINER_RESUMES=resumes
BLOB_STORAGE_CONTAINER_EXPORTS=exports
BLOB_STORAGE_CONTAINER_AI_OUTPUTS=ai-outputs
SERVICE_BUS_CONNECTION_STRING=
AI_FOUNDRY_ENDPOINT=
AI_FOUNDRY_API_KEY=
GAMMA_API_KEY=
APPLICATION_INSIGHTS_CONNECTION_STRING=

# worker
WORKER_POLL_INTERVAL_SECONDS=2
JOB_PARSING_QUEUE=job-parsing
CONTACT_DISCOVERY_QUEUE=contact-discovery
OUTREACH_GENERATION_QUEUE=outreach-generation
FOLLOW_UP_GENERATION_QUEUE=follow-up-generation
FLASH_CARD_GENERATION_QUEUE=flash-card-generation
PITCH_DECK_GENERATION_QUEUE=pitch-deck-generation
```

---

## 9) Frontend integration rules

Your frontend should not call random fetches everywhere.

Use this pattern:

### `frontend/src/lib/api/client.ts`
- shared fetch wrapper
- inject auth token
- parse error responses consistently
- central timeout / retry policy

### `frontend/src/lib/api/*.ts`
- one file per resource
- typed request/response functions

### React Query
- `useJobs()`
- `useJob(jobId)`
- `useWorkflowRun(id)`
- `useContacts(jobId)`
- `useOutreach(jobId)`
- `useDashboard()`
- `useInboxActions()`

This matches the execution plan's expectation of a typed API client plus React Query hooks as part of Phase 0. fileciteturn2file0L130-L139

---

## 10) Suggested first-week implementation order

### Day 1
- lock API spec
- lock DB schema
- lock queue payloads
- lock workflow lifecycle
- lock blob path convention
- create `docs/` files

### Day 2
- scaffold backend FastAPI app
- scaffold worker app
- add health checks
- add basic auth endpoints
- add frontend API client layer

### Day 3
- provision local DB and run migrations
- wire login/signup frontend to real auth endpoints
- remove sample auth assumptions

### Day 4
- implement `GET /jobs`, `POST /jobs`, `GET /workflow-runs/{id}`
- wire job creation flow from frontend

### Day 5
- add queue publisher
- add worker consumer for `job-parsing`
- verify end-to-end local flow

This order mirrors the foundation-first dependency model in the execution plan. fileciteturn2file1L361-L376

---

## 11) Final recommendation for your exact situation

Because Lovable is already generating your UI and pushing to GitHub, the most reliable approach is:

- keep the Lovable frontend inside `frontend/`
- do not rebuild the UI from scratch
- use FastAPI as the backend API role
- use a separate worker for async AI tasks
- use PostgreSQL as the source of truth
- use REST contracts and docs before feature work starts
- treat `docs/API_SPEC.md`, `DATABASE_SCHEMA.md`, and `MESSAGE_SCHEMAS.md` as locked contracts

That is also the direction your uploaded execution plan is already pushing toward: React/Vite frontend, FastAPI API role, separate worker role, PostgreSQL, Service Bus, Blob Storage, workflow polling, and strong Day 1 contracts. fileciteturn2file0L71-L97 fileciteturn2file1L334-L357

