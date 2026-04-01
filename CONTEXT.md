# CONTEXT.md — Referoo.ai Project State

> **Current state of every feature, every endpoint, every component.** Check here before building anything to understand what exists.

---

## Project Summary

Referoo is an AI-powered job outreach platform. Users add job URLs → AI parses them → AI discovers contacts → AI generates personalized outreach → users track their pipeline on a kanban board → AI helps with interview prep (flash cards, pitch decks).

**Target users:** Job seekers (students, career changers, professionals)
**Business model:** SaaS (freemium planned)
**Current status:** ~50% MVP. Auth + job CRUD + parsing + dashboard working. AI workflows for contacts/outreach/prep are scaffolded but not implemented.

---

## Feature Status Matrix

### ✅ Fully Working

| Feature | Backend | Frontend | Worker | Notes |
|---------|---------|----------|--------|-------|
| User registration | `auth.py` POST /register | `Signup.tsx` | — | Email + password + name, returns JWT |
| User login | `auth.py` POST /login | `Login.tsx` | — | Returns JWT, stored in localStorage |
| User logout | `auth.py` POST /logout | `AuthContext.tsx` | — | Stateless, clears localStorage |
| Protected routes | `deps.py` get_current_user | `ProtectedRoute.tsx` | — | JWT validation, 401 redirect |
| Create job | `jobs.py` POST /jobs | `KanbanBoard.tsx` | `job_parsing.py` | Creates job + milestone + workflow, triggers parse |
| List jobs | `jobs.py` GET /jobs | `useJobs` hook | — | Filtered by user, supports pagination |
| Get job detail | `jobs.py` GET /jobs/{id} | `JobDetail.tsx` | — | Full job object |
| Update job | `jobs.py` PATCH /jobs/{id} | `useUpdateJob` | — | Status, title, company, fit, mode, role, due date |
| Delete job | `jobs.py` DELETE /jobs/{id} | `useDeleteJob` | — | Soft delete (is_deleted=true) |
| Job milestones | `jobs.py` | `ProgressTracker.tsx` | — | 10 boolean checkpoints, progress computed |
| Job parsing | `jobs.py` → queue | — | `job_parsing.py` | Scrapes URL, calls AI Foundry, updates job |
| Dashboard metrics | `dashboard.py` GET /dashboard | `Index.tsx` | — | Total jobs, by status, outreach, meetings, offers |
| Workflow polling | `workflow_runs.py` GET | `useWorkflowRun` | — | Polls every 2s until completed/failed |
| Kanban board | — | `KanbanBoard.tsx` | — | 8 columns, drag-drop, status updates |
| Database schema | 16 tables, all migrated | — | — | Full schema with indexes and constraints |

### 🟡 Partially Implemented (UI exists, backend is stub)

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Contact discovery | GET endpoint (returns empty), POST stub, `ContactDiscovery.tsx` | AI prompt, worker implementation, queue publishing |
| Outreach generation | GET/POST stubs, `OutreachBuilder.tsx` | AI prompt, worker, queue, message CRUD |
| Follow-up management | GET/POST/PATCH stubs, `FollowUpScheduler.tsx` | AI prompt, worker, queue, date logic |
| Flash cards | GET/POST stubs, `FlashCardsPanel.tsx` | AI prompt, worker, queue, card CRUD |
| Pitch deck | GET/POST stubs, `PitchDeckPanel.tsx` | AI prompt, worker, Gamma API integration |
| File upload | POST /attachments stub, `NotesAttachments.tsx` | Blob Storage integration, metadata storage |
| Notes | GET/PATCH stubs, `NotesAttachments.tsx` | Backend CRUD implementation |
| Activity log | GET stub, `ActivityTimeline.tsx` | Backend query, event insertion on mutations |
| Outcome recording | DB model exists, `OutcomeSection.tsx` | Backend CRUD, status side effects |
| Inbox | GET stub, `InboxPreview.tsx` | Server-side generation (currently client-side workaround) |

### ❌ Not Started

| Feature | Description |
|---------|-------------|
| Email integration | Send outreach via email, track opens/clicks |
| Calendar sync | Sync follow-up dates to Google Calendar |
| Resume parsing | Extract skills/experience from uploaded resume for AI context |
| Analytics/reporting | Custom date ranges, success metrics, CSV/PDF export |
| Rate limiting | Prevent API abuse (10 jobs/min, 100 AI calls/day) |
| WebSocket/SSE | Replace polling with real-time updates |
| Error boundaries | React error boundaries for graceful degradation |
| Retry logic | Exponential backoff for failed async jobs |
| App Insights | Azure monitoring integration (env var exists, unused) |
| Dockerfiles | Backend and worker containerization |
| Deploy pipeline | CI/CD from main → Azure Container Apps |

---

## Tech Debt & Known Issues

### Critical (blocks features)
1. **5 of 6 worker consumers are stubs** — No AI workflows beyond job parsing
2. **No Blob Storage integration** — Can't upload resumes or download files
3. **No input validation on most endpoints** — Pydantic models defined but not applied

### Important (quality/security)
4. **TypeScript strict mode is OFF** — `strict: false`, `noImplicitAny: false`
5. **No tests written** — pytest infrastructure exists, 0 test files
6. **No rate limiting** — API endpoints unprotected
7. **No error boundaries** — Unhandled React errors crash the page
8. **Frontend-generated inbox** — Loses state on refresh, not persistent

### Minor (polish)
9. **Polling not WebSocket** — 2s polling for workflow status
10. **Hard-coded magic numbers** — Poll interval, token expiry, file size limits
11. **No audit logging** — No App Insights, no request tracing
12. **Computed fields on frontend** — `hasSelectedContact` etc. should come from DB

---

## Environment Variables Reference

### Frontend (`frontend/.env.local`)
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/referoo
JWT_SECRET_KEY=<random-32-char-string>
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=60
CORS_ALLOWED_ORIGINS=http://localhost:5173
SERVICE_BUS_CONNECTION_STRING=<azure-connection-string>
AI_FOUNDRY_ENDPOINT=<azure-ai-endpoint>
AI_FOUNDRY_API_KEY=<azure-ai-key>
BLOB_STORAGE_ACCOUNT=<azure-storage-account>
GAMMA_API_KEY=<gamma-api-key>
APPLICATION_INSIGHTS_CONNECTION_STRING=<optional>
```

### Worker (`worker/.env`)
```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/referoo
SERVICE_BUS_CONNECTION_STRING=<azure-connection-string>
AI_FOUNDRY_ENDPOINT=<azure-ai-endpoint>
AI_FOUNDRY_API_KEY=<azure-ai-key>
SCRAPINGDOG_API_KEY=<optional>
```

---

## Execution Plan (Phased)

### Phase 2 — Next Sprint (Contact Discovery + Outreach)
1. Implement contact discovery worker consumer + AI prompt
2. Wire up POST /contacts/discover to publish to queue
3. Implement GET /contacts to return from DB
4. Implement outreach generation worker + AI prompt
5. Wire up POST /outreach/generate to publish to queue
6. Implement GET/PATCH /outreach for message CRUD
7. Connect frontend components to live endpoints

### Phase 3 — Follow-up + Interview Prep
1. Follow-up worker + AI prompt
2. Flash cards worker + AI prompt
3. Resume upload + Blob Storage integration
4. Move inbox generation to server-side

### Phase 4 — Polish
1. Error handling across all endpoints
2. Input validation (Zod frontend, Pydantic backend)
3. Test coverage (>80% critical paths)
4. Performance optimization

### Phase 5 — Advanced Features
1. Pitch deck generation (Gamma API)
2. Email integration
3. Calendar sync
4. Analytics dashboard

---

## Docs Available

All in `/docs/`:
- `API_SPEC.md` — Full endpoint specification with request/response examples
- `DATABASE_SCHEMA.md` — All 16 tables, columns, indexes, constraints
- `MESSAGE_SCHEMAS.md` — 6 Service Bus queue payload schemas
- `WORKFLOW_LIFECYCLE.md` — Async job state machine
- `BLOB_PATHS.md` — Azure Blob Storage path conventions
- `GIT_WORKFLOW.md` — Branch model, PR rules, commit format
- `ENVIRONMENT_SETUP.md` — Local setup steps
- `EXECUTION_PLAN.md` — 6-week build plan
- `BACKEND_HANDOVER.md` — Backend architecture patterns
- `FOUNDATION_PACK.md` — Core foundation components
- `JOB_CARD_FLOW.md` — Job detail page flows
- `WEBSITE_BLUEPRINT.md` — Frontend wireframes
- `TECH_STACK.md` — Detailed tech stack info
- `API_GUIDE.md` — API usage with Swagger
