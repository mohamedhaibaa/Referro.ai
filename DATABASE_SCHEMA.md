# Referro V1 — Database Schema

> **Purpose**: This is the single source of truth for every database table, column, relationship, and index in Referro V1. Use this document when implementing migrations AND when writing any backend or frontend code that touches the database.

---

## Entity Relationship Overview

```
users
  ├── jobs (1:many)
  │     ├── job_milestones (1:1)
  │     ├── contacts (1:many)
  │     │     └── outreach_messages (1:many)
  │     ├── follow_ups (1:many)
  │     ├── notes (1:many)
  │     ├── tags (many:many via job_tags)
  │     ├── activity_log (1:many)
  │     ├── pitch_decks (1:many)
  │     ├── flash_cards (1:many)
  │     └── outcomes (1:1)
  ├── resumes (1:many)
  └── inbox_items (1:many)
```

---

## Table Definitions

### 1. `users`

The authenticated user. Created on sign-up.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| `name` | VARCHAR(255) | NOT NULL | Display name (from sign-up) |
| `avatar_url` | TEXT | NULLABLE | Profile picture URL |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | Auto-updated via trigger |

**Indexes**: `users_email_idx` on `email`
**RLS**: Users can only read/update their own row.

---

### 2. `jobs`

Core entity. One row per job the user is tracking. Maps directly to a Kanban card and the Job Detail page.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `user_id` | UUID | FK → users.id, NOT NULL | Owner |
| `title` | VARCHAR(255) | NOT NULL | e.g. "Senior Product Manager" |
| `company` | VARCHAR(255) | NOT NULL | e.g. "Google" |
| `company_logo_url` | TEXT | NULLABLE | Auto-fetched or user-uploaded |
| `url` | TEXT | NOT NULL | Original job posting URL (LinkedIn etc.) |
| `description` | TEXT | NULLABLE | Parsed from job posting or user-entered |
| `status` | VARCHAR(50) | NOT NULL, default 'Interested' | See `JobStatus` enum below |
| `fit_score` | VARCHAR(10) | NULLABLE | 'High', 'Medium', 'Low', or NULL |
| `work_mode` | VARCHAR(20) | NULLABLE | 'Remote', 'Hybrid', 'On-site' |
| `role_family` | VARCHAR(20) | NULLABLE | 'PM', 'SWE', 'DS', 'Design', 'Other' |
| `due_date` | DATE | NULLABLE | Application deadline |
| `progress` | INTEGER | NOT NULL, default 0 | 0-100, computed from milestones |
| `is_deleted` | BOOLEAN | NOT NULL, default false | Soft delete |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Valid `status` values** (matches `JobStatus` type in `src/types/job.ts`):
```
Interested → Outreach Ready → Outreach Sent → Replied → Meeting Booked → Interviewing → Offer → Closed
```

**Indexes**:
- `jobs_user_id_idx` on `user_id`
- `jobs_status_idx` on `user_id, status` (Kanban column queries)
- `jobs_created_at_idx` on `user_id, created_at DESC` (recent jobs)

**RLS**: Users can only CRUD their own jobs.

---

### 3. `job_milestones`

One row per job. Tracks the 10 boolean milestones shown in the ProgressTracker component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, UNIQUE, NOT NULL | One milestone row per job |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `resume_tailored` | BOOLEAN | NOT NULL, default false | |
| `contact_selected` | BOOLEAN | NOT NULL, default false | |
| `outreach_sent` | BOOLEAN | NOT NULL, default false | |
| `follow_up_sent` | BOOLEAN | NOT NULL, default false | |
| `reply_received` | BOOLEAN | NOT NULL, default false | |
| `interview_scheduled` | BOOLEAN | NOT NULL, default false | |
| `interview_prep_1` | BOOLEAN | NOT NULL, default false | |
| `interview_prep_2` | BOOLEAN | NOT NULL, default false | |
| `interview_prep_3` | BOOLEAN | NOT NULL, default false | |
| `outcome_recorded` | BOOLEAN | NOT NULL, default false | |

**Indexes**: `job_milestones_job_id_idx` on `job_id`
**RLS**: Users can only access milestones for their own jobs.
**Trigger**: When milestones change → recalculate `jobs.progress` automatically.

---

### 4. `contacts`

People discovered (by AI or manually) for a specific job. Shown in the ContactDiscovery component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | Which job this contact is for |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `name` | VARCHAR(255) | NOT NULL | e.g. "Sarah Chen" |
| `title` | VARCHAR(255) | NOT NULL | e.g. "Senior Recruiter" |
| `relationship` | VARCHAR(50) | NOT NULL | 'Recruiter', 'Hiring Manager', 'Team Lead', 'Employee' |
| `confidence` | VARCHAR(10) | NOT NULL | 'High', 'Medium', 'Low' |
| `source` | VARCHAR(100) | NOT NULL | e.g. "LinkedIn", "Company website" |
| `profile_url` | TEXT | NULLABLE | LinkedIn profile URL |
| `is_selected` | BOOLEAN | NOT NULL, default false | User chose this contact for outreach |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**:
- `contacts_job_id_idx` on `job_id`
- `contacts_user_id_idx` on `user_id`

**RLS**: Users can only access contacts for their own jobs.
**Side effect**: When `is_selected` is set to true → set `job_milestones.contact_selected = true` and update `jobs.status` to 'Outreach Ready' if currently 'Interested'.

---

### 5. `outreach_messages`

Messages generated (by AI) or written manually for a contact. Shown in the OutreachBuilder component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `contact_id` | UUID | FK → contacts.id, NOT NULL | Which contact this message is for |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `message` | TEXT | NOT NULL | The outreach message body |
| `type` | VARCHAR(20) | NOT NULL | 'initial' or 'followup' |
| `is_ai_generated` | BOOLEAN | NOT NULL, default false | Whether AI wrote this |
| `sent_at` | TIMESTAMPTZ | NULLABLE | NULL = draft, set when user marks as sent |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**:
- `outreach_job_id_idx` on `job_id`
- `outreach_contact_id_idx` on `contact_id`

**RLS**: Users can only access their own outreach messages.
**Side effects**:
- When initial message `sent_at` is set → `job_milestones.outreach_sent = true`, `jobs.status = 'Outreach Sent'`
- When followup message `sent_at` is set → `job_milestones.follow_up_sent = true`

---

### 6. `follow_ups`

Scheduled follow-up reminders. Shown in the FollowUpScheduler component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `recommended_date` | DATE | NOT NULL | When to follow up |
| `message` | TEXT | NOT NULL | AI-generated or user-written follow-up text |
| `sent` | BOOLEAN | NOT NULL, default false | |
| `sent_at` | TIMESTAMPTZ | NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**:
- `follow_ups_job_id_idx` on `job_id`
- `follow_ups_due_idx` on `user_id, recommended_date` WHERE `sent = false` (for inbox generation)

**RLS**: Users can only access their own follow-ups.

---

### 7. `notes`

Free-text notes per job. Shown in the NotesAttachments component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `content` | TEXT | NOT NULL | The note text |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: `notes_job_id_idx` on `job_id`
**RLS**: Users can only access notes for their own jobs.

---

### 8. `tags`

Reusable tags that users can apply to jobs. Shown as chips in NotesAttachments.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `user_id` | UUID | FK → users.id, NOT NULL | Each user has their own tag library |
| `name` | VARCHAR(100) | NOT NULL | e.g. "Dream job", "High priority" |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique constraint**: `tags_user_name_uniq` on `(user_id, name)` — no duplicate tag names per user.
**RLS**: Users can only access their own tags.

---

### 9. `job_tags`

Join table for many-to-many between jobs and tags.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `tag_id` | UUID | FK → tags.id, NOT NULL | |

**Primary key**: `(job_id, tag_id)`
**RLS**: Inherits from jobs — users can only tag their own jobs.

---

### 10. `activity_log`

Immutable event log for each job. Shown in the ActivityTimeline component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `action` | VARCHAR(255) | NOT NULL | e.g. "Job added", "Outreach sent", "Reply received" |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | The timestamp shown in the UI |

**Indexes**: `activity_log_job_id_idx` on `job_id, created_at DESC`
**RLS**: Users can only read activity for their own jobs.
**Usage**: Every mutation (status change, milestone toggle, outreach sent, etc.) inserts a row here. This table is append-only — never update or delete.

---

### 11. `pitch_decks`

Generated pitch decks via Gamma API. Shown in PitchDeckPanel.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `gamma_url` | TEXT | NULLABLE | URL returned by Gamma API |
| `slides` | JSONB | NULLABLE | Slide structure for preview (array of {title, content}) |
| `status` | VARCHAR(20) | NOT NULL, default 'pending' | 'pending', 'generating', 'completed', 'failed' |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: `pitch_decks_job_id_idx` on `job_id`
**RLS**: Users can only access their own pitch decks.

---

### 12. `flash_cards`

AI-generated Q&A cards for interview prep. Shown in FlashCardsPanel.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `title` | VARCHAR(255) | NOT NULL | The question, e.g. "Tell me about yourself" |
| `strength` | TEXT | NOT NULL | Key strength this card demonstrates |
| `evidence` | TEXT | NOT NULL | Concrete evidence/example |
| `impact` | TEXT | NOT NULL | Why it matters |
| `sort_order` | INTEGER | NOT NULL, default 0 | Display order |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: `flash_cards_job_id_idx` on `job_id`
**RLS**: Users can only access their own flash cards.

---

### 13. `outcomes`

Final outcome for a closed job. Shown in the OutcomeSection component.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `job_id` | UUID | FK → jobs.id, UNIQUE, NOT NULL | One outcome per job |
| `user_id` | UUID | FK → users.id, NOT NULL | For RLS |
| `result` | VARCHAR(20) | NOT NULL | 'Offer', 'Rejected', 'Withdrew', 'No response' |
| `reflection` | TEXT | NULLABLE | User's notes on what worked/didn't |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: `outcomes_job_id_idx` on `job_id`
**RLS**: Users can only access outcomes for their own jobs.
**Side effect**: When created → `job_milestones.outcome_recorded = true`, `jobs.status = 'Closed'` (if result is Rejected/Withdrew/No response) or `jobs.status = 'Offer'` (if result is Offer).

---

### 14. `resumes`

Uploaded resume files. Used as AI context for outreach generation, pitch decks, and flash cards.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `file_url` | TEXT | NOT NULL | Azure Blob Storage URL |
| `original_name` | VARCHAR(255) | NOT NULL | e.g. "Mohamed_Resume_2025.pdf" |
| `file_size` | INTEGER | NOT NULL | Bytes |
| `mime_type` | VARCHAR(100) | NOT NULL | 'application/pdf' or 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' |
| `extracted_text` | TEXT | NULLABLE | Parsed text content for AI context |
| `is_active` | BOOLEAN | NOT NULL, default true | Only one active resume at a time |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: `resumes_user_id_idx` on `user_id`
**RLS**: Users can only access their own resumes.
**Logic**: When a new resume is uploaded, set all previous resumes to `is_active = false`.

---

### 15. `inbox_items`

Actionable notifications generated by the system. Shown in Inbox page and InboxPreview on dashboard.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `job_id` | UUID | FK → jobs.id, NULLABLE | Which job this relates to (NULL for system messages) |
| `type` | VARCHAR(50) | NOT NULL | Matches `InboxActionType` — see below |
| `title` | VARCHAR(255) | NOT NULL | e.g. "Find contacts — Google (Senior PM)" |
| `subtitle_tag` | VARCHAR(50) | NOT NULL | e.g. "Setup", "Outreach", "Follow-up" |
| `category` | VARCHAR(20) | NOT NULL | 'priority', 'waiting', 'setup' |
| `is_completed` | BOOLEAN | NOT NULL, default false | User completed the action |
| `is_snoozed` | BOOLEAN | NOT NULL, default false | User snoozed this item |
| `snoozed_until` | TIMESTAMPTZ | NULLABLE | When to un-snooze |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Valid `type` values** (matches `InboxActionType` in `src/types/inbox.ts`):
```
FIND_CONTACTS, GENERATE_OUTREACH, SEND_OUTREACH, LOG_REPLY,
INTERVIEW_PREP, WAITING_NUDGE, RATE_FIT, PREP_MEETING
```

**Indexes**:
- `inbox_user_id_idx` on `user_id, created_at DESC`
- `inbox_active_idx` on `user_id` WHERE `is_completed = false AND is_snoozed = false` (dashboard query)

**RLS**: Users can only access their own inbox items.

---

### 16. `workflow_runs`

Tracks async AI jobs (contact discovery, outreach generation, pitch deck, flash cards). Used by Service Bus workers and polled by the frontend for status.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `job_id` | UUID | FK → jobs.id, NULLABLE | Which job triggered this |
| `type` | VARCHAR(50) | NOT NULL | 'contact_discovery', 'outreach_generation', 'pitch_deck', 'flash_cards', 'resume_parse' |
| `status` | VARCHAR(20) | NOT NULL, default 'queued' | 'queued', 'running', 'completed', 'failed' |
| `input_data` | JSONB | NULLABLE | Parameters sent to the AI |
| `output_data` | JSONB | NULLABLE | Result from the AI (or error message) |
| `started_at` | TIMESTAMPTZ | NULLABLE | |
| `completed_at` | TIMESTAMPTZ | NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**:
- `workflow_runs_user_id_idx` on `user_id`
- `workflow_runs_status_idx` on `status` WHERE `status IN ('queued', 'running')` (worker polling)

**RLS**: Users can only access their own workflow runs.

---

## Computed / Derived Data (Not Stored)

These values are computed at query time or in the API layer — they do NOT have their own tables:

| Data | Source | Used By |
|------|--------|---------|
| `job.hasSelectedContact` | `EXISTS (SELECT 1 FROM contacts WHERE job_id = ? AND is_selected = true)` | JobRow, Kanban, getNextStepLabel() |
| `job.hasOutreachDraft` | `EXISTS (SELECT 1 FROM outreach_messages WHERE job_id = ? AND type = 'initial')` | JobRow, Kanban, getNextStepLabel() |
| `job.outreachMarkedSent` | `EXISTS (SELECT 1 FROM outreach_messages WHERE job_id = ? AND type = 'initial' AND sent_at IS NOT NULL)` | JobRow, Kanban, getNextStepLabel() |
| `job.progress` | Count of true milestones / 10 × 100 | ProgressTracker, KanbanCard |
| Dashboard `daily_goal` | Count of activity_log entries today | DailyGoalCard |
| Dashboard `coffee_chats` | Count of jobs with status = 'Meeting Booked' | MetricsCard |
| Dashboard `interviews` | Count of jobs with status = 'Interviewing' | MetricsCard |
| Dashboard `tasks` | Sum of false milestones across active jobs | TasksCard |

---

## Cascade Delete Rules

When a job is deleted (soft delete via `is_deleted = true`), associated data is NOT deleted — it's simply hidden by queries that filter `WHERE jobs.is_deleted = false`.

If a job is hard-deleted (admin/cleanup only):
- `job_milestones` → CASCADE
- `contacts` → CASCADE → `outreach_messages` → CASCADE
- `follow_ups` → CASCADE
- `notes` → CASCADE
- `job_tags` → CASCADE
- `activity_log` → CASCADE
- `pitch_decks` → CASCADE
- `flash_cards` → CASCADE
- `outcomes` → CASCADE
- `inbox_items` → SET NULL on `job_id`
- `workflow_runs` → SET NULL on `job_id`

---

## Migration Order

Tables must be created in this order to satisfy foreign key dependencies:

1. `users`
2. `jobs`
3. `job_milestones`
4. `contacts`
5. `outreach_messages`
6. `follow_ups`
7. `notes`
8. `tags`
9. `job_tags`
10. `activity_log`
11. `pitch_decks`
12. `flash_cards`
13. `outcomes`
14. `resumes`
15. `inbox_items`
16. `workflow_runs`

---

## Type Mapping to Frontend

| Database Table | Frontend Type | File |
|----------------|---------------|------|
| `jobs` + `job_milestones` | `Job` | `src/types/job.ts` |
| `contacts` | `Contact` | `src/types/job.ts` |
| `outreach_messages` | `OutreachMessage` | `src/types/job.ts` |
| `follow_ups` | `FollowUp` | `src/types/job.ts` |
| `activity_log` | `ActivityItem` | `src/types/job.ts` |
| `inbox_items` | `InboxAction` | `src/types/inbox.ts` |
| `flash_cards` | `FlashCard` (local in FlashCardsPanel) | `src/components/job-detail/FlashCardsPanel.tsx` |

---

*Last updated: 2026-02-27*
