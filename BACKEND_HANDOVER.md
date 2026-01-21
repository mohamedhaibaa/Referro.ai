# Backend Handover / Functional Blueprint

## Jobless - Professional Outreach & Networking Tool

**Document Version:** 1.1  
**Last Updated:** January 2025  
**Status:** Frontend-Only (Backend Implementation Required)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Sitemap & Navigation Map](#2-sitemap--navigation-map)
3. [Page-by-Page Breakdown](#3-page-by-page-breakdown)
4. [Component & Feature Breakdown](#4-component--feature-breakdown)
5. [Data & Backend Requirements](#5-data--backend-requirements)
6. [Recommended Database Structure](#6-recommended-database-structure)
7. [API Contract Draft](#7-api-contract-draft)
8. [State & Hardcoded Data Replacement](#8-state--hardcoded-data-replacement)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Admin / CMS Needs](#10-admin--cms-needs)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Open Questions & Assumptions](#12-open-questions--assumptions)

---

## 1. Project Overview

### 1.1 Purpose

**Jobless** is a **professional outreach and networking tool** designed to help job seekers:

- **Find the right people** to reach out to at target companies
- **Prepare compelling outreach messages** (LinkedIn messages, emails, etc.)
- **Track outreach status** and follow-ups
- **Prepare for coffee chats** once a conversation is started
- Visualize their networking pipeline (Kanban board view)

> ⚠️ **IMPORTANT CLARIFICATION**: This is NOT a job search/organizing tool. The core value is in the **outreach workflow** — helping users identify contacts, craft messages, and manage networking conversations. The pipeline visualization is a secondary feature for better organization.

### 1.2 Problem Solved

Networking for job opportunities is intimidating and unstructured. Users struggle to:
- Find the right person to contact at a company
- Know what to say in their outreach
- Track who they've contacted and what stage each conversation is in
- Prepare for coffee chats when someone responds

This application transforms cold outreach into a structured, guided workflow with clear next steps.

### 1.3 Core User Flow

```
1. User pastes a LinkedIn job URL
2. System scrapes/extracts job details (title, company, description)
3. User clicks "Find Contacts" → System suggests people to reach out to
4. User selects a contact
5. System generates personalized outreach message
6. User sends outreach (marks as sent in app)
7. System schedules follow-up reminder
8. If contact replies → User logs it, prepares for coffee chat
9. User has coffee chat → Logs outcome
```

### 1.4 Primary User Types/Roles

| Role | Description | Current Status |
|------|-------------|----------------|
| **Job Seeker (Primary)** | Professional managing networking outreach | Implemented (UI only) |
| **Admin** | System administrator | NOT implemented |
| **Guest/Unauthenticated** | Landing page visitor | NOT implemented |

### 1.5 What This Tool is NOT

- ❌ NOT a job board or job search engine
- ❌ NOT a calendar/scheduling tool (removed from scope)
- ❌ NOT an interview preparation tool (postponed to future version)
- ❌ NOT a resume builder

---

## 2. Sitemap & Navigation Map

### 2.1 Route Structure

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | `Index.tsx` | Dashboard with overview cards |
| `/inbox` | `Inbox.tsx` | Action items and to-do list |
| `/jobs` | `Jobs.tsx` | Kanban board with all job opportunities |
| `/job/:id` | `JobDetail.tsx` | Single job detail with outreach tools |
| `/resume` | NOT IMPLEMENTED | Resume management (placeholder) |
| `/settings` | NOT IMPLEMENTED | User settings (placeholder) |
| `/support` | NOT IMPLEMENTED | Support page (placeholder) |
| `*` | `NotFound.tsx` | 404 fallback |

> 📌 **Note:** The `/calendar` route has been removed from scope.

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
Central hub showing at-a-glance metrics, pending outreach actions, and active job opportunities.

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

#### Loading/Empty States
- **Current:** No loading states (data is hardcoded)
- **Needed:** Skeleton loaders for each card while fetching

---

### 3.2 Inbox — `/inbox`

**File:** `src/pages/Inbox.tsx`

#### Purpose
Prioritized action list showing what the user should work on next, derived from job states. This is the **command center** for outreach activities.

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

#### Inbox Action Types (Outreach-Focused)

| Type | Tag | When Generated |
|------|-----|----------------|
| `FIND_CONTACTS` | Setup | Job has `!hasSelectedContact` and not Closed |
| `GENERATE_OUTREACH` | Outreach | Has contact, no draft, not Closed |
| `SEND_OUTREACH` | Outreach | Has draft, not marked sent |
| `LOG_REPLY` | Engagement | Status = "Replied" |
| `PREP_MEETING` | Meeting | Status = "Meeting Booked" |
| `WAITING_NUDGE` | Follow-up | Status = "Outreach Sent" (nudge to follow up) |

> 📌 **Note:** `RATE_FIT` and `INTERVIEW_PREP` actions have been removed from scope.

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Click "Start" | Navigate to job detail section | None |
| Click "Snooze" | Move to snoozed list | Persist snooze state |
| Click "Mark Done" | Move to completed list | Persist completion state |
| Search | Filter actions by title | Local filter (OK) or API |
| Toggle view mode | Switch grouped/flat display | None (local state) |

---

### 3.3 Jobs (Kanban Board) — `/jobs`

**File:** `src/pages/Jobs.tsx`

#### Purpose
Visual Kanban board showing all job opportunities organized by outreach stage.

#### How Jobs Are Added

> ⚠️ **CRITICAL**: Users do NOT manually create jobs. The flow is:
> 1. User pastes a **LinkedIn job posting URL**
> 2. Backend scrapes the job page (using Firecrawl or similar)
> 3. Job details are auto-extracted (title, company, description)
> 4. Job is created with status "Interested"

**This "Add Job" functionality is NOT yet visible in the UI** — it needs to be implemented.

#### Pipeline Stages (Columns)

```
Interested → Outreach Ready → Outreach Sent → Replied → 
Meeting Booked → Interviewing → Offer → Closed
```

> 📌 **Note:** "Interviewing" stage exists but Interview Prep functionality is postponed.

#### User Actions

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| Paste job URL | Create new job (scrape & extract) | `POST /jobs` with URL scraping |
| Click card | Navigate to `/job/:id` | None |
| Drag card to column | Change job status | `PATCH /jobs/:id` |
| Click "Move to X" in menu | Change job status | `PATCH /jobs/:id` |
| Click "Next Step" button | Navigate to job detail | None |
| Search jobs | Filter by title/company | Local or API |
| Filter by status | Show only matching status | Local filter |

#### Current Filter State (Simplified)

The following filters have been **REMOVED** from the UI:
- ~~Fit Score (High/Medium/Low)~~
- ~~Work Mode (Remote/Hybrid/On-site)~~
- ~~Role Family (PM/SWE/DS/Design)~~

Current filters:
- **Company** — text search
- **Tags** — multi-select
- **Status** — multi-select pipeline stages

---

### 3.4 Job Detail — `/job/:id`

**File:** `src/pages/JobDetail.tsx`

#### Purpose
Comprehensive detail page for a single job with all outreach and networking tools.

#### UI Sections/Components

| Section | Component | Data Required | Status |
|---------|-----------|---------------|--------|
| Back Button | Inline | None | ✅ Active |
| Job Header | Inline | Job title, company, deadline, URL, status | ✅ Active |
| Description | Inline | Job description (collapsible) | ✅ Active |
| Progress Tracker | `ProgressTracker.tsx` | Milestones object, progress % | ✅ Active |
| Contact Discovery | `ContactDiscovery.tsx` | `contacts: Contact[]` | ✅ Active |
| Outreach Builder | `OutreachBuilder.tsx` | Message draft, selected contact | ✅ Active |
| Follow-up Scheduler | `FollowUpScheduler.tsx` | Follow-up date, message | ✅ Active |
| Interview Mode | `InterviewMode.tsx` | Interview date, prep status | ⏸️ **POSTPONED** |
| Outcome Section | `OutcomeSection.tsx` | Outcome type, reflection | ✅ Active |
| Notes & Attachments | `NotesAttachments.tsx` | Notes text, tags, files | ✅ Active |
| Activity Timeline | `ActivityTimeline.tsx` | `activities: ActivityItem[]` | ✅ Active |
| Pitch Deck Panel | `PitchDeckPanel.tsx` | (Placeholder) | ⏸️ Future |
| Flash Cards Panel | `FlashCardsPanel.tsx` | (Placeholder) | ⏸️ Future |

#### Core User Actions (Outreach Flow)

| Action | Behavior | Backend Need |
|--------|----------|--------------|
| **Find Contacts** | Trigger contact discovery | `POST /jobs/:id/discover-contacts` |
| Select contact | Set `selectedContactId` | `PATCH /jobs/:id` |
| **Generate Outreach** | AI-generate message | `POST /jobs/:id/generate-outreach` |
| Edit outreach message | Update draft | `PATCH /jobs/:id/outreach` |
| Copy message | Copy to clipboard | None |
| **Mark as Sent** | Update `outreachMarkedSent` | `PATCH /jobs/:id` |
| Set follow-up date | Update follow-up | `PATCH /jobs/:id/followup` |
| Mark follow-up sent | Update follow-up | `PATCH /jobs/:id/followup` |
| Record outcome | Update outcome | `PATCH /jobs/:id/outcome` |
| Add note | Save notes | `PATCH /jobs/:id/notes` |
| Add/remove tag | Update tags array | `PATCH /jobs/:id/tags` |

#### Validation Rules

| Field | Rule |
|-------|------|
| Status | Must be valid `JobStatus` enum |
| Outreach message | Max 2000 characters |
| Follow-up date | Must be future date |
| Notes | Max 5000 characters |
| Tags | Max 10 tags, each max 30 chars |

---

### 3.5 Not Found — `/*`

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
| **Displays** | Title, company, tags, progress, "Next Step" button |
| **Removed** | ~~Fit Score badge~~, ~~Work Mode badge~~, ~~Role Family badge~~ |

### 4.2 Inbox Row (`InboxRow.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Display action item in inbox |
| **Appears** | Inbox page, Dashboard inbox preview |
| **Data Needed** | `InboxAction` object |
| **Events Triggered** | Start (navigate), Snooze, Mark Done |

### 4.3 Contact Discovery (`ContactDiscovery.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | List and select contacts for outreach |
| **Appears** | Job Detail page |
| **Data Needed** | `contacts: Contact[]` |
| **Key Feature** | "Find Contacts" button triggers AI/scraping to discover contacts |
| **Events Triggered** | Select contact, refresh contacts |

### 4.4 Outreach Builder (`OutreachBuilder.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Draft and send outreach messages |
| **Appears** | Job Detail page |
| **Data Needed** | Message draft, selected contact name, job context |
| **Key Feature** | "Generate Outreach" button creates personalized message |
| **Events Triggered** | Generate, Copy, Mark as Sent |

### 4.5 Follow-up Scheduler (`FollowUpScheduler.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Schedule and track follow-up messages |
| **Appears** | Job Detail page (after outreach sent) |
| **Data Needed** | Follow-up date, message |
| **Events Triggered** | Copy, Mark as Sent |

### 4.6 Progress Tracker (`ProgressTracker.tsx`)

| Property | Description |
|----------|-------------|
| **Purpose** | Visual milestone checklist for outreach journey |
| **Appears** | Job Detail page |
| **Data Needed** | `milestones` object, `progress` number |
| **Milestones Tracked** | Resume tailored, Contact selected, Outreach sent, Follow-up sent, Reply received, Meeting scheduled, Outcome recorded |

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
  
  // Core fields (extracted from LinkedIn URL)
  title: string;                 // Required
  company: string;               // Required
  url: string;                   // Original LinkedIn job URL
  description?: string;          // Job description (scraped)
  companyLogoUrl?: string;       // Optional
  dueDate?: string;              // Application deadline
  
  // Pipeline tracking
  status: JobStatus;             // Required, enum
  progress: number;              // 0-100, calculated from milestones
  
  // Outreach tracking flags
  hasSelectedContact: boolean;
  hasOutreachDraft: boolean;
  outreachMarkedSent: boolean;
  
  // Relations
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
  interviewScheduled: boolean;   // Kept for future use
  outcomeRecorded: boolean;
  
  // Interview prep milestones POSTPONED
  // interviewPrep1: boolean;
  // interviewPrep2: boolean;
  // interviewPrep3: boolean;
}
```

#### Contact

```typescript
interface Contact {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  name: string;                  // Required
  title: string;                 // Job title at company
  relationship: 'Recruiter' | 'Hiring Manager' | 'Team Lead' | 'Employee';
  confidence: 'High' | 'Medium' | 'Low';  // How confident we are this is right person
  source: string;                // e.g., 'LinkedIn', 'Company Website'
  profileUrl?: string;           // LinkedIn profile URL
  isSelected: boolean;           // Is this the selected contact for outreach?
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

#### FollowUp

```typescript
interface FollowUp {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  recommendedDate: Date;         // When to follow up
  message: string;               // Follow-up message content
  sent: boolean;
  sentAt?: Date;
}
```

#### ActivityLog

```typescript
interface ActivityLog {
  id: string;                    // UUID
  jobId: string;                 // FK to Job
  action: string;                // Description of action
  timestamp: Date;
  createdBy: 'user' | 'system';
}
```

#### InboxAction (Computed, NOT stored)

```typescript
interface InboxAction {
  id: string;                    // Computed: `${jobId}-${type}`
  type: InboxActionType;
  title: string;
  subtitleTag: string;
  linkedJobId: string;
  companyName: string;
  roleTitle: string;
  isCompleted: boolean;
  isSnoozed: boolean;
  category: 'priority' | 'waiting' | 'setup';
}
```

### 5.2 Entity Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                          User                                 │
│  has many: Jobs                                              │
└──────────────────────────────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────────────────────────────────┐
│                          Job                                  │
│  belongs to: User                                            │
│  has one: JobMilestone, FollowUp                             │
│  has many: Contacts, OutreachMessages, ActivityLogs          │
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
| Progress auto-calculation | Progress = (completed milestones / total milestones) * 100 |
| Follow-up scheduling | Default 5 days after outreach sent |
| Activity logging | Auto-log status changes, milestone completions |
| Job creation | Only via URL paste + scraping (not manual entry) |

---

## 6. Recommended Database Structure

This section provides the **recommended database schema** for implementation.

### 6.1 SQL Schema (PostgreSQL/Supabase)

```sql
-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE job_status AS ENUM (
  'Interested',
  'Outreach Ready',
  'Outreach Sent',
  'Replied',
  'Meeting Booked',
  'Interviewing',
  'Offer',
  'Closed'
);

CREATE TYPE contact_relationship AS ENUM (
  'Recruiter',
  'Hiring Manager',
  'Team Lead',
  'Employee'
);

CREATE TYPE confidence_level AS ENUM (
  'High',
  'Medium',
  'Low'
);

CREATE TYPE message_type AS ENUM (
  'initial',
  'followup'
);

CREATE TYPE outcome_type AS ENUM (
  'Offer',
  'Rejected',
  'Withdrew',
  'No response'
);

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  daily_goal INTEGER DEFAULT 5,
  timezone TEXT DEFAULT 'America/New_York',
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Core fields (from LinkedIn scraping)
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  company_logo_url TEXT,
  due_date DATE,
  
  -- Pipeline tracking
  status job_status NOT NULL DEFAULT 'Interested',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Outreach flags
  has_selected_contact BOOLEAN DEFAULT false,
  has_outreach_draft BOOLEAN DEFAULT false,
  outreach_marked_sent BOOLEAN DEFAULT false,
  
  -- Additional data
  selected_contact_id UUID,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  outcome outcome_type,
  outcome_reflection TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Milestones table
CREATE TABLE public.job_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  resume_tailored BOOLEAN DEFAULT false,
  contact_selected BOOLEAN DEFAULT false,
  outreach_sent BOOLEAN DEFAULT false,
  follow_up_sent BOOLEAN DEFAULT false,
  reply_received BOOLEAN DEFAULT false,
  interview_scheduled BOOLEAN DEFAULT false,
  outcome_recorded BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  title TEXT,
  relationship contact_relationship,
  confidence confidence_level DEFAULT 'Medium',
  source TEXT DEFAULT 'LinkedIn',
  profile_url TEXT,
  is_selected BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Messages table
CREATE TABLE public.outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  message TEXT NOT NULL,
  type message_type NOT NULL DEFAULT 'initial',
  sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-ups table
CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  recommended_date DATE NOT NULL,
  message TEXT,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'user' CHECK (created_by IN ('user', 'system'))
);

-- Inbox Action State table (for snooze/complete persistence)
CREATE TABLE public.inbox_action_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,  -- e.g., "job123-FIND_CONTACTS"
  
  is_snoozed BOOLEAN DEFAULT false,
  snoozed_until TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, action_key)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_contacts_job_id ON public.contacts(job_id);
CREATE INDEX idx_outreach_messages_job_id ON public.outreach_messages(job_id);
CREATE INDEX idx_activity_logs_job_id ON public.activity_logs(job_id);
CREATE INDEX idx_inbox_states_user_id ON public.inbox_action_states(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_action_states ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Jobs: users can only access their own jobs
CREATE POLICY "Users can view own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Similar policies for all other tables...
-- (Contacts, Milestones, Messages, etc. follow same pattern via job_id -> user_id)

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create milestones when job is created
CREATE OR REPLACE FUNCTION public.handle_new_job()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.job_milestones (job_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_job_created
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_job();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### 6.2 Collections Summary

| Collection/Table | Purpose | Primary Key | Foreign Keys |
|------------------|---------|-------------|--------------|
| `profiles` | User profiles | `id` (from auth.users) | - |
| `jobs` | Job opportunities | `id` | `user_id` → profiles |
| `job_milestones` | Progress tracking | `id` | `job_id` → jobs |
| `contacts` | Outreach contacts | `id` | `job_id` → jobs |
| `outreach_messages` | Message drafts/sent | `id` | `job_id` → jobs, `contact_id` → contacts |
| `follow_ups` | Follow-up scheduling | `id` | `job_id` → jobs |
| `activity_logs` | Audit trail | `id` | `job_id` → jobs |
| `inbox_action_states` | Snooze/complete state | `id` | `user_id` → profiles |

### 6.3 Key Database Considerations

1. **UUID everywhere** — Use UUIDs for all primary keys
2. **Soft delete optional** — Could add `deleted_at` column if undo is needed
3. **RLS is critical** — Every table needs row-level security
4. **Cascade deletes** — When job deleted, all related data deleted
5. **No file storage in DB** — Use Supabase Storage for attachments (future)

---

## 7. API Contract Draft

### 7.1 Authentication Endpoints

```
POST   /auth/signup           Create new account
POST   /auth/login            Login with email/password
POST   /auth/logout           End session
POST   /auth/refresh          Refresh access token
GET    /auth/me               Get current user
```

### 7.2 User Endpoints

```
GET    /users/me              Get current user profile
PATCH  /users/me              Update user profile
```

### 7.3 Job Endpoints

#### Create Job from URL (Core Feature)
```
POST /jobs

Body:
{
  url: string     // LinkedIn job posting URL (REQUIRED)
}

Backend Process:
1. Validate URL is a LinkedIn job posting
2. Scrape page content using Firecrawl or similar
3. Extract: title, company, description, logo, deadline
4. Create job record with status "Interested"
5. Auto-create empty milestones record
6. Log activity: "Job added"

Response: { job: Job }

Auth: Required
Errors:
- 400 Invalid URL
- 400 Could not extract job data
- 422 URL scraping failed
```

#### List Jobs
```
GET /jobs

Query params:
- status: JobStatus (optional)
- search: string (optional, search title/company)
- limit: number (default: 50)
- offset: number (default: 0)

Response:
{
  jobs: Job[],
  total: number
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
  followUp: FollowUp | null,
  activityTimeline: ActivityLog[]
}

Auth: Required
```

#### Update Job
```
PATCH /jobs/:id

Body (all optional):
{
  status?: JobStatus,
  selectedContactId?: string,
  notes?: string,
  tags?: string[],
  outcome?: Outcome,
  outcomeReflection?: string
}

Response: { job: Job }

Auth: Required
```

#### Delete Job
```
DELETE /jobs/:id

Response: { success: true }

Auth: Required
```

### 7.4 Contact Discovery Endpoint

```
POST /jobs/:id/discover-contacts

Purpose: Use AI/scraping to find potential contacts at the company

Response:
{
  contacts: Contact[]   // Newly discovered contacts
}

Backend Process:
1. Get company name from job
2. Search LinkedIn/company website for relevant people
3. Score contacts by relevance (Recruiter > HM > Employee)
4. Save contacts to database
5. Log activity: "Contacts discovered"

Auth: Required
```

### 7.5 Outreach Generation Endpoint

```
POST /jobs/:id/generate-outreach

Body:
{
  contactId: string,
  type: 'initial' | 'followup'
}

Response:
{
  message: OutreachMessage
}

Backend Process:
1. Get job details, contact info, user profile
2. Generate personalized message using AI
3. Save as draft (sentAt = null)
4. Update job: hasOutreachDraft = true
5. Log activity: "Outreach draft created"

Auth: Required
```

### 7.6 Milestone Endpoints

```
PATCH /jobs/:id/milestones

Body:
{
  resumeTailored?: boolean,
  contactSelected?: boolean,
  outreachSent?: boolean,
  followUpSent?: boolean,
  replyReceived?: boolean,
  outcomeRecorded?: boolean
}

Response: { milestones: JobMilestone, progress: number }

Auth: Required
```

### 7.7 Dashboard Stats Endpoint

```
GET /dashboard/stats

Response:
{
  dailyGoal: number,
  completedToday: number,
  coffeeChatsTotal: number,     // Jobs where status reached "Meeting Booked"
  interviewsTotal: number,      // Jobs where status = "Interviewing"
  tasksTotal: number,           // Count of pending inbox actions
  tasksCompleted: number,       // Count of completed actions
  jobsByStatus: { [status: string]: number }
}

Auth: Required
```

### 7.8 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "URL is required",
    "details": {
      "field": "url",
      "constraint": "required"
    }
  }
}
```

---

## 8. State & Hardcoded Data Replacement

### 8.1 Hardcoded Data Locations

| File | Hardcoded Data | Replace With |
|------|----------------|--------------|
| `src/data/jobs.ts` | `sampleJobs[]` array with 8 fake jobs | `GET /jobs` API response |
| `src/pages/Index.tsx` | `goal={5}`, `completed={2}`, etc. | `GET /dashboard/stats` |
| `src/components/Header.tsx` | User name, username, avatar | Authenticated user from `GET /auth/me` |
| `src/components/job-detail/OutreachBuilder.tsx` | Default message template | AI-generated via `POST /jobs/:id/generate-outreach` |
| `src/components/job-detail/FollowUpScheduler.tsx` | Default message, "5 days" | Calculated from outreach send date |

### 8.2 State Management Recommendations

1. **React Query (TanStack Query)** — Already installed, use for:
   - Fetching and caching jobs
   - Automatic refetching
   - Optimistic updates

2. **Auth Context** — Create for:
   - Current user session
   - Login/logout functions

3. **Keep Local State For:**
   - UI toggles (collapsed sections, hover states)
   - Form drafts (before save)
   - Search/filter inputs

---

## 9. Authentication & Authorization

### 9.1 Required Auth Flows

| Flow | Description | Priority |
|------|-------------|----------|
| **Sign Up** | Email + password registration | High |
| **Login** | Email + password authentication | High |
| **Logout** | End session | High |
| **Session Refresh** | Auto-refresh tokens | High |

### 9.2 Protected Actions

| Action | Auth Required | Owner Check |
|--------|---------------|-------------|
| View dashboard | Yes | N/A |
| View jobs | Yes | Only own jobs |
| Create job | Yes | N/A |
| Edit/delete job | Yes | Must be owner |
| Update profile | Yes | Self only |

---

## 10. Admin / CMS Needs

### 10.1 Admin Features (Future Phase)

| Feature | Description |
|---------|-------------|
| User Management | View users, disable accounts |
| Template Management | Outreach message templates |
| System Settings | Default goals, feature flags |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Requirement | Target |
|-------------|--------|
| API response time | < 500ms p95 |
| URL scraping | < 5 seconds |
| Job list pagination | 50 items per page |

### 11.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Input validation | Server-side validation for all inputs |
| URL validation | Validate LinkedIn job URLs before scraping |
| Rate limiting | 100 requests/minute per user |
| RLS | All tables have row-level security |

---

## 12. Open Questions & Assumptions

### 12.1 Assumptions Made

1. **Single user per account** — No team/shared workspaces
2. **LinkedIn focus** — Primary job source is LinkedIn URLs
3. **No calendar integration** — Removed from scope
4. **No interview prep** — Postponed to future version

### 12.2 Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | What scraping service for LinkedIn jobs? | Firecrawl, Apify, custom? |
| 2 | What AI service for outreach generation? | OpenAI, Anthropic, etc.? |
| 3 | How to discover contacts? | LinkedIn Sales Nav, Apollo, manual? |
| 4 | Should URL scraping happen sync or async? | UX decision |
| 5 | Email notifications needed for MVP? | Scope |

### 12.3 Recommended MVP Scope

**Include in MVP:**
- User auth (email/password)
- Job creation via URL paste + scraping
- Contact discovery (manual add initially, AI later)
- Outreach message generation
- Outreach/follow-up tracking
- Dashboard stats
- Kanban board visualization

**Defer to v2:**
- Interview prep mode
- Calendar integration
- File attachments
- Email notifications
- AI contact discovery

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2025 | Lovable AI | Initial document |
| 1.1 | Jan 2025 | Lovable AI | Reframe as outreach tool, remove calendar, add database schema, clarify job input flow |

---

**END OF DOCUMENT**
