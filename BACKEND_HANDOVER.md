# Backend Handover / Functional Blueprint

## Jobless - Job Search Management Dashboard

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Frontend-Only (Backend Implementation Required)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Sitemap & Navigation Map](#2-sitemap--navigation-map)
3. [Page-by-Page Breakdown](#3-page-by-page-breakdown)
4. [Component & Feature Breakdown](#4-component--feature-breakdown)
5. [Data & Backend Requirements](#5-data--backend-requirements)
6. [API Contract Draft](#6-api-contract-draft)
7. [State & Hardcoded Data Replacement](#7-state--hardcoded-data-replacement)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Admin / CMS Needs](#9-admin--cms-needs)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Open Questions & Assumptions](#11-open-questions--assumptions)

---

## 1. Project Overview

### 1.1 Purpose

**Jobless** is a job search management dashboard designed to help job seekers:
- Track job applications through a visual pipeline (Kanban board)
- Manage networking outreach and follow-ups
- Prepare for interviews with structured prep workflows
- Schedule and track meetings, coffee chats, and deadlines
- Gamify the job search with daily goals and progress metrics

### 1.2 Problem Solved

Job searching is chaotic and overwhelming. This application transforms the unstructured process into a gamified, organized workflow with clear next steps, automated reminders, and progress tracking.

### 1.3 Primary User Types/Roles

| Role | Description | Current Status |
|------|-------------|----------------|
| **Job Seeker (Primary)** | Active job searcher managing applications | Implemented (UI only) |
| **Admin** | System administrator managing templates, settings | NOT implemented |
| **Guest/Unauthenticated** | Landing page visitor | NOT implemented |

### 1.4 High-Level User Journeys

#### Happy Path: New Job Application

```
1. User adds new job (via URL or manual entry)
2. System extracts job details (title, company, description)
3. User rates job fit
4. User finds/selects contact for outreach
5. System generates outreach message
6. User sends outreach (marks as sent)
7. System schedules follow-up reminder
8. User receives reply → logs it
9. User books meeting/interview
10. User completes 3-day interview prep
11. User records outcome (offer/rejected/withdrew)
```

#### Alternative Paths

- **No contact found:** User proceeds without contact → generic application
- **No reply received:** Follow-up nudge appears in inbox
- **Interview scheduled:** Interview Mode activates with 3-day prep plan
- **Job closed without interview:** User records outcome and reflects

---

## 2. Sitemap & Navigation Map

### 2.1 Route Structure

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | `Index.tsx` | Dashboard/Home with overview cards |
| `/inbox` | `Inbox.tsx` | Action items and to-do list |
| `/jobs` | `Jobs.tsx` | Kanban board with all jobs |
| `/job/:id` | `JobDetail.tsx` | Single job detail page |
| `/calendar` | `Calendar.tsx` | Calendar with events |
| `/resume` | NOT IMPLEMENTED | Resume management (placeholder) |
| `/settings` | NOT IMPLEMENTED | User settings (placeholder) |
| `/support` | NOT IMPLEMENTED | Support page (placeholder) |
| `*` | `NotFound.tsx` | 404 fallback |

### 2.2 Navigation Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         SIDEBAR (Fixed)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [Home]     → /                                              ││
│  │ [Inbox]    → /inbox                                         ││
│  │ [Jobs]     → /jobs                                          ││
│  │ [Resume]   → /resume (not implemented)                      ││
│  │ ─────────────────────────────                               ││
│  │ [Support]  → /support (not implemented)                     ││
│  │ [Settings] → /settings (not implemented)                    ││
│  │ [Logout]   → (action, not route)                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Page-to-Page Flow

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│   Home   │────▶│   Jobs   │────▶│  Job Detail  │
│    /     │     │  /jobs   │     │  /job/:id    │
└──────────┘     └──────────┘     └──────────────┘
     │                                    ▲
     │           ┌──────────┐             │
     └──────────▶│  Inbox   │─────────────┘
                 │  /inbox  │  (Start action → Job Detail)
                 └──────────┘
                      │
                      ▼
                 ┌──────────┐
                 │ Calendar │
                 │/calendar │
                 └──────────┘
```

**Key Navigation Triggers:**
- Dashboard "Go to Inbox" button → `/inbox`
- Dashboard "Go to Jobs" button → `/jobs`
- Dashboard job card click → `/job/:id`
- Inbox "Start" button → `/job/:id?section=<section>`
- Kanban card click → `/job/:id`
- Back button on Job Detail → `/` (Dashboard)

---

## 3. Page-by-Page Breakdown

### 3.1 Dashboard (Home) — `/`

**File:** `src/pages/Index.tsx`

#### Purpose
Central hub showing at-a-glance metrics, pending actions, and quick access to active jobs.

#### UI Sections/Components

| Section | Component | Data Required |
|---------|-----------|---------------|
| Header | `Header.tsx` | User profile (name, avatar, username) |
| Daily Goal Card | `DailyGoalCard.tsx` | `goal: number`, `completed: number` |
| Metrics Card | `MetricsCard.tsx` | `coffeeChats: number`, `interviews: number` |
| Tasks Card | `TasksCard.tsx` | `totalTasks: number`, `completedTasks: number` |
| Inbox Preview | `InboxPreview.tsx` | `jobs: Job[]` (generates actions) |
| Jobs Preview | `JobsPreview.tsx` | `jobs: Job[]` |

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Click "Go to Inbox" | Navigate to `/inbox` | None |
| Click "Go to Jobs" | Navigate to `/jobs` | None |
| Click job in preview | Navigate to `/job/:id` | None |
| Click "Start" on inbox item | Navigate to `/job/:id?section=X` | None |
| Search (header) | **NOT FUNCTIONAL** | Search API |
| Bell notification (header) | **NOT FUNCTIONAL** | Notifications API |

#### Inputs & Expected Behavior

| Input | Type | Behavior |
|-------|------|----------|
| Search box | Text input | Currently non-functional. Should search jobs by title/company. |

#### Validation Rules
- None currently implemented
- **Needed:** Search input validation (min 2 chars, max 100 chars)

#### Loading/Empty States
- **Current:** No loading states (data is hardcoded)
- **Needed:** Skeleton loaders for each card while fetching

#### Empty States Needed
- "No jobs yet" → Show on Jobs Preview if no jobs
- "You're all caught up!" → Show on Inbox Preview if no actions

---

### 3.2 Inbox — `/inbox`

**File:** `src/pages/Inbox.tsx`

#### Purpose
Prioritized action list showing what the user should work on next, derived from job states.

#### UI Sections/Components

| Section | Component | Data Required |
|---------|-----------|---------------|
| Header | `Header.tsx` | User profile |
| Search/Filter Bar | Inline | `searchQuery: string`, `viewMode: 'grouped' | 'flat'` |
| Priority Actions | `InboxRow.tsx` | Actions where `category = 'priority'` |
| Waiting/Nudges | `InboxRow.tsx` | Actions where `category = 'waiting'` |
| Setup Gaps | `InboxRow.tsx` | Actions where `category = 'setup'` |
| Snoozed Section | `InboxRow.tsx` | Actions where `isSnoozed = true` |
| Completed Section | `InboxRow.tsx` | Actions where `isCompleted = true` |

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Click "Start" | Navigate to job detail section | None |
| Click "Snooze" | Move to snoozed list | Persist snooze state |
| Click "Mark Done" | Move to completed list | Persist completion state |
| Search | Filter actions by title | Local filter (OK) or API |
| Toggle view mode | Switch grouped/flat display | None (local state) |
| Collapse/expand sections | Toggle visibility | None (local state) |

#### Inbox Action Types

| Type | Tag | When Generated |
|------|-----|----------------|
| `RATE_FIT` | Setup | Job has no `fitScore` |
| `FIND_CONTACTS` | Setup | Job has `!hasSelectedContact` and not Closed |
| `GENERATE_OUTREACH` | Outreach | Has contact, no draft, not Closed |
| `SEND_OUTREACH` | Outreach | Has draft, not marked sent |
| `LOG_REPLY` | Engagement | Status = "Replied" |
| `PREP_MEETING` | Meeting | Status = "Meeting Booked" |
| `INTERVIEW_PREP` | Interview Prep | Status = "Interviewing" |
| `WAITING_NUDGE` | Follow-up | Status = "Outreach Sent" |

#### Validation Rules
- Search: trim whitespace, case-insensitive match
- **Needed:** Search length limit (min 1, max 100)

#### Loading/Empty States
- **Current:** "You're all caught up!" message when no pending actions
- **Needed:** Loading skeleton while fetching jobs

---

### 3.3 Jobs (Kanban Board) — `/jobs`

**File:** `src/pages/Jobs.tsx`

#### Purpose
Visual Kanban board showing all jobs organized by pipeline stage.

#### UI Sections/Components

| Section | Component | Data Required |
|---------|-----------|---------------|
| Header | `Header.tsx` | User profile |
| Page Title | Inline | None |
| Kanban Board | `KanbanBoard.tsx` | `jobs: Job[]` |
| Kanban Filters | `KanbanFilters.tsx` | Filter state |
| Kanban Columns | `KanbanColumn.tsx` | Jobs grouped by status |
| Kanban Cards | `KanbanCard.tsx` | Individual job data |

#### Pipeline Stages (Columns)

```
Interested → Outreach Ready → Outreach Sent → Replied → 
Meeting Booked → Interviewing → Offer → Closed
```

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Click card | Navigate to `/job/:id` | None |
| Drag card to column | Change job status | `PATCH /jobs/:id` |
| Click "Move to X" in menu | Change job status | `PATCH /jobs/:id` |
| Click "Next Step" button | Navigate to job detail | None |
| Search jobs | Filter by title/company | Local or API |
| Filter by status | Show only matching status | Local filter |
| Toggle view (board/list) | Switch display mode | None (local) |

#### Validation Rules
- **Needed:** Prevent invalid status transitions (business logic TBD)

#### Loading/Empty States
- **Current:** None (hardcoded data)
- **Needed:** 
  - Loading skeleton for board
  - "No jobs found" in column when empty
  - "No jobs match filters" when filtered to zero

---

### 3.4 Job Detail — `/job/:id`

**File:** `src/pages/JobDetail.tsx`

#### Purpose
Comprehensive detail page for a single job with all management tools.

#### UI Sections/Components

| Section | Component | Data Required |
|---------|-----------|---------------|
| Back Button | Inline | None |
| Job Header | Inline | Job title, company, deadline, URL, status |
| Description | Inline | Job description (collapsible) |
| Progress Tracker | `ProgressTracker.tsx` | Milestones object, progress % |
| Contact Discovery | `ContactDiscovery.tsx` | `contacts: Contact[]` |
| Outreach Builder | `OutreachBuilder.tsx` | Message draft, selected contact |
| Follow-up Scheduler | `FollowUpScheduler.tsx` | Follow-up date, message |
| Interview Mode | `InterviewMode.tsx` | Interview date, prep status |
| Outcome Section | `OutcomeSection.tsx` | Outcome type, reflection |
| Pitch Deck Panel | `PitchDeckPanel.tsx` | (Placeholder content) |
| Flash Cards Panel | `FlashCardsPanel.tsx` | (Placeholder content) |
| Notes & Attachments | `NotesAttachments.tsx` | Notes text, tags, files |
| Activity Timeline | `ActivityTimeline.tsx` | `activities: ActivityItem[]` |

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Change status dropdown | Update job status | `PATCH /jobs/:id` |
| Toggle milestone checkbox | Update milestone | `PATCH /jobs/:id/milestones` |
| Select contact | Set `selectedContactId` | `PATCH /jobs/:id` |
| Edit outreach message | Update draft | `PATCH /jobs/:id/outreach` |
| Copy message | Copy to clipboard | None |
| Mark as Sent | Update `outreachMarkedSent` | `PATCH /jobs/:id` |
| Set follow-up date | Update follow-up | `PATCH /jobs/:id/followup` |
| Mark follow-up sent | Update follow-up | `PATCH /jobs/:id/followup` |
| Set interview date | Update interview | `PATCH /jobs/:id/interview` |
| Complete prep day | Update milestone | `PATCH /jobs/:id/milestones` |
| Record outcome | Update outcome | `PATCH /jobs/:id/outcome` |
| Add note | Save notes | `PATCH /jobs/:id/notes` |
| Add/remove tag | Update tags array | `PATCH /jobs/:id/tags` |
| Upload attachment | Upload file | `POST /jobs/:id/attachments` |
| Click "Clone job" | Duplicate job setup | `POST /jobs` |

#### Validation Rules

| Field | Rule |
|-------|------|
| Status | Must be valid `JobStatus` enum |
| Outreach message | Max 2000 characters |
| Follow-up date | Must be future date |
| Interview date | Must be future date or today |
| Notes | Max 5000 characters |
| Tags | Max 10 tags, each max 30 chars |
| Reflection | Max 1000 characters |

#### Error Messages

| Error | Message |
|-------|---------|
| Job not found | "Job not found" (currently shown) |
| Save failed | "Failed to save changes. Please try again." |
| File too large | "File must be under 10MB" |
| Invalid file type | "Only PDF, DOC, DOCX, and images allowed" |

#### Loading/Empty States
- **Current:** "Job not found" if ID doesn't match
- **Needed:** 
  - Loading skeleton while fetching
  - "No contacts found" in contact discovery
  - "No activity yet" in timeline (implemented)

---

### 3.5 Calendar — `/calendar`

**File:** `src/pages/Calendar.tsx`

#### Purpose
Calendar view showing all job-related events, interviews, follow-ups, and personal items.

#### UI Sections/Components

| Section | Component | Data Required |
|---------|-----------|---------------|
| Main Sidebar | `Sidebar.tsx` | Nav items |
| Calendar Sidebar | `CalendarSidebar.tsx` | Mini calendar, filters, create button |
| Calendar Header | `CalendarHeader.tsx` | Date navigation, view toggle, search |
| Month View | `MonthView.tsx` | Events for visible month |
| Week View | `WeekView.tsx` | Events for visible week |
| Day View | `DayView.tsx` | Events for selected day |
| Agenda View | `AgendaView.tsx` | List of upcoming events |
| Event Details Panel | `EventDetailsPanel.tsx` | Selected event data |

#### Event Types

| Type | Color | Description |
|------|-------|-------------|
| `job` | Blue | Job application deadlines |
| `outreach` | Green | Outreach send dates |
| `interview` | Purple | Interview appointments |
| `coffee-chat` | Orange | Networking meetings |
| `follow-up` | Yellow | Follow-up reminders |
| `relationship` | Pink | Relationship check-ins |
| `personal` | Cyan | Personal events |

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Navigate month/week/day | Change visible date range | None (local) |
| Toggle view mode | Switch Month/Week/Day/Agenda | None (local) |
| Click "Today" | Jump to current date | None |
| Toggle event type filter | Show/hide event types | None (local) |
| Search events | Filter by title | Local or API |
| Click event | Open details panel | None |
| Click "Create Event" | Open new event panel | None |
| Save event | Create/update event | `POST/PATCH /events` |
| Delete event | Remove event | `DELETE /events/:id` |

#### Calendar Event Fields

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `title` | string | Yes |
| `type` | CalendarEventType | Yes |
| `startDateTime` | Date | Yes |
| `endDateTime` | Date | Yes |
| `allDay` | boolean | Yes |
| `recurrenceRule` | enum | Yes |
| `reminders` | array | No |
| `linkedJobId` | string | No |
| `linkedContactId` | string | No |
| `notes` | string | No |
| `suggestedMessageTemplate` | string | No |
| `status` | enum | Yes |
| `timezone` | string | Yes |

#### Validation Rules

| Field | Rule |
|-------|------|
| Title | Required, max 100 chars |
| Start date | Required, valid date |
| End date | Required, must be ≥ start date |
| Reminder | Minutes before must be ≥ 0 |

---

### 3.6 Not Found — `/*`

**File:** `src/pages/NotFound.tsx`

Simple 404 page with link back to home.

---

## 4. Component & Feature Breakdown

### 4.1 Job Card (`KanbanCard.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Display job in Kanban board |
| **Appears** | Jobs page (Kanban board) |
| **Data Needed** | `Job` object |
| **Events Triggered** | Navigate to detail, move to column, drag-drop |
| **Configurable** | None currently |
| **Hardcoded** | None |

### 4.2 Inbox Row (`InboxRow.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Display action item in inbox |
| **Appears** | Inbox page, Dashboard inbox preview |
| **Data Needed** | `InboxAction` object |
| **Events Triggered** | Start (navigate), Snooze, Mark Done |
| **Configurable** | `compact` mode (boolean) |
| **Hardcoded** | Icon/color mappings |

### 4.3 Progress Tracker (`ProgressTracker.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Visual milestone checklist |
| **Appears** | Job Detail page |
| **Data Needed** | `milestones` object, `progress` number |
| **Events Triggered** | `onToggle(key)` for each milestone |
| **Configurable** | Milestone labels |
| **Hardcoded** | Milestone keys and labels |

### 4.4 Contact Discovery (`ContactDiscovery.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | List and select contacts for outreach |
| **Appears** | Job Detail page |
| **Data Needed** | `contacts: Contact[]` |
| **Events Triggered** | Select contact |
| **Configurable** | None |
| **Hardcoded** | Confidence colors |

### 4.5 Outreach Builder (`OutreachBuilder.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Draft and send outreach messages |
| **Appears** | Job Detail page |
| **Data Needed** | Message draft, selected contact name |
| **Events Triggered** | Copy, Mark as Sent |
| **Configurable** | Message template |
| **Hardcoded** | Default message template |

### 4.6 Follow-up Scheduler (`FollowUpScheduler.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Schedule and track follow-up messages |
| **Appears** | Job Detail page |
| **Data Needed** | Follow-up date, message |
| **Events Triggered** | Copy, Mark as Sent |
| **Configurable** | Follow-up message template |
| **Hardcoded** | Default follow-up template, "5 days" countdown |

### 4.7 Interview Mode (`InterviewMode.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | 3-day interview preparation workflow |
| **Appears** | Job Detail page (when status = "Interviewing") |
| **Data Needed** | Interview date, day completion status |
| **Events Triggered** | Set date, toggle reminders, complete day |
| **Configurable** | Day plan tasks |
| **Hardcoded** | 3-day plan with fixed tasks |

### 4.8 Calendar Views

| Component | Purpose |
|-----------|---------|
| `MonthView.tsx` | Monthly grid calendar |
| `WeekView.tsx` | Weekly column view |
| `DayView.tsx` | Single day detailed view |
| `AgendaView.tsx` | List of upcoming events |

---

## 5. Data & Backend Requirements

### 5.1 Data Entities

#### User

```typescript
interface User {
  id: string;                    // UUID
  email: string;                 // Required, unique
  name: string;                  // Display name
  username: string;              // @handle
  avatarUrl?: string;            // Profile image URL
  createdAt: Date;
  updatedAt: Date;
  
  // Settings
  dailyGoal: number;             // Default: 5
  timezone: string;              // Default: 'America/New_York'
  emailNotifications: boolean;   // Default: true
}
```

#### Job

```typescript
interface Job {
  id: string;                    // UUID
  userId: string;                // FK to User (required)
  title: string;                 // Required
  company: string;               // Required
  companyLogoUrl?: string;       // Optional
  url: string;                   // Job posting URL
  description?: string;          // Job description
  dueDate?: string;              // Application deadline
  status: JobStatus;             // Required, enum
  progress: number;              // 0-100, calculated
  
  // Tracking flags
  hasSelectedContact: boolean;
  hasOutreachDraft: boolean;
  outreachMarkedSent: boolean;
  
  // Optional fields (removed from filter UI)
  fitScore?: 'High' | 'Medium' | 'Low';
  workMode?: 'Remote' | 'Hybrid' | 'On-site';
  roleFamily?: 'PM' | 'SWE' | 'DS' | 'Design' | 'Other';
  
  // Relations (can be embedded or separate tables)
  selectedContactId?: string;
  notes?: string;
  tags?: string[];
  outcome?: 'Offer' | 'Rejected' | 'Withdrew' | 'No response';
  outcomeReflection?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

type JobStatus = 
  | 'Interested'
  | 'Outreach Ready'
  | 'Outreach Sent'
  | 'Replied'
  | 'Meeting Booked'
  | 'Interviewing'
  | 'Offer'
  | 'Closed';
```

#### JobMilestone

```typescript
interface JobMilestone {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  
  resumeTailored: boolean;       // Default: false
  contactSelected: boolean;
  outreachSent: boolean;
  followUpSent: boolean;
  replyReceived: boolean;
  interviewScheduled: boolean;
  interviewPrep1: boolean;
  interviewPrep2: boolean;
  interviewPrep3: boolean;
  outcomeRecorded: boolean;
}
```

#### Contact

```typescript
interface Contact {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  name: string;                  // Required
  title: string;                 // Job title
  relationship: 'Recruiter' | 'Hiring Manager' | 'Team Lead' | 'Employee';
  confidence: 'High' | 'Medium' | 'Low';
  source: string;                // e.g., 'LinkedIn'
  profileUrl?: string;           // LinkedIn profile, etc.
  isSelected: boolean;           // Is this the selected contact?
  createdAt: Date;
}
```

#### OutreachMessage

```typescript
interface OutreachMessage {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  contactId: string;             // FK to Contact
  message: string;               // Message content
  type: 'initial' | 'followup';
  sentAt?: Date;                 // Null if draft
  createdAt: Date;
  updatedAt: Date;
}
```

#### CalendarEvent

```typescript
interface CalendarEvent {
  id: string;                    // UUID
  userId: string;                // FK to User
  title: string;                 // Required
  type: CalendarEventType;       // Required
  startDateTime: Date;           // Required
  endDateTime: Date;             // Required
  allDay: boolean;
  recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  reminders: { minutesBefore: number }[];
  linkedJobId?: string;          // FK to Job
  linkedContactId?: string;      // FK to Contact
  notes?: string;
  suggestedMessageTemplate?: string;
  status: 'scheduled' | 'done' | 'canceled';
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

type CalendarEventType = 
  | 'job'
  | 'outreach'
  | 'interview'
  | 'coffee-chat'
  | 'follow-up'
  | 'relationship'
  | 'personal';
```

#### ActivityLog

```typescript
interface ActivityLog {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  action: string;                // Description of action
  timestamp: Date;
  createdBy?: string;            // 'user' | 'system'
}
```

#### Attachment (Future)

```typescript
interface Attachment {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  fileName: string;
  fileType: string;              // MIME type
  fileSize: number;              // Bytes
  storageUrl: string;            // Cloud storage URL
  uploadedAt: Date;
}
```

#### InboxAction (Derived/Computed)

This is NOT stored in database. It's computed from Job data:

```typescript
interface InboxAction {
  id: string;                    // Computed: `${jobId}-${type}`
  type: InboxActionType;
  title: string;
  subtitleTag: string;
  linkedJobId: string;
  companyName: string;
  roleTitle: string;
  sequenceTotal?: number;
  sequenceCurrent?: number;
  isCompleted: boolean;          // Could be persisted if needed
  isSnoozed: boolean;            // Could be persisted if needed
  category: 'priority' | 'waiting' | 'setup';
}
```

### 5.2 Entity Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                          User                                 │
│  has many: Jobs, CalendarEvents                              │
└──────────────────────────────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────────────────────────────────┐
│                          Job                                  │
│  belongs to: User                                            │
│  has one: JobMilestone                                       │
│  has many: Contacts, OutreachMessages, ActivityLogs,         │
│            Attachments                                       │
│  may link to: CalendarEvents                                 │
└──────────────────────────────────────────────────────────────┘
           │
     ┌─────┴─────┬──────────────┬───────────────┐
     │ 1:1       │ 1:N          │ 1:N           │
     ▼           ▼              ▼               ▼
┌─────────┐ ┌─────────┐ ┌────────────┐ ┌─────────────┐
│Milestone│ │ Contact │ │ Outreach   │ │ ActivityLog │
└─────────┘ └─────────┘ │ Message    │ └─────────────┘
                        └────────────┘
```

### 5.3 Business Rules

| Rule | Description |
|------|-------------|
| One selected contact per job | Only one contact can be `isSelected = true` per job |
| Progress auto-calculation | Progress = (completed milestones / 10) * 100 |
| Status triggers | Certain milestones update status automatically (optional) |
| Follow-up scheduling | Default 5 days after outreach sent |
| Interview prep | Only visible when status = "Interviewing" |
| Activity logging | Auto-log status changes, milestone completions |

---

## 6. API Contract Draft

### 6.1 Authentication Endpoints

```
POST   /auth/signup           Create new account
POST   /auth/login            Login with email/password
POST   /auth/logout           End session
POST   /auth/refresh          Refresh access token
POST   /auth/forgot-password  Request password reset
POST   /auth/reset-password   Set new password
GET    /auth/me               Get current user
```

### 6.2 User Endpoints

```
GET    /users/me              Get current user profile
PATCH  /users/me              Update user profile
DELETE /users/me              Delete account
```

### 6.3 Job Endpoints

#### List Jobs
```
GET /jobs

Query params:
- status: JobStatus (optional, filter by status)
- search: string (optional, search title/company)
- sort: 'created' | 'updated' | 'dueDate' (default: 'updated')
- order: 'asc' | 'desc' (default: 'desc')
- limit: number (default: 50, max: 100)
- offset: number (default: 0)

Response:
{
  jobs: Job[],
  total: number,
  limit: number,
  offset: number
}

Auth: Required
```

#### Get Job
```
GET /jobs/:id

Response:
{
  job: Job,
  milestones: JobMilestone,
  contacts: Contact[],
  outreachMessages: OutreachMessage[],
  activityTimeline: ActivityLog[]
}

Auth: Required
Errors:
- 404 Job not found
- 403 Not authorized
```

#### Create Job
```
POST /jobs

Body:
{
  title: string,              // Required
  company: string,            // Required
  url: string,                // Required
  description?: string,
  dueDate?: string,
  status?: JobStatus,         // Default: 'Interested'
  tags?: string[]
}

Response: { job: Job }

Auth: Required
Errors:
- 400 Validation error
```

#### Update Job
```
PATCH /jobs/:id

Body (all optional):
{
  title?: string,
  company?: string,
  url?: string,
  description?: string,
  dueDate?: string,
  status?: JobStatus,
  fitScore?: FitScore,
  selectedContactId?: string,
  notes?: string,
  tags?: string[],
  outcome?: Outcome,
  outcomeReflection?: string
}

Response: { job: Job }

Auth: Required
Errors:
- 404 Not found
- 400 Validation error
```

#### Delete Job
```
DELETE /jobs/:id

Response: { success: true }

Auth: Required
Errors:
- 404 Not found
```

#### Update Milestones
```
PATCH /jobs/:id/milestones

Body:
{
  resumeTailored?: boolean,
  contactSelected?: boolean,
  outreachSent?: boolean,
  followUpSent?: boolean,
  replyReceived?: boolean,
  interviewScheduled?: boolean,
  interviewPrep1?: boolean,
  interviewPrep2?: boolean,
  interviewPrep3?: boolean,
  outcomeRecorded?: boolean
}

Response: { milestones: JobMilestone, progress: number }

Auth: Required
```

### 6.4 Contact Endpoints

```
GET    /jobs/:jobId/contacts              List contacts for job
POST   /jobs/:jobId/contacts              Add contact
PATCH  /jobs/:jobId/contacts/:contactId   Update contact
DELETE /jobs/:jobId/contacts/:contactId   Remove contact
POST   /jobs/:jobId/contacts/:contactId/select   Set as selected contact
```

### 6.5 Outreach Endpoints

```
GET    /jobs/:jobId/outreach              Get outreach messages
POST   /jobs/:jobId/outreach              Create/save draft
PATCH  /jobs/:jobId/outreach/:id          Update message
POST   /jobs/:jobId/outreach/:id/send     Mark as sent
```

### 6.6 Calendar Event Endpoints

```
GET    /events                 List events (with date range filter)
POST   /events                 Create event
GET    /events/:id             Get event
PATCH  /events/:id             Update event
DELETE /events/:id             Delete event

Query params for GET /events:
- start: ISO date string (required)
- end: ISO date string (required)
- type: CalendarEventType (optional, filter)
- linkedJobId: string (optional, filter)
```

### 6.7 Activity Log Endpoints

```
GET /jobs/:jobId/activity      List activity for job

Response: { activities: ActivityLog[] }
```

### 6.8 Dashboard/Analytics Endpoints

```
GET /dashboard/stats

Response:
{
  dailyGoal: number,
  completedToday: number,
  coffeeChatsTotal: number,
  interviewsTotal: number,
  tasksTotal: number,
  tasksCompleted: number,
  jobsByStatus: { [status: string]: number }
}

Auth: Required
```

### 6.9 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": {
      "field": "title",
      "constraint": "required"
    }
  }
}
```

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (not owner) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 7. State & Hardcoded Data Replacement

### 7.1 Hardcoded Data Locations

| File | Hardcoded Data | Replace With |
|------|----------------|--------------|
| `src/data/jobs.ts` | `sampleJobs[]` array with 8 fake jobs | `GET /jobs` API response |
| `src/data/calendarEvents.ts` | `mockCalendarEvents[]` | `GET /events` API response |
| `src/pages/Index.tsx` | `goal={5}`, `completed={2}`, `coffeeChats={8}`, `interviews={3}`, `totalTasks={12}`, `completedTasks={7}` | `GET /dashboard/stats` |
| `src/components/Header.tsx` | User name "Kacie Velasquez", username "@k_velasquez", hardcoded avatar URL | Authenticated user from `GET /auth/me` |
| `src/components/job-detail/OutreachBuilder.tsx` | Default message template | User template setting or API-generated template |
| `src/components/job-detail/FollowUpScheduler.tsx` | Default follow-up message, hardcoded "5 days" | Calculated from outreach send date |
| `src/components/job-detail/InterviewMode.tsx` | Fixed 3-day prep plan tasks | Could be configurable or AI-generated |
| `src/components/inbox/InboxRow.tsx` | Icon/color mappings | OK to keep hardcoded (UI concern) |
| `src/types/calendar.ts` | `EVENT_TYPE_COLORS`, `EVENT_TYPE_LABELS` | OK to keep hardcoded (UI concern) |

### 7.2 State Management Recommendations

Current state is local (`useState` in each page). For production:

1. **React Query (TanStack Query)** — Already installed, use for:
   - Fetching and caching jobs, events
   - Automatic refetching
   - Optimistic updates

2. **Auth Context** — Create for:
   - Current user session
   - Login/logout functions
   - Auth state across app

3. **Keep Local State For:**
   - UI toggles (collapsed sections, hover states)
   - Form drafts (before save)
   - Search input values
   - Filter selections

### 7.3 Migration Examples

#### Before (hardcoded):
```tsx
// src/pages/Jobs.tsx
import { sampleJobs } from "@/data/jobs";
const [jobs, setJobs] = useState<Job[]>(sampleJobs);
```

#### After (API):
```tsx
// src/pages/Jobs.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const { data: jobs, isLoading, error } = useQuery({
  queryKey: ['jobs'],
  queryFn: () => fetch('/api/jobs').then(res => res.json())
});

const updateJobMutation = useMutation({
  mutationFn: (update) => fetch(`/api/jobs/${update.id}`, {
    method: 'PATCH',
    body: JSON.stringify(update)
  }),
  onSuccess: () => queryClient.invalidateQueries(['jobs'])
});
```

---

## 8. Authentication & Authorization

### 8.1 Required Auth Flows

| Flow | Description | Priority |
|------|-------------|----------|
| **Sign Up** | Email + password registration | High |
| **Login** | Email + password authentication | High |
| **Logout** | End session | High |
| **Session Refresh** | Auto-refresh JWT tokens | High |
| **Forgot Password** | Email-based password reset | Medium |
| **OAuth (Google)** | Social login option | Low |

### 8.2 Protected Actions

| Action | Auth Required | Owner Check |
|--------|---------------|-------------|
| View dashboard | Yes | N/A |
| View jobs | Yes | Only own jobs |
| Create job | Yes | N/A |
| Edit job | Yes | Must be owner |
| Delete job | Yes | Must be owner |
| View calendar | Yes | Only own events |
| Create event | Yes | N/A |
| Edit event | Yes | Must be owner |
| Update profile | Yes | Self only |

### 8.3 Role Behavior

Currently single-role (Job Seeker). Future considerations:

| Role | Permissions |
|------|-------------|
| Job Seeker | Full CRUD on own data |
| Admin | Manage system settings, templates |
| (Future) Coach | View assigned users' data |

### 8.4 Auth Implementation Notes

- Sidebar "Logout" button currently non-functional → must trigger logout flow
- No login page exists → create `/auth` or `/login` route
- No auth protection on routes → add `ProtectedRoute` wrapper
- Store session in localStorage/cookies with secure flags

---

## 9. Admin / CMS Needs

### 9.1 Admin Features (Future Phase)

| Feature | Description |
|---------|-------------|
| User Management | View users, disable accounts |
| Analytics Dashboard | Aggregate usage stats |
| System Settings | Default daily goal, feature flags |
| Template Management | Email templates, outreach templates |
| Feedback Review | User-submitted feedback |

### 9.2 User-Editable Content

| Content | Where Used | Storage |
|---------|------------|---------|
| Daily goal number | Dashboard goal card | User settings |
| Outreach templates | Outreach builder | User settings or global templates |
| Interview prep tasks | Interview mode | Could be user-customizable |
| Custom tags | Job cards, notes | Per-job storage |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Requirement | Target |
|-------------|--------|
| Initial page load | < 2 seconds |
| API response time | < 500ms p95 |
| Job list pagination | 50 items per page |
| Calendar events | Fetch 3-month window |
| Search debounce | 300ms delay |

### 10.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Input validation | Server-side validation for all inputs |
| SQL injection | Use parameterized queries/ORM |
| XSS prevention | Sanitize user-generated content |
| CSRF protection | CSRF tokens for state-changing requests |
| Rate limiting | 100 requests/minute per user |
| File uploads | Max 10MB, allowed types only |
| Password rules | Min 8 chars, complexity requirements |
| Session timeout | 7 days with refresh tokens |

### 10.3 Logging / Audit

| Event | What to Log |
|-------|-------------|
| Authentication | Login, logout, failed attempts |
| Job changes | Status changes, outcome recorded |
| Data deletion | Job deleted, account deleted |
| Errors | Server errors with stack traces |

### 10.4 Email Notifications (Future)

| Trigger | Email |
|---------|-------|
| Follow-up due | "Time to follow up with [Company]" |
| Interview tomorrow | "Interview prep reminder" |
| Inactivity | "You haven't logged in for 7 days" |
| Weekly summary | "Your job search this week" |

---

## 11. Open Questions & Assumptions

### 11.1 Assumptions Made

1. **Single user per account** — No team/shared workspaces
2. **All data is private** — No public profiles or sharing
3. **English only** — No i18n/localization needed initially
4. **US/Canada timezones** — Default timezone handling
5. **Browser only** — No mobile app initially
6. **No AI generation** — Templates are static (AI could be added)

### 11.2 Open Questions for Product/Backend Team

| # | Question | Impact |
|---|----------|--------|
| 1 | Should outreach messages support rich text (bold, links)? | Message schema, editor component |
| 2 | Should we auto-generate contacts from LinkedIn scraping? | API integration, legal considerations |
| 3 | What happens to calendar events when a job is deleted? | Cascade delete or orphan? |
| 4 | Should users be able to undo job deletion? | Soft delete vs hard delete |
| 5 | Do we need webhook support for calendar sync (Google Calendar)? | Integration complexity |
| 6 | Should daily stats reset at midnight user's timezone? | Stats calculation logic |
| 7 | Is there a maximum number of jobs per user? | Storage/performance limits |
| 8 | Should we track "time in stage" for jobs? | Analytics requirements |
| 9 | Are attachments required? Can we defer to v2? | Scope reduction option |
| 10 | Do we need email verification on signup? | Auth flow complexity |

### 11.3 Recommended MVP Scope

**Include in MVP:**
- User auth (email/password)
- Full Job CRUD
- Job milestones
- Contact management
- Outreach tracking
- Calendar events (basic)
- Dashboard stats

**Defer to v2:**
- File attachments
- Email notifications
- OAuth login
- AI-generated content
- Calendar integrations
- Admin panel

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2025 | Lovable AI | Initial document |

---

**END OF DOCUMENT**
