# Referro V1 — Full Execution Plan

## From Frontend-Only to Fully Functional Product

**Document Version:** 1.0  
**Date:** February 2025  
**Author:** CTO Planning  
**Team:** Mohamed (Frontend + AI) · Ahmed (Backend + Infrastructure)  
**Estimated Duration:** 10–12 weeks  

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [Phase Overview (The Big Picture)](#2-phase-overview)
3. [Phase 0 — Foundation & Cleanup (Week 1)](#3-phase-0--foundation--cleanup-week-1)
4. [Phase 1 — Auth & Core Data Layer (Weeks 2–3)](#4-phase-1--auth--core-data-layer-weeks-2-3)
5. [Phase 2 — Job Pipeline (Core CRUD) (Weeks 4–5)](#5-phase-2--job-pipeline-core-crud-weeks-4-5)
6. [Phase 3 — AI-Powered Features (Weeks 6–7)](#6-phase-3--ai-powered-features-weeks-6-7)
7. [Phase 4 — Dashboard, Inbox & Polish (Weeks 8–9)](#7-phase-4--dashboard-inbox--polish-weeks-8-9)
8. [Phase 5 — Advanced Features & Pitch Deck (Week 10)](#8-phase-5--advanced-features--pitch-deck-week-10)
9. [Phase 6 — QA, Staging & Launch Prep (Weeks 11–12)](#9-phase-6--qa-staging--launch-prep-weeks-11-12)
10. [Work Split — Mohamed vs Ahmed](#10-work-split--mohamed-vs-ahmed)
11. [Daily & Weekly Rituals](#11-daily--weekly-rituals)
12. [Dependency Map — What Blocks What](#12-dependency-map--what-blocks-what)
13. [Risk Register & Mitigations](#13-risk-register--mitigations)
14. [Definition of Done (DoD)](#14-definition-of-done-dod)
15. [Handoff Points Between Mohamed & Ahmed](#15-handoff-points-between-mohamed--ahmed)

---

## 1. Guiding Principles

Before any code is written, both Mohamed and Ahmed must agree on these principles:

1. **Contract-First Development** — Agree on API contracts (request/response shapes) BEFORE implementing. Ahmed builds the backend to the contract. Mohamed builds the frontend to the contract. Both can work in parallel without blocking each other.

2. **Vertical Slices, Not Horizontal Layers** — Don't build "all of the database" then "all of the API" then "all of the frontend." Instead, build one feature end-to-end (e.g., "user can sign up and see an empty dashboard") before moving to the next.

3. **Mock First, Integrate Second** — Mohamed should use mock data (already exists as `sampleJobs`) until Ahmed's endpoints are ready. When an endpoint is deployed, Mohamed swaps the mock for the real call. This prevents blocking.

4. **One Source of Truth** — The database is the source of truth. No feature is "done" until the data persists in PostgreSQL and survives a page refresh.

5. **Ship Small, Ship Often** — Every PR should be deployable. No "mega-branches" that take 2 weeks to merge. If a feature isn't ready, hide it behind a feature flag — don't leave broken code in `develop`.

6. **Test at the Boundaries** — Ahmed writes API tests (does the endpoint return the right data?). Mohamed writes integration tests (does the UI show the right thing when the API returns X?). Both test error states.

---

## 2. Phase Overview

```
Week  1     │ Phase 0: Foundation & Cleanup
Weeks 2–3   │ Phase 1: Auth & Core Data Layer
Weeks 4–5   │ Phase 2: Job Pipeline (Core CRUD)
Weeks 6–7   │ Phase 3: AI-Powered Features
Weeks 8–9   │ Phase 4: Dashboard, Inbox & Polish
Week  10    │ Phase 5: Advanced Features (Pitch Deck, Flash Cards)
Weeks 11–12 │ Phase 6: QA, Staging & Launch
```

```
                    ┌────────────────────────────────────────────┐
                    │           PHASE 0: FOUNDATION              │
                    │  Cleanup dead code, set up infra, repos    │
                    └──────────────────┬─────────────────────────┘
                                       │
                    ┌──────────────────▼─────────────────────────┐
                    │        PHASE 1: AUTH + DATA LAYER           │
                    │  Users can sign up, log in, see empty app  │
                    └──────────────────┬─────────────────────────┘
                                       │
                    ┌──────────────────▼─────────────────────────┐
                    │       PHASE 2: JOB PIPELINE (CRUD)         │
                    │  Users can add jobs, see kanban, drag cards │
                    └──────────────────┬─────────────────────────┘
                                       │
                    ┌──────────────────▼─────────────────────────┐
                    │       PHASE 3: AI FEATURES                  │
                    │  Contact discovery, outreach generation     │
                    └──────────────────┬─────────────────────────┘
                                       │
                    ┌──────────────────▼─────────────────────────┐
                    │     PHASE 4: DASHBOARD + INBOX              │
                    │  Real metrics, real inbox, real actions     │
                    └──────────────────┬─────────────────────────┘
                                       │
                    ┌──────────────────▼─────────────────────────┐
                    │     PHASE 5: PITCH DECK + EXTRAS            │
                    │  Gamma integration, flash cards             │
                    └──────────────────┬─────────────────────────┘
                                       │
                    ┌──────────────────▼─────────────────────────┐
                    │     PHASE 6: QA + LAUNCH                    │
                    │  Testing, staging, production deployment    │
                    └────────────────────────────────────────────┘
```

---

## 3. Phase 0 — Foundation & Cleanup (Week 1)

**Goal:** Clean codebase, working repos, infrastructure provisioned, API contracts agreed upon.

### 3.1 Mohamed's Tasks (Frontend Cleanup)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| M0.1 | **Delete all dead code** | Remove Calendar page, calendar components, `calendarEvents.ts`, `calendar.ts` types, calendar route from `App.tsx`. Remove `InterviewMode.tsx` (postponed). Remove unused components: `CourseCard`, `CourseFilters`, `LessonRow`, `MyLessons`, `RecommendedCourse`, `NavLink`, `JobFilters`, `JobRow`, `JobsSection`. | Clean `src/` with no unused files |
| M0.2 | **Clean up types** | Remove `fitScore`, `workMode`, `roleFamily` from `Job` type in `src/types/job.ts` (or mark them as deprecated). Remove `interviewPrep1/2/3` from milestones. | Updated `src/types/job.ts` |
| M0.3 | **Set up API client module** | Create `src/lib/api.ts` — a centralized fetch wrapper that will point to Ahmed's FastAPI backend. Include auth header injection, error handling, base URL config. Use environment variable for API base URL. | `src/lib/api.ts` ready |
| M0.4 | **Create auth context skeleton** | Create `src/contexts/AuthContext.tsx` with `login()`, `signup()`, `logout()`, `user` state. Initially mock (return hardcoded user). Ahmed will provide real endpoints later. | Auth context ready for integration |
| M0.5 | **Create loading & error states** | Add skeleton loaders to Dashboard cards, Kanban board, Job Detail page. Add error boundary components. These will be used when real API calls replace hardcoded data. | Skeleton components ready |
| M0.6 | **Set up GitHub repo** | Initialize repo, create `develop` branch, set up branch protection rules (require PR review, no direct push to `main`/`develop`). Add `.gitignore` for both frontend and backend. | Repo with branch rules |

### 3.2 Ahmed's Tasks (Infrastructure)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| A0.1 | **Provision Azure resources** | Create Resource Group. Provision: Azure Database for PostgreSQL, Azure Container Apps environment, Azure Blob Storage account, Azure Service Bus namespace, Azure Key Vault, Azure Application Insights. | All Azure resources created |
| A0.2 | **Set up FastAPI project** | Create Python project structure: `app/main.py`, `app/routers/`, `app/models/`, `app/services/`, `app/core/config.py`, `app/core/security.py`. Add Dockerfile. Add `requirements.txt` with FastAPI, uvicorn, SQLAlchemy, alembic, pydantic, python-jose. | FastAPI project skeleton running locally |
| A0.3 | **Run database migrations** | Use Alembic (or raw SQL) to create all tables from the schema in `BACKEND_HANDOVER.md` Section 6. Create enums, tables, indexes, triggers. Enable RLS on all tables. | Database schema deployed |
| A0.4 | **Set up CI/CD pipeline** | Create `.github/workflows/` for: lint + type check (both repos), build frontend, build + push Docker image, deploy to staging. | GitHub Actions workflows running |
| A0.5 | **Store secrets in Key Vault** | Add: `DB_CONNECTION_STRING`, `JWT_SECRET`, `SERVICE_BUS_CONNECTION`, `BLOB_STORAGE_CONNECTION`. Configure Managed Identity for Container Apps to access Key Vault. | Secrets stored and accessible |
| A0.6 | **Create API contract document** | Formalize the OpenAPI spec (FastAPI auto-generates this). Share the Swagger URL with Mohamed so he knows exact request/response shapes. | Swagger docs URL shared |

### 3.3 Joint Tasks

| # | Task | Details | Who Leads |
|---|------|---------|-----------|
| J0.1 | **Agree on API contracts** | Sit together (or async doc) and finalize every endpoint: method, path, request body, response shape, error codes. Use the contracts from `BACKEND_HANDOVER.md` Section 7 as starting point. Resolve any ambiguities. | Both |
| J0.2 | **Agree on auth flow** | Decide: JWT tokens (access + refresh)? Where stored (httpOnly cookies vs localStorage)? Token refresh strategy? | Both |
| J0.3 | **Set up environments** | Agree on: local dev ports (FE: 3000, BE: 8000), staging URLs, CORS configuration. | Both |

### Phase 0 Exit Criteria
- [ ] Frontend repo has zero dead code, zero unused imports
- [ ] Backend repo has FastAPI running locally with health check endpoint
- [ ] Database has all tables created
- [ ] Both devs can run the full stack locally
- [ ] API contracts documented and agreed upon
- [ ] CI/CD deploys frontend to staging on push to `develop`

---

## 4. Phase 1 — Auth & Core Data Layer (Weeks 2–3)

**Goal:** Users can sign up, log in, log out, and see an authenticated (but empty) app.

### 4.1 Ahmed's Tasks (Backend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| A1.1 | **Implement auth endpoints** | `POST /auth/signup` — create user in DB, return JWT. `POST /auth/login` — validate credentials, return JWT. `POST /auth/logout` — invalidate token (if using blacklist). `POST /auth/refresh` — issue new access token. `GET /auth/me` — return current user from JWT. | All auth endpoints working |
| A1.2 | **Implement profile auto-creation** | When a user signs up, auto-create a `profiles` row with default values (daily_goal=5, etc.). This is the trigger from the DB schema. | Profile created on signup |
| A1.3 | **Implement profile endpoints** | `GET /users/me` — return profile. `PATCH /users/me` — update name, username, avatar_url, daily_goal, timezone. | Profile CRUD working |
| A1.4 | **Add auth middleware** | Create a FastAPI dependency that extracts and validates JWT from the `Authorization` header. All protected endpoints will use this dependency. | Middleware protecting routes |
| A1.5 | **Add RLS policies** | Ensure every table has RLS policies so users can only access their own data. Test by trying to access another user's job — should return 403 or empty. | RLS verified |
| A1.6 | **Set up CORS** | Configure FastAPI CORS to allow requests from `localhost:3000` (dev) and `staging.referro.app` (staging). | CORS configured |

### 4.2 Mohamed's Tasks (Frontend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| M1.1 | **Build Login page** | New page at `/login`. Email + password form. Call `POST /auth/login`. On success, store token and redirect to `/`. On error, show error message. | Login page working |
| M1.2 | **Build Signup page** | New page at `/signup`. Name + email + password form. Call `POST /auth/signup`. On success, redirect to `/login` (or auto-login). Validation: email format, password min 8 chars. | Signup page working |
| M1.3 | **Implement AuthContext** | Replace the mock auth context from Phase 0 with real API calls. Store JWT in memory (or httpOnly cookie if Ahmed supports it). Auto-refresh token before expiry. | Auth context integrated |
| M1.4 | **Add route protection** | Create `<ProtectedRoute>` wrapper. Redirect unauthenticated users to `/login`. Wrap all app routes except `/login` and `/signup`. | Protected routes working |
| M1.5 | **Update Header with real user data** | Replace hardcoded name/avatar in `Header.tsx` with data from `AuthContext.user`. Show loading skeleton while fetching. | Header shows real user |
| M1.6 | **Wire up Logout button** | The Sidebar logout button calls `POST /auth/logout`, clears token, redirects to `/login`. | Logout working |
| M1.7 | **Build Settings page (basic)** | New page at `/settings`. Show profile fields (name, username, daily goal). Allow editing. Call `PATCH /users/me`. | Settings page with profile edit |

### Phase 1 Exit Criteria
- [ ] New user can sign up with email + password
- [ ] Existing user can log in and see their (empty) dashboard
- [ ] User can log out and is redirected to login
- [ ] Unauthenticated user cannot access any page except login/signup
- [ ] Header shows the logged-in user's real name
- [ ] User can edit their profile in Settings
- [ ] Session persists across page refresh (token stored properly)

---

## 5. Phase 2 — Job Pipeline (Core CRUD) (Weeks 4–5)

**Goal:** Users can add jobs by pasting LinkedIn URLs, see them on the Kanban board, drag them between columns, open job details, and update status — all persisted in the database.

### 5.1 Ahmed's Tasks (Backend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| A2.1 | **Implement job creation from URL** | `POST /jobs` — accept `{ url: string }`. Validate it's a LinkedIn URL. For V1: use Firecrawl (or simple HTTP fetch + parsing) to extract title, company, description from the page. Create job with status "Interested". Auto-create milestones row. Log activity "Job added". Return full job object. | Job creation endpoint working |
| A2.2 | **Implement job list endpoint** | `GET /jobs` — return all jobs for the authenticated user. Support query params: `?status=X`, `?search=X` (search title + company), `?limit=50&offset=0`. Return `{ jobs: [...], total: number }`. | Job list endpoint working |
| A2.3 | **Implement job detail endpoint** | `GET /jobs/:id` — return full job with milestones, contacts, outreach messages, follow-up, activity timeline. Verify the job belongs to the authenticated user (RLS handles this, but double-check). | Job detail endpoint working |
| A2.4 | **Implement job update endpoint** | `PATCH /jobs/:id` — accept partial updates: status, notes, tags, outcome, selectedContactId. Auto-log activity for status changes. Recalculate progress when milestones change. | Job update endpoint working |
| A2.5 | **Implement job deletion** | `DELETE /jobs/:id` — cascade delete all related data (milestones, contacts, messages, activity). | Job deletion working |
| A2.6 | **Implement milestone update** | `PATCH /jobs/:id/milestones` — accept partial milestone updates. Recalculate job progress = (completed milestones / total milestones) × 100. Return updated milestones + new progress value. | Milestone update working |
| A2.7 | **Implement activity log** | `GET /jobs/:id/activity` — return activity timeline for a job. Auto-log entries when: job created, status changed, milestone toggled, outreach sent, follow-up sent. | Activity log working |
| A2.8 | **Set up Firecrawl / URL scraping** | Integrate a scraping service (Firecrawl recommended) to extract job data from LinkedIn URLs. Handle edge cases: private listings, expired URLs, non-LinkedIn URLs. If scraping fails, return a useful error so Mohamed can show a fallback UI. | URL scraping working |

### 5.2 Mohamed's Tasks (Frontend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| M2.1 | **Build "Add Job" UI** | Add a URL input to the Jobs page (the component already exists in `JobsSection.tsx` but only does `console.log`). On submit, call `POST /jobs`. Show loading state while scraping. On success, add card to Kanban board. On error, show toast with error message. | Add Job flow working |
| M2.2 | **Replace hardcoded jobs with API** | In `Jobs.tsx`, replace `useState<Job[]>(sampleJobs)` with `useQuery("jobs", fetchJobs)`. Same in `Index.tsx` and `Inbox.tsx`. Remove `import { sampleJobs }` everywhere. | All pages use real data |
| M2.3 | **Wire up Kanban drag-and-drop** | When a card is dropped in a new column, call `PATCH /jobs/:id { status: newStatus }`. Use React Query's optimistic update: update the UI immediately, rollback if the API call fails. | Drag-and-drop persists |
| M2.4 | **Wire up Kanban dropdown menu** | The "Move to X" items in the card dropdown menu should call `PATCH /jobs/:id`. | Dropdown status change works |
| M2.5 | **Wire up Job Detail page** | Replace `sampleJobs.find()` with `useQuery(["job", id], fetchJob)`. Show loading skeleton while fetching. Show 404 if job not found. | Job Detail loads from API |
| M2.6 | **Wire up Progress Tracker** | Milestone toggles call `PATCH /jobs/:id/milestones`. Progress bar updates from the API response. | Milestones persist |
| M2.7 | **Wire up Notes & Tags** | Notes textarea saves on blur or button click via `PATCH /jobs/:id { notes }`. Tags add/remove via `PATCH /jobs/:id { tags }`. | Notes and tags persist |
| M2.8 | **Wire up Status dropdown** | The status dropdown on Job Detail calls `PATCH /jobs/:id { status }`. | Status changes persist |
| M2.9 | **Wire up Activity Timeline** | Replace hardcoded timeline with `GET /jobs/:id/activity`. Show "No activity yet" for new jobs. | Real timeline data |
| M2.10 | **Wire up Outcome Section** | Recording an outcome calls `PATCH /jobs/:id { outcome, outcomeReflection }`. | Outcome persists |
| M2.11 | **Handle empty states** | Kanban board shows "No jobs yet — paste a LinkedIn URL above to get started" when there are zero jobs. Job Detail sections show appropriate empty states. | Empty states designed |
| M2.12 | **Handle error states** | API failures show toast notifications. Network errors show retry buttons. 404 jobs show "Job not found" page. | Error handling complete |

### Phase 2 Exit Criteria
- [ ] User can paste a LinkedIn URL and a job card appears on the Kanban board
- [ ] Job details (title, company, description) are auto-extracted from the URL
- [ ] User can drag cards between Kanban columns — status persists after refresh
- [ ] User can open a job detail page and see all real data
- [ ] User can toggle milestones — progress bar updates and persists
- [ ] User can add notes and tags — they persist after refresh
- [ ] User can record an outcome — it persists
- [ ] Activity timeline shows real events
- [ ] Empty states work correctly (new user sees helpful prompts)
- [ ] `sampleJobs` is completely deleted from the codebase

---

## 6. Phase 3 — AI-Powered Features (Weeks 6–7)

**Goal:** The core AI features work end-to-end: contact discovery, outreach generation, and follow-up generation.

### 6.1 Ahmed's Tasks (Backend + AI)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| A3.1 | **Set up Azure AI Foundry** | Create AI Foundry resource. Set up the first Prompt Flow for outreach generation. Test with sample inputs. | AI Foundry running |
| A3.2 | **Set up Service Bus queues** | Create queues: `contact-discovery`, `outreach-generation`, `follow-up-generation`. Set up dead-letter queues for failed jobs. | Queues created |
| A3.3 | **Build Worker service** | Create the worker process that listens to Service Bus queues. It should: pick up a message, update workflow_run status to "processing", call AI Foundry, save results to DB, update status to "completed" (or "failed" with error). | Worker processing jobs |
| A3.4 | **Implement contact discovery endpoint** | `POST /jobs/:id/contacts/discover` — create workflow_run, enqueue contact discovery job. Worker uses AI to find contacts. Save contacts to DB. Return workflow_run_id for polling. | Contact discovery E2E |
| A3.5 | **Implement outreach generation endpoint** | `POST /jobs/:id/outreach/generate` — requires selected contact. Enqueue outreach generation job. Worker generates personalized message using job data + contact data + user resume context. Save message as draft. | Outreach generation E2E |
| A3.6 | **Implement follow-up generation endpoint** | `POST /jobs/:id/follow-up/generate` — generate follow-up message based on original outreach + time elapsed. Save to follow_ups table. | Follow-up generation E2E |
| A3.7 | **Implement workflow status polling** | `GET /workflow-runs/:id` — return current status of an async job (queued/processing/completed/failed). Include progress percentage if available. | Polling endpoint working |
| A3.8 | **Implement outreach CRUD** | `GET /jobs/:id/outreach` — return all outreach messages for a job. `PATCH /jobs/:id/outreach/:messageId` — update message text, mark as sent. | Outreach CRUD working |
| A3.9 | **Implement follow-up CRUD** | `GET /jobs/:id/follow-up` — return follow-up for a job. `PATCH /jobs/:id/follow-up` — update message, mark as sent, change date. | Follow-up CRUD working |
| A3.10 | **Build AI prompts** | Design and test prompts for: (1) Contact discovery — "Given company X and job title Y, find relevant contacts." (2) Outreach generation — "Given this job, this contact, and this user's background, write a personalized outreach message." (3) Follow-up — "Given this original outreach sent N days ago with no reply, write a follow-up." | Prompts tested and saved in AI Foundry |

### 6.2 Mohamed's Tasks (Frontend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| M3.1 | **Wire up Contact Discovery** | "Find Contacts" button calls `POST /jobs/:id/contacts/discover`. Show loading spinner ("Discovering contacts..."). Poll `GET /workflow-runs/:id` until complete. On completion, refetch contacts and display them. | Contact discovery UI working |
| M3.2 | **Wire up contact selection** | Selecting a contact calls `PATCH /jobs/:id { selectedContactId }`. Update milestone "contactSelected" automatically. | Contact selection persists |
| M3.3 | **Wire up Outreach Builder** | "Generate Outreach" button calls `POST /jobs/:id/outreach/generate`. Poll for completion. Display generated message in the text area. Allow editing. "Copy" copies to clipboard. "Mark as Sent" calls `PATCH /jobs/:id/outreach/:messageId { sentAt: now() }` and updates `outreachMarkedSent` flag. | Outreach builder fully functional |
| M3.4 | **Wire up Follow-Up Scheduler** | Show follow-up section after outreach is marked sent. "Generate Follow-Up" calls `POST /jobs/:id/follow-up/generate`. Display recommended date and message. "Copy" and "Mark as Sent" work like outreach. | Follow-up scheduler functional |
| M3.5 | **Build async job loading UX** | Create a reusable component for async AI operations: shows progress indicator, "Generating..." text, estimated time, handles failure with retry button. Use this for all AI features. | Reusable async loader component |
| M3.6 | **Handle AI failures gracefully** | If AI generation fails: show error message, allow retry, don't lose any user data. If contact discovery returns 0 contacts: show "No contacts found — try adding manually." | Error states for all AI features |

### Phase 3 Exit Criteria
- [ ] User clicks "Find Contacts" → sees a loading state → contacts appear
- [ ] User selects a contact → milestone updates → outreach section unlocks
- [ ] User clicks "Generate Outreach" → loading state → personalized message appears
- [ ] User can edit the message, copy it, and mark it as sent
- [ ] After marking outreach as sent, follow-up section appears with suggested date
- [ ] User can generate a follow-up message
- [ ] All generated content persists in the database
- [ ] AI failures show clear error messages with retry options
- [ ] Async operations don't block the UI (user can navigate away and come back)

---

## 7. Phase 4 — Dashboard, Inbox & Polish (Weeks 8–9)

**Goal:** Dashboard shows real metrics, Inbox shows real action items, and the overall UX is polished.

### 7.1 Ahmed's Tasks (Backend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| A4.1 | **Implement dashboard stats endpoint** | `GET /dashboard/stats` — aggregate: daily goal + completed today (jobs where any milestone was toggled today), coffee chats (jobs that reached "Meeting Booked"), total tasks (pending inbox actions), completed tasks. Return as single JSON response. | Dashboard endpoint working |
| A4.2 | **Implement inbox actions endpoint** | `GET /inbox/actions` — compute action items from the user's jobs. Logic: job without selected contact → "Find Contacts" action, job with contact but no draft → "Generate Outreach" action, etc. Support `?category=priority|waiting|setup`. | Inbox endpoint working |
| A4.3 | **Implement inbox action state** | `PATCH /inbox/actions/:actionKey` — accept `{ is_snoozed, snoozed_until, is_completed }`. Save to `inbox_action_states` table. These override computed state. | Snooze/complete persists |
| A4.4 | **Implement file upload (resume)** | `POST /users/me/resume` — accept file upload (PDF/DOCX, max 10MB). Store in Azure Blob Storage under `resumes/{user_id}/`. Save metadata in DB. `GET /users/me/resume` — return pre-signed download URL. | Resume upload working |
| A4.5 | **Implement search** | Add full-text search to `GET /jobs?search=X` — search across job title, company, and description. Use PostgreSQL `ILIKE` or `tsvector` for performance. | Search working |

### 7.2 Mohamed's Tasks (Frontend)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| M4.1 | **Wire up Dashboard cards** | Replace hardcoded values: `DailyGoalCard` gets `goal` and `completed` from API. `MetricsCard` gets real coffee chat and interview counts. `TasksCard` gets real task counts. | Dashboard shows real data |
| M4.2 | **Wire up Inbox** | Replace `generateInboxActionsFromJobs(sampleJobs)` with `useQuery("inbox", fetchInboxActions)`. Wire snooze and mark-done buttons to API. | Inbox shows real actions |
| M4.3 | **Wire up Inbox Preview (Dashboard)** | The dashboard's inbox preview fetches from `GET /inbox/actions?limit=5`. | Dashboard inbox preview real |
| M4.4 | **Wire up Jobs Preview (Dashboard)** | The dashboard's jobs preview fetches from `GET /jobs?limit=5&sort=updated_at`. | Dashboard jobs preview real |
| M4.5 | **Build Resume upload UI** | New section in Settings page (or separate `/resume` page). Drag-and-drop or file picker for PDF/DOCX upload. Show current resume name + "Replace" button. Call `POST /users/me/resume`. | Resume upload working |
| M4.6 | **Wire up search (header)** | The search input in the Header component triggers `GET /jobs?search=X`. Show results in a dropdown or navigate to Jobs page with filter applied. | Search functional |
| M4.7 | **Polish loading states** | Every data-fetching component shows a skeleton loader while loading. No blank screens or layout jumps. | Smooth loading UX |
| M4.8 | **Polish error toasts** | Consistent toast notifications for: success ("Job added!"), error ("Failed to generate outreach"), info ("Follow-up reminder: 3 days until deadline"). | Consistent notifications |
| M4.9 | **Add empty state illustrations** | Design and add empty state graphics for: empty kanban board, empty inbox, no contacts found, no outreach yet. | Engaging empty states |

### Phase 4 Exit Criteria
- [ ] Dashboard shows real metrics derived from actual user data
- [ ] Inbox shows AI-computed action items based on job states
- [ ] Snooze and mark-done work and persist
- [ ] User can upload a resume
- [ ] Search works across jobs
- [ ] No loading flicker or blank states
- [ ] Error messages are helpful and actionable

---

## 8. Phase 5 — Advanced Features & Pitch Deck (Week 10)

**Goal:** Pitch deck generation via Gamma API and flash card generation are working.

### 8.1 Ahmed's Tasks

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| A5.1 | **Integrate Gamma API** | Set up Gamma API integration. Worker receives structured slide content from AI Foundry, sends to Gamma, receives deck URL/file. Store URL in DB, file in Blob Storage. | Gamma integration working |
| A5.2 | **Implement pitch deck endpoint** | `POST /jobs/:id/pitch-deck/generate` — enqueue pitch deck generation job. `GET /jobs/:id/pitch-deck` — return deck URL/status. | Pitch deck E2E |
| A5.3 | **Implement flash cards endpoint** | `POST /jobs/:id/flash-cards/generate` — enqueue flash card generation. `GET /jobs/:id/flash-cards` — return generated cards. | Flash cards E2E |
| A5.4 | **Build AI prompt for pitch deck content** | Design prompt: "Given this user's resume and this job/company, generate structured slide content for a 5-slide pitch deck: Intro, Experience Match, Value Proposition, Mutual Fit, Call to Action." | Prompt tested |
| A5.5 | **Build AI prompt for flash cards** | Design prompt: "Given this job posting and company research, generate 10 Q&A flash cards to help the user prepare for a coffee chat." | Prompt tested |

### 8.2 Mohamed's Tasks

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| M5.1 | **Wire up Pitch Deck Panel** | "Generate Pitch Deck" button triggers the flow. Poll for completion. Show "Download PDF" button with pre-signed Blob URL. Show deck preview if possible. | Pitch deck UI working |
| M5.2 | **Wire up Flash Cards Panel** | "Generate Flash Cards" button triggers the flow. Display cards in a flip-card UI. Allow marking cards as "reviewed." | Flash cards UI working |
| M5.3 | **Add notification bell** | Show unread notification count in header. Notifications for: AI generation completed, follow-up due dates approaching. Pop-out panel or dropdown showing recent notifications. | Notifications working |

### Phase 5 Exit Criteria
- [ ] User can generate a pitch deck and download it as PDF
- [ ] User can generate flash cards and flip through them
- [ ] Notification bell shows relevant alerts

---

## 9. Phase 6 — QA, Staging & Launch Prep (Weeks 11–12)

**Goal:** Everything works end-to-end on staging, bugs are fixed, and the product is ready for real users.

### 9.1 Joint Tasks

| # | Task | Owner | Details |
|---|------|-------|---------|
| Q1 | **End-to-end testing on staging** | Both | Create test accounts. Walk through every flow: signup → add job → find contacts → generate outreach → mark sent → follow-up → outcome. Document bugs. |
| Q2 | **Performance testing** | Ahmed | Test with 50+ jobs per user. Verify: Kanban loads in < 2s, search returns in < 500ms, AI generation completes in < 30s. |
| Q3 | **Security review** | Ahmed | Verify: RLS works (user A can't see user B's data), JWT expiry works, rate limiting on auth endpoints, no SQL injection, file upload validation. |
| Q4 | **Mobile responsiveness** | Mohamed | Test all pages on mobile viewport. Fix any layout breaks. The sidebar should collapse to a bottom nav or hamburger menu. |
| Q5 | **Cross-browser testing** | Mohamed | Test on Chrome, Firefox, Safari, Edge. Fix any CSS or JS inconsistencies. |
| Q6 | **Error scenario testing** | Both | Test: network offline, API down, AI failure, expired token, invalid job URL, file upload too large. Verify all error states show helpful messages. |
| Q7 | **Production deployment** | Ahmed | Deploy backend to production Container Apps. Deploy frontend to production Static Web Apps. Configure production CORS, production Key Vault secrets, production domain. |
| Q8 | **DNS & SSL** | Ahmed | Point `app.referro.app` to Azure Static Web Apps. Ensure HTTPS. |
| Q9 | **Monitoring setup** | Ahmed | Configure Application Insights alerts for: 5xx spike, high latency, queue buildup, AI failures. |
| Q10 | **Seed demo data** | Both | Create a demo account with pre-populated jobs at various stages for investor demos and user onboarding. |

### Phase 6 Exit Criteria
- [ ] All flows work end-to-end on staging without errors
- [ ] Performance targets met
- [ ] Security review passed
- [ ] Mobile responsive
- [ ] Production deployed and accessible at `app.referro.app`
- [ ] Monitoring and alerting configured
- [ ] Demo account ready

---

## 10. Work Split — Mohamed vs Ahmed

### Summary View

| Phase | Mohamed (Frontend) | Ahmed (Backend) | Joint |
|-------|-------------------|----------------|-------|
| **0: Foundation** | Cleanup dead code, create auth skeleton, loading states | Provision Azure, set up FastAPI, run DB migrations, CI/CD | Agree on API contracts |
| **1: Auth** | Login/Signup pages, AuthContext, protected routes, Settings | Auth endpoints, profile CRUD, JWT middleware, RLS | Test auth flow together |
| **2: Jobs CRUD** | Add Job UI, replace hardcoded data, wire up Kanban, Job Detail | Job CRUD endpoints, URL scraping, milestones, activity log | Integration testing |
| **3: AI Features** | Wire up Contact Discovery, Outreach Builder, Follow-Up | Service Bus, Worker, AI Foundry, AI prompts, outreach CRUD | Test AI flows together |
| **4: Dashboard/Inbox** | Wire up Dashboard, Inbox, Resume upload, Search, polish UX | Dashboard stats, inbox actions, file upload, search | Integration testing |
| **5: Advanced** | Pitch Deck UI, Flash Cards UI, notifications | Gamma API, flash cards endpoint, pitch deck endpoint | Test advanced features |
| **6: QA/Launch** | Mobile, cross-browser, error states | Performance, security, deployment, monitoring | E2E testing together |

### Parallel Work Tracks

```
Week 1:
  Mohamed: M0.1–M0.6 (cleanup, skeletons)
  Ahmed:   A0.1–A0.6 (infra, FastAPI, DB)
  
Week 2–3:
  Mohamed: M1.1–M1.7 (auth UI)
  Ahmed:   A1.1–A1.6 (auth API)
  → Integration point: test login/signup together at end of Week 3

Week 4–5:
  Mohamed: M2.1–M2.12 (jobs UI)
  Ahmed:   A2.1–A2.8 (jobs API + scraping)
  → Integration point: test job creation + kanban at end of Week 5

Week 6–7:
  Mohamed: M3.1–M3.6 (AI UI)
  Ahmed:   A3.1–A3.10 (AI backend + prompts)
  → Integration point: test contact discovery + outreach at end of Week 7

Week 8–9:
  Mohamed: M4.1–M4.9 (dashboard + polish)
  Ahmed:   A4.1–A4.5 (dashboard API + search)
  → Integration point: test full app flow at end of Week 9

Week 10:
  Mohamed: M5.1–M5.3 (pitch deck + flash cards UI)
  Ahmed:   A5.1–A5.5 (Gamma + flash cards API)

Week 11–12:
  Both: QA, bug fixes, launch
```

---

## 11. Daily & Weekly Rituals

### Daily (15 min, async or sync)

| What | How |
|------|-----|
| **Stand-up** | Each person posts in a shared channel (Slack/Discord/WhatsApp): (1) What I did yesterday, (2) What I'm doing today, (3) Any blockers. |
| **PR Review** | Each person reviews the other's PRs within 24 hours. No PR should sit unreviewed for more than 1 business day. |

### Weekly (30 min, sync call)

| What | How |
|------|-----|
| **Integration Check** | Demo what you built this week. Test the integrated flow together. |
| **Contract Sync** | Any API contract changes? If Mohamed needs a new field or Ahmed needs to change a response shape — discuss and agree. |
| **Blocker Resolution** | If someone is blocked waiting for the other, this is where it gets resolved. |
| **Next Week Plan** | Review what's coming next week. Any dependencies? Any scope changes? |

### Bi-Weekly (end of each phase)

| What | How |
|------|-----|
| **Phase Retrospective** | What went well? What didn't? What do we change for next phase? |
| **Milestone Check** | Review exit criteria. Did we hit them all? If not, what carries over? |

---

## 12. Dependency Map — What Blocks What

Understanding what blocks what prevents wasted time.

```
A0.3 (DB migrations) ──────────────► A1.1 (Auth endpoints)
                                          │
                                          ▼
M1.1 (Login page) ◄─────────────── A1.1 (Auth API ready)
                                          │
                                          ▼
M2.2 (Replace hardcoded data) ◄──── A2.2 (Job list endpoint ready)
                                          │
                                          ▼
M2.1 (Add Job UI) ◄───────────────── A2.1 (Job creation + scraping ready)
                                          │
A3.1 (AI Foundry setup) ──────────► A3.4 (Contact discovery endpoint)
                                          │
                                          ▼
M3.1 (Contact Discovery UI) ◄───── A3.4 (Contact discovery ready)
                                          │
M3.3 (Outreach Builder UI) ◄────── A3.5 (Outreach generation ready)
                                          │
A5.1 (Gamma API) ─────────────────► A5.2 (Pitch deck endpoint)
                                          │
                                          ▼
M5.1 (Pitch Deck UI) ◄──────────── A5.2 (Pitch deck endpoint ready)
```

### How to Avoid Blocking

| Situation | Solution |
|-----------|----------|
| Mohamed needs an endpoint that Ahmed hasn't built yet | Mohamed uses mock data (return hardcoded response from `src/lib/api.ts`). When Ahmed deploys the real endpoint, Mohamed changes 1 line (the URL). |
| Ahmed needs to know what data the frontend needs | Ahmed checks the API contract doc. If unclear, asks Mohamed in daily standup. |
| AI features take longer than expected | Mohamed builds the UI with mock AI responses. Ahmed swaps in real AI when ready. User experience is identical. |
| Scraping is unreliable | Ahmed implements a fallback: if scraping fails, return a "partial" job where user manually fills in title/company. Mohamed builds the fallback UI. |

---

## 13. Risk Register & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | LinkedIn blocks scraping | High | High | Use Firecrawl (handles anti-bot). Fallback: ask user to paste job title + company manually if scraping fails. |
| 2 | AI-generated outreach quality is low | Medium | High | Test prompts extensively with diverse job types. Allow users to edit all generated content. Iterate on prompts based on feedback. |
| 3 | Gamma API is unreliable or expensive | Medium | Medium | Make pitch deck a "nice to have." If Gamma is down, show "Pitch deck generation temporarily unavailable." |
| 4 | Azure Service Bus adds complexity | Low | Medium | Start with synchronous AI calls in V1 (user waits 5–10s). Move to async with Service Bus only if latency is unacceptable. |
| 5 | One co-founder falls behind | Medium | High | Tasks are designed to be independent. If one person is behind, the other can pick up some of their tasks (Mohamed can write simple endpoints, Ahmed can fix frontend bugs). |
| 6 | Scope creep | High | High | Stick to V1 scope. Any new idea goes into a "V2 Ideas" document, not into the current sprint. |
| 7 | JWT token management issues | Low | Medium | Use short-lived access tokens (15 min) + long-lived refresh tokens (7 days). Test token refresh flow thoroughly. |

---

## 14. Definition of Done (DoD)

A task is **not done** until ALL of the following are true:

### For Backend (Ahmed)

- [ ] Endpoint works as specified in the API contract
- [ ] Returns correct status codes (200, 201, 400, 401, 403, 404, 500)
- [ ] Returns correct error messages for all failure cases
- [ ] RLS prevents cross-user data access
- [ ] Input validation rejects invalid data
- [ ] Activity log entries created where applicable
- [ ] Tested via Postman/curl with real tokens
- [ ] Code reviewed and approved by Mohamed
- [ ] Deployed to staging

### For Frontend (Mohamed)

- [ ] Component renders correctly with real API data
- [ ] Loading state shows skeleton/spinner
- [ ] Error state shows helpful message
- [ ] Empty state shows helpful prompt
- [ ] Data persists after page refresh
- [ ] Works on Chrome, Firefox, Safari
- [ ] No console errors or warnings
- [ ] Code reviewed and approved by Ahmed
- [ ] Deployed to staging

---

## 15. Handoff Points Between Mohamed & Ahmed

These are the critical moments where one person's work depends on the other's.

| # | When | What Mohamed Needs | What Ahmed Delivers | How to Handoff |
|---|------|-------------------|--------------------|---------------|
| H1 | End of Week 1 | API contract finalized | Swagger docs URL | Shared document / Swagger link |
| H2 | Mid Week 2 | Auth endpoints deployed | `POST /auth/signup`, `/login`, `/me` on staging | Slack message: "Auth endpoints live on staging, here's the base URL" |
| H3 | Mid Week 4 | Job CRUD deployed | `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id` on staging | Slack message + Postman collection |
| H4 | Mid Week 6 | AI endpoints deployed | `POST /jobs/:id/contacts/discover`, `/outreach/generate` on staging | Slack message + example responses |
| H5 | Mid Week 8 | Dashboard endpoint deployed | `GET /dashboard/stats`, `GET /inbox/actions` on staging | Slack message |
| H6 | Mid Week 10 | Pitch deck endpoint deployed | `POST /jobs/:id/pitch-deck/generate`, `GET /jobs/:id/pitch-deck` on staging | Slack message |

**Handoff Protocol:**
1. Ahmed deploys endpoint to staging
2. Ahmed sends a message: "Endpoint X is live. Here's the URL, here's a sample request/response, here are the known limitations."
3. Mohamed tests the endpoint with Postman/curl first
4. Mohamed integrates into the frontend
5. Both test together at the weekly integration check

---

## Appendix: Quick Reference — What Goes Where

| I need to... | File / Service | Owner |
|-------------|---------------|-------|
| Add a new page | `src/pages/NewPage.tsx` + route in `App.tsx` | Mohamed |
| Add a new API endpoint | `app/routers/new_router.py` + register in `app/main.py` | Ahmed |
| Add a new database table | Alembic migration in `migrations/versions/` | Ahmed |
| Add a new UI component | `src/components/NewComponent.tsx` | Mohamed |
| Add a new AI prompt | Azure AI Foundry console | Ahmed (shared review) |
| Add a new background job | New Service Bus queue + worker handler | Ahmed |
| Change API contract | Update Swagger + notify the other person | Both agree first |
| Add a new secret | Azure Key Vault + environment config | Ahmed |
| Fix a CSS bug | Relevant `.tsx` file | Mohamed |
| Fix a data bug | Relevant endpoint or DB query | Ahmed |

---

**This document is the single plan of record. Both Mohamed and Ahmed should reference it weekly. Update it as scope changes — but never without both agreeing.**

---

**END OF DOCUMENT**
