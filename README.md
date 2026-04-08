# Referoo V1

AI-powered job outreach and networking tool.

---

## What this is

Referoo helps job seekers find the right contacts at target companies, generate personalized outreach messages, track their pipeline, and prepare for conversations — all powered by AI.

---

## Repo structure

```
referoo/
├── frontend/       React + Vite + TypeScript (Lovable-generated UI)
├── backend/        FastAPI — REST API, auth, CRUD, queue publishing
├── worker/         Async worker — consumes Service Bus queues, runs AI flows
├── docs/           All contracts and specs (read these first)
├── .github/        CI workflows (lint, typecheck, test on every PR)
├── .env.example    Template for all environment variables
├── docker-compose.local.yml  Local Postgres for development
└── Makefile        Shortcuts for common commands
```

---

## Read these docs first

Before writing any code, both founders must read and agree on:

| Doc | What it covers |
|-----|----------------|
| [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) | Full 6-week build plan, phase breakdown, who owns what |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Every endpoint, request/response shape, status codes |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | All 16 tables, columns, indexes, RLS policies |
| [docs/MESSAGE_SCHEMAS.md](docs/MESSAGE_SCHEMAS.md) | JSON payloads for all 6 Service Bus queues |
| [docs/WORKFLOW_LIFECYCLE.md](docs/WORKFLOW_LIFECYCLE.md) | How async AI jobs flow from queued to completed |
| [docs/BLOB_PATHS.md](docs/BLOB_PATHS.md) | File storage path conventions |
| [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) | Branch model, PR rules, commit format |
| [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) | Step-by-step local setup for both services |

---

## Quick start (local development)

### Prerequisites
- Node.js LTS
- Python 3.12
- Docker Desktop

### 1. Clone and start Postgres

```bash
git clone https://github.com/mohamedhaibaa/Referoo.ai.git
cd Referoo.ai
git checkout develop
make up
```

### 2. Backend (API)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../.env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
# Running at http://localhost:8000
```

### 3. Worker

```bash
cd worker
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../.env.example .env
# Edit .env — set DATABASE_URL and SERVICE_BUS_CONNECTION_STRING
python -m app.main
```

### 4. Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
# Running at http://localhost:5173
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Query |
| Backend API | Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Worker | Python 3.12, Azure Service Bus SDK |
| AI | Azure AI Foundry (7 prompt flows) |
| File storage | Azure Blob Storage |
| Hosting | Azure Container Apps (API + Worker), Azure Static Web Apps (frontend) |
| Database | Azure Database for PostgreSQL (Flexible Server) |
| Secrets | Azure Key Vault |
| Monitoring | Azure Application Insights |

---

## Work split

| Phase | Mohamed | Ahmed |
|-------|---------|-------|
| 0 — Foundation | Auth pages, API scaffold, React Query hooks, CI | All Azure infra, DB schema, Worker scaffold, deploy |
| 1 — Job Pipeline | Jobs CRUD API, Kanban wiring, Job Detail wiring | Job Parsing AI, Company Research AI, Contact Discovery AI |
| 2 — Outreach | Contacts/Outreach/Follow-Up API + frontend | Outreach AI, Follow-Up AI, Worker consumers |
| 3 — Prep Materials | Flash Cards/Pitch Deck API, Resume upload | Flash Cards AI, Pitch Deck AI, Gamma integration |
| 4 — Dashboard & Inbox | Dashboard + Inbox frontend wiring | Dashboard metrics engine, Inbox actions engine |
| 5 — Polish | Error handling, security, QA, deployment (both) | |

---

## Key rules

- Do not push directly to `main` or `develop`
- Every PR needs 1 approval
- If you change an API endpoint, queue payload, or DB table — update the relevant `docs/` file in the same PR
- No secrets in code — all secrets go in `.env` (local) or Azure Key Vault (staging/prod)
- Frontend never calls AI directly — all AI goes through the backend + worker
