# Referro V1 — Execution Plan

> **CTO Directive**: This is the full build plan from hard-coded UI → production-ready product.
> Mohamed and Ahmed are both full-stack. Work is split by **feature ownership**, not by frontend/backend.
> Whoever owns a feature builds it end-to-end: UI wiring, API endpoint, database table, AI integration — all of it.

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
- Feature branches: `feat/job-creation`, `feat/auth-flow`, etc.
- Commit format: `feat:`, `fix:`, `chore:`, `refactor:`
- Every PR needs 1 approval before merge
- Squash and merge for features, regular merge for hotfixes
- Pull `develop` into your branch daily to avoid drift

---

## Phase 0 — Foundation (Week 1)

**Goal**: Auth works, database exists, frontend talks to backend. Nothing fancy, just the pipes.

### Mohamed — Auth & Frontend Wiring
1. **Set up authentication pages**
   - Build `/login` and `/signup` pages using the existing design system
   - Add protected route wrapper that redirects unauthenticated users to `/login`
   - Wire the Sidebar's "Log out" button to actually log out
   - Store auth token, attach it to all API requests

2. **Create the API client layer**
   - Build `src/lib/api.ts` — a single file with all API call functions
   - Every function returns typed data matching our existing TypeScript types
   - Include auth token in headers automatically
   - Handle 401 (redirect to login), 500 (show toast), network errors

3. **Set up React Query for all data fetching**
   - Create query hooks: `useJobs()`, `useJob(id)`, `useInbox()`, `useDashboardMetrics()`
   - These hooks replace the current `useState` with `sampleJobs`
   - Until the real API exists, these can return the sample data as fallback

### Ahmed — Backend & Database Foundation
1. **Set up FastAPI project structure**
   - `/api/auth/` — register, login, refresh, logout
   - `/api/jobs/` — CRUD
   - `/api/contacts/` — per-job contacts
   - `/api/outreach/` — messages
   - `/api/inbox/` — notifications
   - `/api/dashboard/` — aggregated metrics
   - JWT-based auth with refresh tokens

2. **Create all database tables**
   - `users` — id, email, name, created_at
   - `jobs` — id, user_id, title, company, url, status, description, fit_score, work_mode, role_family, due_date, progress, created_at, updated_at
   - `contacts` — id, job_id, user_id, name, title, relationship, confidence, source, profile_url, selected
   - `outreach_messages` — id, job_id, contact_id, user_id, message, type, sent_at, created_at
   - `follow_ups` — id, job_id, user_id, recommended_date, message, sent, sent_at
   - `notes` — id, job_id, user_id, content, created_at
   - `activity_log` — id, job_id, user_id, action, created_at
   - `inbox_items` — id, user_id, job_id, type, title, preview, is_read, action_url, created_at
   - `resumes` — id, user_id, file_url, original_name, uploaded_at
   - Add proper indexes on user_id, job_id, status, created_at
   - Add RLS policies: users can only access their own data

3. **Deploy bare API**
   - Backend running on Azure Container Apps
   - Database running on Azure PostgreSQL
   - Auth endpoints working (register + login return JWT)
   - One test endpoint: `GET /api/jobs` returns empty list for authenticated user

### End of Phase 0 Checkpoint
- [ ] User can sign up, log in, see empty dashboard, log out
- [ ] Frontend makes real API calls (even if most return empty data)
- [ ] Database tables exist with correct schema
- [ ] Both Mohamed and Ahmed can deploy independently

---

## Phase 1 — Job Pipeline (Week 2-3)

**Goal**: Users can add jobs and see them on the Kanban board with real data.

### Mohamed — Job Creation & Kanban
1. **Build the "Add Job" flow**
   - Add a button/input on the Jobs page: "Paste LinkedIn URL"
   - On submit: `POST /api/jobs` with the URL
   - Show loading state while backend parses the URL
   - On success: new job card appears on Kanban board
   - On error: toast with retry option

2. **Connect Kanban board to real data**
   - Replace `sampleJobs` with `useJobs()` hook
   - Kanban columns filter by `job.status`
   - Drag-and-drop updates status via `PATCH /api/jobs/:id`
   - Kanban filters (fitScore, workMode, roleFamily) work on real data

3. **Connect Job Detail page to real data**
   - `useJob(id)` fetches single job
   - Status dropdown calls `PATCH /api/jobs/:id`
   - Progress tracker reads real milestones
   - Milestone toggles call `PATCH /api/jobs/:id/milestones`

### Ahmed — Job API & LinkedIn Parsing
1. **Build job CRUD endpoints**
   - `POST /api/jobs` — accepts `{ url: string }`, parses LinkedIn page, creates job
   - `GET /api/jobs` — returns all jobs for authenticated user
   - `GET /api/jobs/:id` — returns single job with contacts, outreach, follow-ups, notes, activity
   - `PATCH /api/jobs/:id` — update status, milestones, or any field
   - `DELETE /api/jobs/:id` — soft delete

2. **LinkedIn URL parsing**
   - Accept a LinkedIn job URL
   - Use Firecrawl or similar to extract: title, company, description, location, work mode
   - Map extracted data to job schema
   - If parsing fails, create job with URL only and let user fill in details

3. **Activity logging**
   - Every job mutation (status change, milestone toggle, etc.) creates an `activity_log` entry
   - `GET /api/jobs/:id/activity` returns timeline for Job Detail page

### End of Phase 1 Checkpoint
- [ ] User pastes LinkedIn URL → job card appears on Kanban
- [ ] Kanban board shows real jobs from database
- [ ] Job Detail page loads real data
- [ ] Status changes and milestones persist
- [ ] Activity timeline shows real history

---

## Phase 2 — Contact Discovery & Outreach (Week 3-4)

**Goal**: AI finds contacts for a job and generates personalized outreach messages.

### Ahmed — Contact Discovery (AI Integration)
1. **Build AI contact discovery flow**
   - `POST /api/jobs/:id/discover-contacts` — triggers AI workflow
   - Backend sends job title + company + description to Azure AI Foundry
   - AI returns suggested contacts with name, title, relationship type, confidence score
   - Backend saves contacts to `contacts` table
   - Return contacts to frontend

2. **Wire Contact Discovery UI**
   - ContactDiscovery component calls the discovery endpoint
   - Show loading/generating state while AI works
   - Display results with confidence badges
   - "Select" button marks a contact as chosen (`PATCH /api/contacts/:id`)
   - Auto-update milestone: `contactSelected = true`

3. **Set up Azure Service Bus for async AI jobs**
   - Contact discovery can take 10-30 seconds
   - Frontend submits request → gets job ID back immediately
   - Worker picks up job from Service Bus queue
   - Frontend polls `GET /api/jobs/:id/discover-contacts/status` until done
   - Show progress indicator in UI

### Mohamed — Outreach Builder (AI Integration)
1. **Build AI outreach generation flow**
   - `POST /api/outreach/generate` — accepts job_id, contact_id, user resume context
   - Backend calls Azure AI Foundry with: job details, contact info, user background
   - AI returns personalized outreach message
   - Backend saves to `outreach_messages` table
   - Return message to frontend

2. **Wire OutreachBuilder UI**
   - OutreachBuilder component shows generated message
   - User can edit the message inline
   - "Regenerate" button calls the endpoint again
   - "Mark as Sent" button: `PATCH /api/outreach/:id` with sent_at timestamp
   - Auto-update milestone: `outreachSent = true`
   - Auto-update job status to "Outreach Sent"

3. **Wire FollowUpScheduler UI**
   - After outreach is sent, backend suggests follow-up date (7 days later by default)
   - `POST /api/follow-ups` creates follow-up with recommended date and AI-generated message
   - FollowUpScheduler shows the scheduled follow-up
   - "Mark Sent" updates follow-up and milestone

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

### Mohamed — Pitch Deck & Flash Cards
1. **Wire PitchDeckPanel to Gamma API**
   - `POST /api/jobs/:id/pitch-deck` — backend generates structured content via AI, sends to Gamma
   - Backend stores Gamma result URL in database
   - PitchDeckPanel shows generation status and link to completed deck
   - User can regenerate

2. **Wire FlashCardsPanel to AI**
   - `POST /api/jobs/:id/flash-cards` — AI generates Q&A cards based on job + company research
   - Backend saves cards to database
   - FlashCardsPanel renders interactive cards
   - User can flip, rate difficulty, regenerate

3. **Build Resume page**
   - New page at `/resume`
   - Upload resume (PDF/DOCX) → stored in Azure Blob Storage
   - Display current resume with download link
   - Resume is used as context for outreach generation and pitch decks

### Ahmed — Backend for Prep Materials
1. **Pitch deck endpoint**
   - `POST /api/jobs/:id/pitch-deck` — orchestrate: AI generates content → Gamma API creates deck
   - Store result in `pitch_decks` table (job_id, gamma_url, generated_at)
   - Handle Gamma API errors gracefully

2. **Flash cards endpoint**
   - `POST /api/jobs/:id/flash-cards` — AI generates 10-15 Q&A pairs
   - Store in `flash_cards` table (job_id, question, answer, category)
   - `GET /api/jobs/:id/flash-cards` returns all cards

3. **Resume upload endpoint**
   - `POST /api/resumes/upload` — accepts file, stores in Blob Storage
   - Save metadata in `resumes` table
   - `GET /api/resumes/current` — returns latest resume URL
   - Parse resume text for AI context (store extracted text in DB)

### End of Phase 3 Checkpoint
- [ ] Pitch deck generates and links to Gamma output
- [ ] Flash cards generate and are interactive
- [ ] Resume uploads and persists
- [ ] Resume text is extracted and available for AI context
- [ ] All prep materials are per-job and stored in database

---

## Phase 4 — Dashboard & Inbox (Week 5-6)

**Goal**: Dashboard shows real metrics. Inbox shows real notifications.

### Ahmed — Dashboard Metrics API
1. **Build dashboard aggregation endpoint**
   - `GET /api/dashboard` returns:
     - daily_goal: { target, completed } (actions taken today)
     - metrics: { coffee_chats, interviews } (count of jobs in those statuses)
     - tasks: { total, completed } (milestones across all active jobs)
     - recent_jobs: top 5 jobs by last activity
   - All computed from real database queries

2. **Wire Dashboard components**
   - DailyGoalCard reads from `dashboard.daily_goal`
   - MetricsCard reads from `dashboard.metrics`
   - TasksCard reads from `dashboard.tasks`
   - Replace all hard-coded numbers with live data

### Mohamed — Inbox System
1. **Build inbox endpoints**
   - `GET /api/inbox` — returns all inbox items for user, sorted by date
   - `PATCH /api/inbox/:id/read` — mark as read
   - `POST /api/inbox/:id/action` — execute the suggested action (e.g., "Send follow-up")

2. **Generate inbox items automatically**
   - Backend creates inbox items when:
     - A follow-up is due (follow_up.recommended_date <= today && !sent)
     - Contact discovery completes
     - Outreach has been sent but no reply after 7 days
     - A job has been in "Interested" for 3+ days with no action
   - These can be generated by a scheduled worker or on-demand when user opens inbox

3. **Wire Inbox page to real data**
   - InboxPreview on dashboard shows top 3 unread items
   - Full Inbox page shows all items with read/unread state
   - Click an action → executes it and marks item as handled

### End of Phase 4 Checkpoint
- [ ] Dashboard numbers reflect real user data
- [ ] Inbox shows real notifications based on user's pipeline state
- [ ] Inbox actions work (mark sent, open job, etc.)
- [ ] Empty states look good for new users

---

## Phase 5 — Polish & Production (Week 6-7)

**Goal**: Everything works reliably. Ready for real users.

### Both Mohamed & Ahmed
1. **Error handling sweep**
   - Every API call has loading, error, and empty states in the UI
   - Backend returns proper HTTP status codes and error messages
   - Network failures show retry options
   - Session expiry redirects to login gracefully

2. **Performance pass**
   - Add pagination to jobs list and inbox (don't load 1000 jobs at once)
   - Add database query indexes where queries are slow
   - Cache dashboard metrics (refresh every 5 minutes, not every render)
   - Lazy load Job Detail sub-components

3. **Security review**
   - RLS policies verified: user A cannot see user B's data
   - All endpoints require authentication
   - File uploads validated (type, size limits)
   - No secrets in frontend code
   - CORS configured properly

4. **Deployment & CI/CD**
   - GitHub Actions: on push to `develop` → deploy to staging
   - GitHub Actions: on merge to `main` → deploy to production
   - Environment variables properly separated (dev/staging/prod)
   - Azure Application Insights connected for monitoring

5. **Final QA**
   - Full flow test: Sign up → Add job → Discover contacts → Generate outreach → Send → Follow-up → Pitch deck → Flash cards
   - Test with 2+ accounts to verify data isolation
   - Test on different screen sizes (the UI is desktop-first but shouldn't break)
   - Load test: 50 concurrent users hitting the API

### End of Phase 5 Checkpoint
- [ ] Complete flow works end-to-end with no hard-coded data
- [ ] No console errors in production build
- [ ] Monitoring is active and capturing errors
- [ ] CI/CD deploys automatically
- [ ] Product is ready for beta users

---

## Task Assignment Summary

| Phase | Mohamed | Ahmed |
|-------|---------|-------|
| 0 | Auth pages, API client, React Query hooks | FastAPI setup, all DB tables, deploy API |
| 1 | Add Job UI, Kanban wiring, Job Detail wiring | Job CRUD API, LinkedIn parsing, activity log |
| 2 | Outreach Builder UI + AI, Follow-up UI | Contact Discovery AI, Service Bus async |
| 3 | Pitch Deck UI, Flash Cards UI, Resume page | Pitch Deck API + Gamma, Flash Cards API, Resume upload |
| 4 | Inbox system + notifications | Dashboard metrics API + wiring |
| 5 | Both: Error handling, performance, security, QA, deployment |

---

## Critical Dependencies (What Blocks What)

```
Phase 0: Auth ──────────────────► Everything else
Phase 0: DB tables ─────────────► Everything else
Phase 1: Job CRUD ──────────────► Phase 2 (contacts need a job)
Phase 2: Contact Discovery ─────► Phase 2 (outreach needs a contact)
Phase 2: Outreach ──────────────► Phase 4 (inbox needs outreach state)
Phase 3: Resume upload ─────────► Phase 2 (outreach uses resume context, but can work without)
Phase 3: Pitch Deck ────────────► Independent (can be built anytime after Phase 1)
Phase 4: Dashboard ─────────────► Needs Phase 1-2 data to be meaningful
```

**The golden rule**: Phase 0 must be rock-solid before anything else starts. If auth or DB is flaky, everything built on top will be painful.

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

*Last updated: 2026-02-27*
