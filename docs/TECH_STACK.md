# Referro V1 — Tech Stack & Architecture Handover

> **Version:** 1.0  
> **Date:** February 2025  
> **Author:** Mohamed Hiba  
> **Purpose:** Complete technical reference for the Referro engineering team — covers every service, how they connect, frontend-to-backend integration points, and GitHub collaboration rules.

---

## Table of Contents

1. [Product Context](#1-product-context)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack Breakdown](#3-tech-stack-breakdown)
4. [End-to-End Data Flow](#4-end-to-end-data-flow)
5. [Frontend → Backend Integration Map](#5-frontend--backend-integration-map)
6. [Current Frontend State (What Exists Today)](#6-current-frontend-state-what-exists-today)
7. [What Backend Must Replace](#7-what-backend-must-replace)
8. [GitHub Workflow & Collaboration Rules](#8-github-workflow--collaboration-rules)
9. [Environment & Deployment](#9-environment--deployment)
10. [Security & Secrets](#10-security--secrets)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Future Considerations (Post-V1)](#12-future-considerations-post-v1)

---

## 1. Product Context

### What Referro Is
Referro is an **AI-powered outreach and networking tool** for job seekers. It does NOT help users search or discover jobs. Instead, users paste a LinkedIn job URL, and Referro:

1. Parses the job posting automatically
2. Discovers relevant contacts at the target company
3. Generates personalized outreach messages
4. Prepares users for coffee chats (pitch decks, flash cards)
5. Manages follow-ups and tracks outreach progress

### What Referro Is NOT
- ❌ Not a job board or job search engine
- ❌ Not a generic project management / kanban tool (the board is a visualization aid only)
- ❌ Not an interview prep tool (postponed to V2)
- ❌ Not a calendar/scheduling app (removed from scope)

### Active Pages in V1
| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Daily goals, metrics, inbox preview, jobs preview |
| Inbox | `/inbox` | AI-generated action items grouped by priority |
| Jobs (Kanban) | `/jobs` | Kanban board + list view of all job cards |
| Job Detail | `/job/:id` | Full outreach workflow for a single job |

### Removed / Postponed Features
| Feature | Status | Notes |
|---------|--------|-------|
| Calendar page (`/calendar`) | **Removed** | Was at route `/calendar`, still in codebase but unused — should be deleted |
| Interview Prep / Interview Mode | **Postponed to V2** | Component exists (`InterviewMode.tsx`) but conditionally rendered |
| Fit Score / Work Mode / Role Family filters | **Removed** | Stripped from kanban cards and filter panel |
| Manual job creation (form-based) | **Not planned** | Users add jobs by pasting LinkedIn URLs only |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         Frontend (Next.js + TypeScript)                   │  │
│  │         Hosted on Azure Static Web Apps                   │  │
│  └───────────────────────┬───────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTPS (REST API)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Azure Container Apps                           │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │  FastAPI — API Role  │    │  FastAPI — Worker Role         │ │
│  │  (sync requests)     │    │  (async AI jobs)               │ │
│  │                      │    │                                │ │
│  │  • Auth verification │    │  • Listens to Service Bus      │ │
│  │  • CRUD operations   │    │  • Calls AI Foundry            │ │
│  │  • Job creation      │    │  • Calls Gamma API             │ │
│  │  • Queue dispatch    │    │  • Writes results to DB + Blob │ │
│  └──────────┬───────────┘    └──────────┬─────────────────────┘ │
└─────────────┼───────────────────────────┼───────────────────────┘
              │                           │
    ┌─────────┼───────────────────────────┼─────────┐
    │         ▼                           ▼         │
    │  ┌─────────────┐   ┌──────────────────────┐   │
    │  │  PostgreSQL  │   │  Azure Blob Storage  │   │
    │  │  (Azure DB)  │   │  (files/exports)     │   │
    │  └─────────────┘   └──────────────────────┘   │
    │                                               │
    │  ┌─────────────┐   ┌──────────────────────┐   │
    │  │ Service Bus  │   │  Azure AI Foundry    │   │
    │  │ (job queue)  │   │  (Prompt Flow/Agents)│   │
    │  └─────────────┘   └──────────────────────┘   │
    │                                               │
    │  ┌─────────────┐   ┌──────────────────────┐   │
    │  │  Key Vault   │   │  App Insights        │   │
    │  │ (secrets)    │   │  (monitoring)        │   │
    │  └─────────────┘   └──────────────────────┘   │
    │                                               │
    │  ┌─────────────┐                              │
    │  │  Gamma API   │                              │
    │  │ (pitch decks)│                              │
    │  └─────────────┘                              │
    └───────────────────────────────────────────────┘
```

---

## 3. Tech Stack Breakdown

### 3.1 Frontend

| Aspect | Technology | Details |
|--------|-----------|---------|
| **Framework** | Next.js + TypeScript | Currently built with React + Vite in Lovable; will be migrated to Next.js for production |
| **Styling** | Tailwind CSS + shadcn/ui | Design system with semantic tokens (HSL-based), dark mode support |
| **State Management** | React Query (`@tanstack/react-query`) + React `useState` | React Query for server state, local state for UI |
| **Routing** | React Router (current) → Next.js App Router (production) | Current: `react-router-dom` with client-side routing |
| **Hosting** | Azure Static Web Apps | CDN-backed, auto-SSL, custom domain support |

**Current Frontend Libraries (from `package.json`):**
- `react-router-dom` — routing
- `@tanstack/react-query` — async state
- `lucide-react` — icons
- `date-fns` — date formatting
- `recharts` — charts (dashboard metrics)
- `sonner` — toast notifications
- `zod` — schema validation
- `react-hook-form` — form handling
- `vaul` — drawer component
- `cmdk` — command palette
- `embla-carousel-react` — carousels
- Full Radix UI primitive suite (dialog, dropdown, popover, tabs, etc.)

**Migration Note (Lovable → Next.js):**
- Current codebase uses Vite + React Router — needs migration to Next.js App Router
- All components, hooks, and styles are portable (no Vite-specific APIs used)
- `react-router-dom` routes map 1:1 to Next.js file-based routes
- `@tanstack/react-query` works identically in Next.js

### 3.2 Backend — FastAPI (Python)

| Aspect | Details |
|--------|---------|
| **Role** | Central product engine — handles all API requests, auth, DB access, AI orchestration |
| **Language** | Python 3.11+ |
| **Framework** | FastAPI (async-first, OpenAPI docs auto-generated) |
| **Deployment** | Two container instances on Azure Container Apps |

**Two Deployment Roles (same codebase):**

| Role | Purpose | Scaling |
|------|---------|---------|
| **API Service** | Handles synchronous HTTP requests from frontend (CRUD, auth, reads) | Scales on HTTP traffic |
| **Worker Service** | Consumes messages from Azure Service Bus, runs AI workflows | Scales on queue depth |

**Key Backend Responsibilities:**
1. **Authentication** — Verify JWT tokens, manage sessions
2. **Job CRUD** — Create jobs from LinkedIn URLs, update status, delete
3. **Contact Discovery** — Trigger AI workflow → save discovered contacts
4. **Outreach Generation** — Trigger AI workflow → save generated messages
5. **Follow-Up Management** — Schedule and track follow-ups
6. **Pitch Deck Generation** — Call Gamma API → store result
7. **Flash Cards** — Generate and serve prep cards
8. **File Management** — Upload/download resumes, exports via Blob Storage
9. **Inbox Actions** — Compute and serve priority action items
10. **Dashboard Metrics** — Aggregate and serve stats

### 3.3 AI Layer — Azure AI Foundry

| Aspect | Details |
|--------|---------|
| **Service** | Azure AI Foundry (Prompt Flow + AI Agents) |
| **Purpose** | All AI orchestration — parsing, research, generation |
| **Access** | Called by Worker service only (never directly from frontend) |

**AI Workflows (Prompt Flows / Agents):**

| Workflow | Trigger | Input | Output |
|----------|---------|-------|--------|
| **Job Parsing** | User pastes LinkedIn URL | Raw URL / HTML | Structured job data (title, company, description, requirements) |
| **Company Research** | After job parsing | Company name | Company insights, culture notes, talking points |
| **Contact Discovery** | User clicks "Find Contacts" | Company name + job title | List of relevant contacts with confidence scores |
| **Outreach Generation** | User clicks "Generate Outreach" | Job data + contact data + user resume | Personalized outreach message drafts |
| **Follow-Up Generation** | After outreach period | Original outreach + job context | Follow-up message draft |
| **Flash Card Generation** | User opens flash cards | Job data + company research | Q&A flash cards for coffee chat prep |
| **Pitch Deck Content** | User clicks "Generate Pitch Deck" | User resume + job data + company data | Structured slide content (sent to Gamma) |

### 3.4 Database — Azure Database for PostgreSQL

| Aspect | Details |
|--------|---------|
| **Engine** | PostgreSQL 15+ (Azure managed) |
| **Purpose** | System of record — all structured app data |
| **Access** | Backend only (never from frontend directly) |

> Full schema is documented in `BACKEND_HANDOVER.md` Section 11.

**Core Tables:**
- `profiles` — User accounts & preferences
- `jobs` — Job cards (parsed from URLs)
- `contacts` — Discovered contacts per job
- `outreach_messages` — Generated/sent messages
- `follow_ups` — Scheduled follow-up messages
- `flash_cards` — Generated prep cards
- `activity_log` — Timeline events per job
- `attachments` — File metadata (actual files in Blob)
- `workflow_runs` — AI job queue tracking
- `inbox_actions` — Computed action items

### 3.5 File Storage — Azure Blob Storage

| Aspect | Details |
|--------|---------|
| **Purpose** | Store large/binary files outside the database |
| **Access** | Backend reads/writes; frontend gets pre-signed URLs |

**Containers (buckets):**

| Container | Contents | Access |
|-----------|----------|--------|
| `resumes` | Uploaded user resumes (PDF/DOCX) | Private — user-scoped |
| `exports` | Generated pitch deck PDFs, outreach exports | Private — user-scoped |
| `ai-outputs` | Large AI response payloads (if needed) | Private — system |

### 3.6 Job Queue — Azure Service Bus

| Aspect | Details |
|--------|---------|
| **Purpose** | Decouple long-running AI tasks from API response cycle |
| **Pattern** | Producer (API) → Queue → Consumer (Worker) |

**Queues:**

| Queue Name | Purpose | Consumer |
|------------|---------|----------|
| `job-parsing` | Parse LinkedIn URL into structured job data | Worker |
| `contact-discovery` | Find contacts at target company | Worker |
| `outreach-generation` | Generate outreach messages | Worker |
| `follow-up-generation` | Generate follow-up messages | Worker |
| `pitch-deck-generation` | Generate pitch deck via AI + Gamma | Worker |
| `flash-card-generation` | Generate flash cards | Worker |

**Message Schema (all queues):**
```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "type": "contact_discovery | outreach_generation | ...",
  "payload": { /* workflow-specific input */ },
  "created_at": "ISO timestamp"
}
```

**Flow:**
1. Frontend calls API endpoint (e.g., `POST /jobs/{id}/contacts/discover`)
2. API creates a `workflow_runs` row with status `queued`
3. API publishes message to Service Bus queue
4. API responds immediately with `{ "workflow_run_id": "...", "status": "queued" }`
5. Worker picks up the message, updates status to `processing`
6. Worker calls AI Foundry, saves results
7. Worker updates status to `completed` (or `failed`)
8. Frontend polls `GET /workflow-runs/{id}` or uses WebSocket for real-time updates

### 3.7 External Integration — Gamma API

| Aspect | Details |
|--------|---------|
| **Purpose** | Generate visual pitch decks from structured content |
| **Called by** | Worker service only |
| **Flow** | AI generates slide content → Worker sends to Gamma → Gamma returns deck URL → stored in DB |

### 3.8 Hosting Summary

| Component | Azure Service | Scaling |
|-----------|--------------|---------|
| Frontend | Azure Static Web Apps | Auto (CDN) |
| API Server | Azure Container Apps (API role) | HTTP-based autoscale |
| Worker | Azure Container Apps (Worker role) | Queue-depth autoscale |
| Database | Azure Database for PostgreSQL | Vertical (managed) |
| File Storage | Azure Blob Storage | Auto |
| Job Queue | Azure Service Bus | Auto |
| AI | Azure AI Foundry | Per-request |
| Secrets | Azure Key Vault | N/A |
| Monitoring | Azure Application Insights | N/A |

---

## 4. End-to-End Data Flow

### Flow 1: User Adds a New Job

```
User pastes LinkedIn URL → clicks "Add"
  │
  ▼
Frontend: POST /jobs  { url: "https://linkedin.com/jobs/..." }
  │
  ▼
API Server:
  1. Validate URL format
  2. Create job row in Postgres (status: "parsing", title: TBD)
  3. Create workflow_run row (type: "job_parsing", status: "queued")
  4. Publish message to "job-parsing" Service Bus queue
  5. Return { job_id, workflow_run_id, status: "queued" }
  │
  ▼
Worker:
  1. Picks up message from queue
  2. Scrapes/fetches LinkedIn job page
  3. Sends to AI Foundry for parsing
  4. Updates job row with parsed data (title, company, description)
  5. Updates workflow_run status to "completed"
  │
  ▼
Frontend:
  - Polls GET /workflow-runs/{id} until status = "completed"
  - Fetches GET /jobs/{id} for full parsed job data
  - Job card appears on Kanban board
```

### Flow 2: User Generates Outreach

```
User opens Job Detail → clicks "Generate Outreach"
  │
  ▼
Frontend: POST /jobs/{id}/outreach/generate
  │
  ▼
API Server:
  1. Verify job has selected contact
  2. Fetch user resume metadata from DB
  3. Create workflow_run (type: "outreach_generation", status: "queued")
  4. Publish to "outreach-generation" queue
  5. Return { workflow_run_id, status: "queued" }
  │
  ▼
Worker:
  1. Fetch job data + contact data + resume from Blob
  2. Call AI Foundry with full context
  3. Save generated message(s) to outreach_messages table
  4. Update workflow_run to "completed"
  │
  ▼
Frontend:
  - Polls for completion
  - Displays generated outreach in OutreachBuilder component
```

### Flow 3: User Generates Pitch Deck

```
User opens Job Detail → clicks "Generate Pitch Deck"
  │
  ▼
Frontend: POST /jobs/{id}/pitch-deck/generate
  │
  ▼
API → Service Bus → Worker:
  1. AI Foundry generates structured slide content
  2. Worker sends content to Gamma API
  3. Gamma returns deck URL/file
  4. Worker saves URL to DB, file to Blob (if needed)
  │
  ▼
Frontend:
  - Shows "Generated" status
  - "Download PDF" button uses pre-signed Blob URL
```

---

## 5. Frontend → Backend Integration Map

This maps every UI component to the API endpoints it will consume.

### 5.1 Dashboard (`/` — `Index.tsx`)

| Component | Current State | API Endpoint Needed |
|-----------|--------------|-------------------|
| `DailyGoalCard` | Hardcoded `goal=5, completed=2` | `GET /dashboard/daily-goal` |
| `MetricsCard` | Hardcoded `coffeeChats=8, interviews=3` | `GET /dashboard/metrics` |
| `TasksCard` | Hardcoded `totalTasks=12, completedTasks=7` | `GET /dashboard/tasks-summary` |
| `InboxPreview` | Derived from `sampleJobs` array | `GET /inbox/actions?limit=5` |
| `JobsPreview` | Derived from `sampleJobs` array | `GET /jobs?limit=5&sort=updated_at` |

### 5.2 Inbox (`/inbox` — `Inbox.tsx`)

| Component | Current State | API Endpoint Needed |
|-----------|--------------|-------------------|
| Action list | Generated client-side from `sampleJobs` via `inboxUtils.ts` | `GET /inbox/actions` |
| Search | Client-side filter on hardcoded data | `GET /inbox/actions?q={query}` |
| Mark Done | Local state (`completedIds` Set) | `PATCH /inbox/actions/{id}` `{ status: "completed" }` |
| Snooze | Local state (`snoozedIds` Set) | `PATCH /inbox/actions/{id}` `{ status: "snoozed", snooze_until: "..." }` |
| Filter button | UI exists, no functionality | `GET /inbox/actions?category={priority\|waiting\|setup}` |

### 5.3 Jobs Board (`/jobs` — `Jobs.tsx` + `KanbanBoard.tsx`)

| Component | Current State | API Endpoint Needed |
|-----------|--------------|-------------------|
| Job cards | `sampleJobs` hardcoded array (8 jobs) | `GET /jobs` |
| Create Job (URL input) | `console.log` only | `POST /jobs` `{ url: "..." }` |
| Search | Client-side filter | `GET /jobs?q={query}` |
| Kanban filters (company, tags, status) | Client-side filter on hardcoded data | `GET /jobs?company={}&tags={}&status={}` |
| Drag-and-drop status change | Updates local state | `PATCH /jobs/{id}` `{ status: "..." }` |
| Move via dropdown menu | Updates local state | `PATCH /jobs/{id}` `{ status: "..." }` |
| Board vs List view toggle | Local UI state | No API needed (frontend-only) |
| Hide empty columns toggle | Local UI state | No API needed (frontend-only) |

### 5.4 Job Detail (`/job/:id` — `JobDetail.tsx`)

| Component | Current State | API Endpoint Needed |
|-----------|--------------|-------------------|
| Job header (title, company, deadline, URL) | From `sampleJobs.find()` | `GET /jobs/{id}` |
| Status dropdown | Local state | `PATCH /jobs/{id}` `{ status: "..." }` |
| Description expand/collapse | Local UI state | No API needed |
| **ProgressTracker** | Milestones from hardcoded data, toggled locally | `GET /jobs/{id}/milestones` + `PATCH /jobs/{id}/milestones` |
| **ContactDiscovery** | Hardcoded contacts array | `GET /jobs/{id}/contacts` + `POST /jobs/{id}/contacts/discover` |
| **OutreachBuilder** | Static UI, no real generation | `POST /jobs/{id}/outreach/generate` + `GET /jobs/{id}/outreach` |
| **FollowUpScheduler** | Static UI | `GET /jobs/{id}/follow-up` + `POST /jobs/{id}/follow-up/generate` + `PATCH /jobs/{id}/follow-up` |
| **PitchDeckPanel** | Local `generated` state, static slides list | `POST /jobs/{id}/pitch-deck/generate` + `GET /jobs/{id}/pitch-deck` |
| **FlashCardsPanel** | Static UI | `POST /jobs/{id}/flash-cards/generate` + `GET /jobs/{id}/flash-cards` |
| **InterviewMode** | Conditionally rendered (postponed V2) | *No API needed for V1* |
| **NotesAttachments** | Tags from hardcoded data | `GET /jobs/{id}/notes` + `PATCH /jobs/{id}/notes` + `POST /jobs/{id}/attachments` |
| **ActivityTimeline** | Hardcoded timeline array | `GET /jobs/{id}/activity` |
| **OutcomeSection** | Static UI | `PATCH /jobs/{id}` `{ outcome: "..." }` |

### 5.5 Sidebar Navigation

| Link | Route | Current State |
|------|-------|--------------|
| Home | `/` | Works |
| Inbox | `/inbox` | Works |
| Jobs | `/jobs` | Works |
| Resume | `/resume` | Route exists in sidebar but **no page built** |
| Support | `/support` | Route exists in sidebar but **no page built** |
| Settings | `/settings` | Route exists in sidebar but **no page built** |
| Log out | N/A | Button exists, no functionality | `POST /auth/logout` |

---

## 6. Current Frontend State (What Exists Today)

### Files That Should Be Removed (Dead Code)

| File/Directory | Reason |
|---------------|--------|
| `src/pages/Calendar.tsx` | Calendar feature removed |
| `src/components/calendar/*` (entire directory) | Calendar feature removed |
| `src/data/calendarEvents.ts` | Calendar data |
| `src/types/calendar.ts` | Calendar types |
| Calendar route in `App.tsx` (line 26) | Dead route |
| `src/components/job-detail/InterviewMode.tsx` | Postponed to V2 |
| Conditional render in `JobDetail.tsx` (line 153) | InterviewMode reference |
| `src/components/CourseCard.tsx` | Unused component |
| `src/components/CourseFilters.tsx` | Unused component |
| `src/components/LessonRow.tsx` | Unused component |
| `src/components/MyLessons.tsx` | Unused component |
| `src/components/RecommendedCourse.tsx` | Unused component |
| `src/components/NavLink.tsx` | Unused component |
| `src/components/JobFilters.tsx` | Unused (replaced by KanbanFilters) |
| `src/components/JobRow.tsx` | Unused component |
| `src/components/JobsSection.tsx` | Unused component |

### Hardcoded Data Files (Must Be Replaced by API Calls)

| File | Contains | Replacement |
|------|----------|-------------|
| `src/data/jobs.ts` | 8 sample job objects | `GET /jobs` API response |
| `src/data/calendarEvents.ts` | Calendar events | **Delete** (calendar removed) |

### Fields Removed from Job Cards (No Longer in UI)

These fields exist in `src/types/job.ts` but are no longer displayed or filtered:
- `fitScore` — removed from card and filters
- `workMode` — removed from card and filters
- `roleFamily` — removed from card and filters

**Decision needed:** Keep in data model for future use or remove from type definition entirely.

---

## 7. What Backend Must Replace

### 7.1 Hardcoded Data → API Calls

| Current Code | Location | Replace With |
|-------------|----------|-------------|
| `import { sampleJobs } from "@/data/jobs"` | `Index.tsx`, `Jobs.tsx`, `JobDetail.tsx`, `Inbox.tsx` | `useQuery("jobs", () => fetch("/api/jobs"))` |
| `const [jobs] = useState<Job[]>(sampleJobs)` | `Index.tsx` | `const { data: jobs } = useQuery(...)` |
| `const [jobs, setJobs] = useState<Job[]>(sampleJobs)` | `Jobs.tsx` | `useQuery` + `useMutation` for updates |
| `sampleJobs.find(j => j.id === id)` | `JobDetail.tsx` | `useQuery(["job", id], () => fetch(\`/api/jobs/${id}\`))` |
| `generateInboxActionsFromJobs(sampleJobs)` | `Inbox.tsx` | `useQuery("inbox", () => fetch("/api/inbox/actions"))` |
| `console.log("Creating job from URL:", jobUrl)` | `KanbanBoard.tsx` line 114 | `useMutation(() => fetch("/api/jobs", { method: "POST", body: { url } }))` |
| Dashboard metrics (`goal=5, completed=2`, etc.) | `Index.tsx` lines 27-29 | `useQuery("dashboard", () => fetch("/api/dashboard"))` |

### 7.2 Local State → API Mutations

| Current Behavior | Location | Replace With |
|-----------------|----------|-------------|
| Drag-and-drop updates local array | `KanbanBoard.tsx` | `PATCH /jobs/{id}` + optimistic update |
| Milestone toggle updates local state | `JobDetail.tsx` | `PATCH /jobs/{id}/milestones` |
| Status dropdown updates local state | `JobDetail.tsx` | `PATCH /jobs/{id}` |
| Inbox mark done / snooze | `Inbox.tsx` | `PATCH /inbox/actions/{id}` |
| Pitch deck "Generate" sets `generated=true` | `PitchDeckPanel.tsx` | `POST /jobs/{id}/pitch-deck/generate` + poll |

---

## 8. GitHub Workflow & Collaboration Rules

### 8.1 Branch Strategy

```
main (production)
  │
  ├── develop (integration branch — all features merge here first)
  │     │
  │     ├── feat/REF-{ticket}-{short-description}
  │     ├── fix/REF-{ticket}-{short-description}
  │     ├── chore/REF-{ticket}-{short-description}
  │     └── hotfix/REF-{ticket}-{short-description}
  │
  └── staging (pre-production testing — mirrors main)
```

**Branch Types:**

| Prefix | Use Case | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/REF-12-contact-discovery-api` |
| `fix/` | Bug fix | `fix/REF-45-kanban-drag-drop-crash` |
| `chore/` | Refactor, config, cleanup | `chore/REF-20-remove-calendar-dead-code` |
| `hotfix/` | Urgent production fix | `hotfix/REF-99-auth-token-expiry` |

### 8.2 Commit Message Convention

Use **Conventional Commits** format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer — e.g., Closes #12]
```

**Types:**

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `chore` | Build, tooling, config changes |
| `docs` | Documentation only |
| `style` | Formatting, no code logic change |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |

**Examples:**
```
feat(jobs): add POST /jobs endpoint for URL-based job creation
fix(kanban): prevent duplicate drag events on rapid interaction
refactor(inbox): extract action computation to server-side
chore(ci): add staging deployment workflow
docs(api): update outreach endpoint response schema
```

**Rules:**
- ✅ Subject line ≤ 72 characters
- ✅ Use imperative mood ("add", "fix", "update" — not "added", "fixed")
- ✅ Reference ticket number in footer: `Closes REF-12`
- ❌ No vague messages: "fix stuff", "update", "wip", "changes"
- ❌ No mega-commits — one logical change per commit

### 8.3 Pull Request Rules

**Before Opening a PR:**
1. Pull latest `develop` and rebase your branch: `git pull origin develop --rebase`
2. Ensure no lint errors, type errors, or test failures
3. Self-review your diff — remove debug logs, commented code, TODOs

**PR Template:**
```markdown
## What
Brief description of what this PR does.

## Why
Why is this change needed? Link to ticket: REF-XX

## How
Technical approach — what changed and why this approach.

## Testing
- [ ] Tested locally
- [ ] API endpoints tested (Postman/curl)
- [ ] Frontend integration verified
- [ ] Edge cases handled (empty state, errors, loading)

## Screenshots (if UI change)
Before / After screenshots

## Checklist
- [ ] Code follows project conventions
- [ ] No hardcoded secrets or credentials
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Types updated (if schema changed)
```

**Review Rules:**
- Every PR requires **at least 1 approval** before merge
- Reviewer should test locally or verify screenshots
- Use "Request Changes" for blockers, "Comment" for suggestions
- Author resolves all conversations before merging

### 8.4 Merge Strategy

| Target Branch | Merge Method | When |
|--------------|-------------|------|
| `feat/*` → `develop` | **Squash and Merge** | Feature complete, PR approved |
| `develop` → `staging` | **Merge Commit** | Ready for QA/staging testing |
| `staging` → `main` | **Merge Commit** | Staging validated, ready for production |
| `hotfix/*` → `main` | **Squash and Merge** | Urgent fix, then back-merge to `develop` |

**Rules:**
- ❌ Never push directly to `main` or `develop`
- ❌ Never force-push to shared branches
- ✅ Always squash feature branches to keep history clean
- ✅ Delete branch after merge
- ✅ Back-merge `main` into `develop` after hotfixes

### 8.5 Code Ownership & Responsibilities

| Area | Owner | Notes |
|------|-------|-------|
| Frontend (React/Next.js) | Mohamed | Components, pages, styling, state management |
| Backend (FastAPI) | Co-founder | API endpoints, DB queries, auth |
| AI Workflows (Prompt Flow) | Shared | Prompt engineering, flow design |
| Infrastructure (Azure) | Shared | Container Apps, Service Bus, DB config |
| CI/CD (GitHub Actions) | Whoever sets it up first | Maintained by both |

### 8.6 Git Hygiene Rules

1. **Pull before you push** — always `git pull --rebase` before pushing
2. **Small, focused PRs** — max 400 lines changed (excluding auto-generated)
3. **No secrets in code** — use Azure Key Vault references
4. **No `node_modules` or build artifacts** in git
5. **`.gitignore` must include:** `node_modules/`, `.env*`, `dist/`, `build/`, `.next/`, `__pycache__/`, `*.pyc`, `.venv/`
6. **Resolve conflicts on your branch** — never on `develop` or `main`
7. **Tag releases** — `v1.0.0`, `v1.1.0` using semantic versioning

---

## 9. Environment & Deployment

### 9.1 Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| Development | `develop` | `localhost:3000` (FE) / `localhost:8000` (BE) | Local development |
| Staging | `staging` | `staging.referro.app` | Pre-production testing |
| Production | `main` | `app.referro.app` | Live users |

### 9.2 CI/CD Pipeline (GitHub Actions)

**On push to `develop`:**
```yaml
# .github/workflows/develop.yml
- Lint + type check frontend
- Lint + type check backend
- Run unit tests
- Build frontend
- Build backend Docker image
- Deploy to staging (optional — or only on staging branch)
```

**On push to `main`:**
```yaml
# .github/workflows/production.yml
- All checks from develop
- Run integration tests
- Build production frontend → deploy to Azure Static Web Apps
- Build production backend → deploy to Azure Container Apps
- Run smoke tests
- Notify team (Slack/Discord)
```

### 9.3 Docker Configuration (Backend)

```dockerfile
# Dockerfile — FastAPI backend
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# API role
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Worker role (override in Container Apps config)
# CMD ["python", "-m", "app.worker"]
```

---

## 10. Security & Secrets

### 10.1 Azure Key Vault Secrets

| Secret Name | Purpose | Used By |
|-------------|---------|---------|
| `DB_CONNECTION_STRING` | PostgreSQL connection | API + Worker |
| `AZURE_AI_ENDPOINT` | AI Foundry endpoint URL | Worker |
| `AZURE_AI_KEY` | AI Foundry API key | Worker |
| `GAMMA_API_KEY` | Gamma pitch deck API | Worker |
| `SERVICE_BUS_CONNECTION` | Service Bus connection string | API + Worker |
| `BLOB_STORAGE_CONNECTION` | Blob Storage connection string | API + Worker |
| `JWT_SECRET` | JWT token signing | API |
| `APP_INSIGHTS_KEY` | Application Insights instrumentation | API + Worker |

### 10.2 Security Rules

- ❌ Never hardcode secrets in code, config files, or environment files
- ❌ Never commit `.env` files to Git
- ✅ All secrets stored in Azure Key Vault
- ✅ Backend accesses secrets via Managed Identity (no keys in code)
- ✅ All API endpoints validate JWT tokens (except public routes)
- ✅ Input validation on all endpoints (use Pydantic models)
- ✅ Rate limiting on auth endpoints (max 10 attempts/minute)
- ✅ CORS configured to allow only `app.referro.app` and `staging.referro.app`
- ✅ File uploads validated (type, size ≤ 10MB, virus scan if possible)
- ✅ SQL injection prevention (use ORM/parameterized queries only)

---

## 11. Monitoring & Observability

### Azure Application Insights

| What to Track | How |
|--------------|-----|
| API response times | Auto-instrumented by FastAPI middleware |
| Error rates (4xx, 5xx) | Auto-captured |
| AI workflow latency | Custom metric: `ai_workflow_duration_ms` |
| AI workflow failures | Custom event: `ai_workflow_failed` |
| Queue depth | Service Bus metrics (auto) |
| Active users | Custom event: `user_action` |
| Job creation rate | Custom metric: `jobs_created_count` |
| Outreach generation rate | Custom metric: `outreach_generated_count` |

**Alerting Rules (set up in Azure Monitor):**
- 5xx error rate > 5% → Alert (Slack/Email)
- API P95 latency > 3s → Warning
- AI workflow failure rate > 10% → Alert
- Queue depth > 100 messages → Warning
- Database connection failures → Alert

---

## 12. Future Considerations (Post-V1)

| Feature | Phase | Tech Impact |
|---------|-------|-------------|
| Interview Prep Mode | V2 | New AI workflows, new UI components (already scaffolded) |
| Resume Builder/Editor | V2 | New page, Blob storage for versions |
| Analytics Dashboard (Databricks) | V2+ | Export pipeline from PostgreSQL → Databricks |
| Multi-language Outreach | V2 | AI Foundry prompt changes |
| Team/Organization accounts | V3 | DB schema changes, RBAC |
| Mobile app (React Native) | V3 | Same API, new frontend |
| Calendar Integration | TBD | Was removed — may return as external calendar sync (Google/Outlook) |
| Browser Extension | V2+ | LinkedIn scraping, auto-fill |

---

## Appendix A: Quick Reference — What Calls What

```
Frontend (Next.js)
  └── calls → FastAPI (API role) via REST
                ├── reads/writes → PostgreSQL
                ├── reads/writes → Blob Storage (pre-signed URLs)
                └── publishes → Service Bus
                                  └── consumed by → FastAPI (Worker role)
                                                      ├── calls → AI Foundry
                                                      ├── calls → Gamma API
                                                      ├── writes → PostgreSQL
                                                      └── writes → Blob Storage
```

## Appendix B: Tech Stack Summary Table

| Layer | Technology | Azure Service |
|-------|-----------|---------------|
| Frontend Framework | Next.js + TypeScript | — |
| Frontend Hosting | — | Azure Static Web Apps |
| Backend Framework | FastAPI (Python) | — |
| Backend Hosting | — | Azure Container Apps |
| Database | PostgreSQL 15+ | Azure Database for PostgreSQL |
| File Storage | — | Azure Blob Storage |
| Job Queue | — | Azure Service Bus |
| AI Orchestration | — | Azure AI Foundry (Prompt Flow) |
| Pitch Decks | Gamma API | — |
| Secrets | — | Azure Key Vault |
| Monitoring | — | Azure Application Insights |
| CI/CD | GitHub Actions | — |
| Analytics (future) | — | Databricks |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2025 | Mohamed Hiba | Initial tech stack document |

---

*End of Document*
