# Jobless — Website Blueprint & Component Documentation

> **Document Purpose**: This blueprint provides a comprehensive technical and UX overview of the "Jobless" job search dashboard application. It is designed for UI/UX consultants, developers, and stakeholders to understand the complete architecture, component hierarchy, user flows, and design system.

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Technology Stack](#technology-stack)
3. [Design System](#design-system)
4. [Information Architecture](#information-architecture)
5. [Page-by-Page Breakdown](#page-by-page-breakdown)
6. [Component Library](#component-library)
7. [Data Models](#data-models)
8. [User Flows](#user-flows)
9. [Navigation Structure](#navigation-structure)

---

## Application Overview

**Jobless** is a modern job search management dashboard designed to help job seekers:
- Track job applications through a visual Kanban pipeline
- Manage networking outreach and follow-ups
- Prepare for interviews with structured prep workflows
- Maintain an organized inbox of actionable tasks
- Schedule and track job-related events

### Core Value Proposition
Transform the chaotic job search process into a structured, gamified experience with clear next steps and progress tracking.

### Target Users
- Active job seekers
- Career changers
- Professionals managing multiple job applications simultaneously

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 with TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS with CSS Variables |
| **UI Components** | shadcn/ui (Radix UI primitives) |
| **Routing** | React Router DOM v6 |
| **State Management** | React useState + TanStack Query |
| **Icons** | Lucide React |
| **Date Utilities** | date-fns |
| **Animations** | Tailwind CSS Animate |

---

## Design System

### Typography

| Usage | Font Family | Weight |
|-------|-------------|--------|
| **Headings** (H1, H2, H3) | Playfair Display (Serif) | 600-700 |
| **Body Text** | Inter (Sans-serif) | 400-700 |

### Color Palette

#### Core Colors (HSL Values)

| Token | Light Mode | Purpose |
|-------|------------|---------|
| `--background` | `40 20% 96%` | Page background (warm cream) |
| `--foreground` | `220 20% 15%` | Primary text color |
| `--card` | `0 0% 100%` | Card backgrounds (white) |
| `--primary` | `24 100% 62%` | Primary actions (warm orange) |
| `--muted` | `40 20% 92%` | Muted backgrounds |
| `--border` | `40 20% 88%` | Border color |

#### Accent Card Colors

| Token | Color | Usage |
|-------|-------|-------|
| `--card-yellow` | `45 100% 85%` | Daily Goal Card |
| `--card-lavender` | `270 60% 92%` | Metrics Card |
| `--card-pink` | `350 80% 92%` | Tasks Card |
| `--card-dark` | `220 20% 15%` | Dark variant cards |

#### Sidebar Colors

| Token | Value | Purpose |
|-------|-------|---------|
| `--sidebar-background` | White | Sidebar bg |
| `--sidebar-primary` | `45 100% 55%` | Active nav item (yellow) |
| `--sidebar-foreground` | `220 10% 50%` | Nav text |

### Spacing & Layout

- **Border Radius**: `1rem` (16px) default for cards
- **Grid System**: CSS Grid with responsive breakpoints
- **Main Content Offset**: `ml-20` (80px) to accommodate fixed sidebar

### Component Variants

Buttons, badges, and interactive elements use consistent rounded corners (`rounded-xl`, `rounded-2xl`, `rounded-full`) for a soft, modern aesthetic.

---

## Information Architecture

```
Jobless/
├── Home (Dashboard)
│   ├── Daily Goal Progress
│   ├── Networking Metrics
│   ├── Tasks Overview
│   ├── Inbox Preview (Top 3 Actions)
│   └── Jobs Preview (Recent Jobs)
│
├── Inbox
│   ├── Priority Actions Section
│   ├── Waiting/Nudges Section
│   ├── Setup Gaps Section
│   ├── Snoozed Items
│   └── Completed Items
│
├── Jobs (Kanban Board)
│   ├── Pipeline Columns (8 stages)
│   ├── Job Cards
│   ├── Filters Panel
│   └── Search & View Controls
│
├── Job Detail
│   ├── Job Header & Status
│   ├── Progress Tracker
│   ├── Contact Discovery
│   ├── Outreach Builder
│   ├── Follow-up Scheduler
│   ├── Interview Mode (conditional)
│   ├── Outcome Section
│   ├── Pitch Deck Panel
│   ├── Flash Cards
│   ├── Notes & Attachments
│   └── Activity Timeline
│
├── Calendar
│   ├── Month/Week/Day/Agenda Views
│   ├── Event Filters
│   ├── Event Details Panel
│   └── Mini Calendar Sidebar
│
├── Resume (placeholder)
└── Settings (placeholder)
```

---

## Page-by-Page Breakdown

### 1. Home / Dashboard (`/`)

**File**: `src/pages/Index.tsx`

**Purpose**: Central command center providing at-a-glance overview of job search progress and immediate action items.

#### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Header (Logo, Search, Profile)           │
│            │                                            │
│   Home     │  Page Title: "Dashboard"                   │
│   Inbox    │                                            │
│   Jobs     │  ┌────────┬────────┬────────┐              │
│   Resume   │  │ Daily  │Metrics │ Tasks  │              │
│            │  │ Goal   │  Card  │  Card  │              │
│            │  └────────┴────────┴────────┘              │
│   Support  │                                            │
│   Settings │  ┌──────────────┬──────────────┐           │
│            │  │ Inbox Preview│ Jobs Preview │           │
│   Logout   │  │ (3 items)    │ (3 items)    │           │
│            │  └──────────────┴──────────────┘           │
└─────────────────────────────────────────────────────────┘
```

#### Components Used
| Component | Purpose |
|-----------|---------|
| `Sidebar` | Fixed navigation |
| `Header` | Search, notifications, profile |
| `DailyGoalCard` | Shows jobs-to-apply progress |
| `MetricsCard` | Coffee chats & interviews count |
| `TasksCard` | Today's task completion |
| `InboxPreview` | Top 3 priority actions |
| `JobsPreview` | Recent job applications |

---

### 2. Inbox Page (`/inbox`)

**File**: `src/pages/Inbox.tsx`

**Purpose**: Interactive action center that aggregates all pending tasks derived from job pipeline states. Designed to feel like an email inbox but for job search actions.

#### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │  Inbox               [Search] [View Toggle] │
│           │                                              │
│           │  ▼ Priority Actions (6)                      │
│           │    ┌─────────────────────────────────────┐   │
│           │    │ 🔵 Prep interview — Google (PM)     │   │
│           │    │    Interview Prep     [Day 2/3]    │   │
│           │    │              [Start] [Snooze] [✓]  │   │
│           │    └─────────────────────────────────────┘   │
│           │                                              │
│           │  ▼ Waiting / Nudges (3)                      │
│           │    • Waiting items...                        │
│           │                                              │
│           │  ▼ Setup Gaps (2)                            │
│           │    • Setup items...                          │
│           │                                              │
│           │  ▶ Snoozed (collapsed)                       │
│           │  ▶ Completed (collapsed)                     │
└─────────────────────────────────────────────────────────┘
```

#### Inbox Action Types
| Type | Trigger Condition | Action |
|------|-------------------|--------|
| `FIND_CONTACTS` | `!hasSelectedContact` | Opens Contact Discovery |
| `GENERATE_OUTREACH` | Has contact, no draft | Opens Outreach Builder |
| `SEND_OUTREACH` | Has draft, not sent | Mark as sent |
| `WAITING_NUDGE` | Status = "Outreach Sent" | Follow-up prompt |
| `LOG_REPLY` | Status = "Replied" | Log response |
| `INTERVIEW_PREP` | Status = "Interviewing" | 3-day prep sequence |
| `RATE_FIT` | `!fitScore` | Set fit score |

#### Components Used
| Component | Purpose |
|-----------|---------|
| `InboxRow` | Individual action item with controls |
| `Collapsible` | Section expand/collapse |
| `Button` | Start, Snooze, Mark Done |
| `DropdownMenu` | More actions menu |

---

### 3. Jobs Page (`/jobs`)

**File**: `src/pages/Jobs.tsx`

**Purpose**: Visual Kanban board for managing job applications through the pipeline. Inspired by Trello's board interaction model.

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Jobs                              [+ Create Job]       │
│           │                                                          │
│           │  [Search...] [Filters] [Board|List] [Hide Empty]        │
│           │                                                          │
│           │  ┌───────────┬───────────┬───────────┬───────────┐      │
│           │  │Interested │ Outreach  │ Outreach  │  Replied  │ ...  │
│           │  │    (3)    │  Ready(2) │  Sent(1)  │    (0)    │      │
│           │  │           │           │           │           │      │
│           │  │ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │           │      │
│           │  │ │Job    │ │ │Job    │ │ │Job    │ │           │      │
│           │  │ │Card   │ │ │Card   │ │ │Card   │ │           │      │
│           │  │ └───────┘ │ └───────┘ │ └───────┘ │           │      │
│           │  │           │           │           │           │      │
│           │  │ ┌───────┐ │           │           │           │      │
│           │  │ │Job    │ │           │           │           │      │
│           │  │ │Card   │ │           │           │           │      │
│           │  │ └───────┘ │           │           │           │      │
│           │  └───────────┴───────────┴───────────┴───────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Pipeline Stages (Columns)
| Stage | Description |
|-------|-------------|
| **Interested** | Jobs saved for consideration |
| **Outreach Ready** | Ready to reach out to contacts |
| **Outreach Sent** | Initial outreach message sent |
| **Replied** | Received a response |
| **Meeting Booked** | Coffee chat or call scheduled |
| **Interviewing** | Active interview process |
| **Offer** | Received job offer |
| **Closed** | Process complete (any outcome) |

#### Components Used
| Component | Purpose |
|-----------|---------|
| `KanbanBoard` | Main board container with state |
| `KanbanColumn` | Individual pipeline stage column |
| `KanbanCard` | Job card within column |
| `KanbanFilters` | Side panel filter drawer |

#### Key Features
- **Drag & Drop**: Move cards between columns
- **WIP Limits**: Set maximum cards per column
- **Search**: Filter by job title, company, tags
- **Filters**: Role family, work mode, fit score, company, tags, status
- **View Toggle**: Board view / List view

---

### 4. Job Detail Page (`/job/:id`)

**File**: `src/pages/JobDetail.tsx`

**Purpose**: Comprehensive workspace for managing a single job application with all related tools and information.

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  ← Back to Dashboard                                    │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐ │
│           │  │ Company Name                                        │ │
│           │  │ JOB TITLE                              Status: ▼    │ │
│           │  │ Deadline: Jan 15  |  View Job Posting →             │ │
│           │  │ [Description - expandable]                          │ │
│           │  └────────────────────────────────────────────────────┘ │
│           │                                                          │
│           │  ┌─────────────────────────┐ ┌────────────────────────┐ │
│           │  │ Left Column (2/3)       │ │ Right Column (1/3)     │ │
│           │  │                         │ │                        │ │
│           │  │ • Progress Tracker      │ │ • Pitch Deck Panel     │ │
│           │  │ • Contact Discovery     │ │ • Flash Cards Panel    │ │
│           │  │ • Outreach Builder      │ │ • Notes & Attachments  │ │
│           │  │ • Follow-up Scheduler   │ │ • Activity Timeline    │ │
│           │  │ • Interview Mode*       │ │                        │ │
│           │  │ • Outcome Section       │ │                        │ │
│           │  │                         │ │                        │ │
│           │  └─────────────────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
* Interview Mode only shows when status = "Interviewing"
```

#### Sub-Components
| Component | Purpose |
|-----------|---------|
| `ProgressTracker` | Visual milestone checklist with progress bar |
| `ContactDiscovery` | List potential contacts with confidence scores |
| `OutreachBuilder` | Draft and track outreach messages |
| `FollowUpScheduler` | Schedule and manage follow-up communications |
| `InterviewMode` | 3-day structured interview prep workflow |
| `OutcomeSection` | Record final outcome with reflection |
| `PitchDeckPanel` | Prepare talking points and stories |
| `FlashCardsPanel` | Interview question flash cards |
| `NotesAttachments` | Free-form notes and file uploads |
| `ActivityTimeline` | Chronological activity log |

---

### 5. Calendar Page (`/calendar`)

**File**: `src/pages/Calendar.tsx`

**Purpose**: Schedule and visualize job-related events including interviews, coffee chats, follow-ups, and personal reminders.

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Calendar Sidebar]  │  Calendar Header                  │
│           │                     │  < January 2025 >  [M W D A]      │
│           │  Mini Calendar      │                    [Today]        │
│           │  ┌─────────────┐    │  ┌───────────────────────────────┐│
│           │  │  Jan 2025   │    │  │                               ││
│           │  │ S M T W T F S│    │  │    Month/Week/Day/Agenda     ││
│           │  │   1 2 3 4 5  │    │  │         View Area            ││
│           │  │ 6 7 8 9...   │    │  │                               ││
│           │  └─────────────┘    │  │                               ││
│           │                     │  │                               ││
│           │  [+ Create Event]   │  │                               ││
│           │                     │  └───────────────────────────────┘│
│           │  Filters:           │                                    │
│           │  ☑ Jobs             │  [Event Details Panel - on click] │
│           │  ☑ Interviews       │                                    │
│           │  ☑ Coffee Chats     │                                    │
│           │  ☑ Follow-ups       │                                    │
│           │  ☑ Personal         │                                    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Event Types
| Type | Color | Purpose |
|------|-------|---------|
| `job` | Blue | Job-related deadlines |
| `outreach` | Teal | Outreach reminders |
| `interview` | Purple | Interview appointments |
| `coffee-chat` | Orange | Networking calls |
| `follow-up` | Yellow | Follow-up reminders |
| `relationship` | Pink | Relationship nurturing |
| `personal` | Light Blue | Personal events |

#### View Options
- **Month View**: Traditional calendar grid
- **Week View**: 7-day horizontal layout
- **Day View**: Single day detailed schedule
- **Agenda View**: List of upcoming events

#### Components Used
| Component | Purpose |
|-----------|---------|
| `CalendarSidebar` | Mini calendar, create button, filters |
| `CalendarHeader` | Navigation, view switcher, search |
| `MonthView` | Monthly calendar grid |
| `WeekView` | Weekly calendar layout |
| `DayView` | Daily schedule view |
| `AgendaView` | Event list view |
| `EventDetailsPanel` | Create/edit event slide-over |

---

### 6. Not Found Page (`/404`)

**File**: `src/pages/NotFound.tsx`

**Purpose**: Catch-all route for undefined paths.

---

## Component Library

### Layout Components

#### `Sidebar` (`src/components/Sidebar.tsx`)
Fixed left navigation with icon-only design.

| Element | Description |
|---------|-------------|
| **Position** | Fixed, left side, full height |
| **Width** | 80px (`w-20`) |
| **Nav Items** | Home, Inbox, Jobs, Resume |
| **Bottom Items** | Support, Settings, Logout |
| **Active State** | Yellow background (`sidebar-primary`) |

#### `Header` (`src/components/Header.tsx`)
Top header bar with branding, search, and user profile.

| Element | Description |
|---------|-------------|
| **Logo** | "Jobless" with Playfair Display font |
| **Search** | Rounded input with search button |
| **Notifications** | Bell icon button |
| **Profile** | Avatar + name + username |

---

### Dashboard Cards

#### `DailyGoalCard` (`src/components/DailyGoalCard.tsx`)
Yellow accent card showing daily job application goal progress.

| Prop | Type | Description |
|------|------|-------------|
| `goal` | number | Target number of applications |
| `completed` | number | Completed applications |

**Visual Elements**: Progress bar, fraction display, remaining count

#### `MetricsCard` (`src/components/MetricsCard.tsx`)
Lavender accent card displaying networking metrics.

| Prop | Type | Description |
|------|------|-------------|
| `coffeeChats` | number | Coffee chat count |
| `interviews` | number | Interview count |

**Visual Elements**: Icon + label + count for each metric

#### `TasksCard` (`src/components/TasksCard.tsx`)
Pink accent card showing today's task completion.

| Prop | Type | Description |
|------|------|-------------|
| `totalTasks` | number | Total tasks |
| `completedTasks` | number | Completed tasks |

**Visual Elements**: Progress bar, fraction display, remaining count

---

### Inbox Components

#### `InboxPreview` (`src/components/inbox/InboxPreview.tsx`)
Compact preview of top 3 inbox actions for dashboard.

| Prop | Type | Description |
|------|------|-------------|
| `jobs` | Job[] | Jobs array to derive actions from |
| `onActionComplete` | function | Callback when action completed |

#### `InboxRow` (`src/components/inbox/InboxRow.tsx`)
Individual action item row with interactive controls.

| Prop | Type | Description |
|------|------|-------------|
| `action` | InboxAction | Action data |
| `onMarkDone` | function | Mark complete callback |
| `onSnooze` | function | Snooze callback |
| `onStart` | function | Start action callback |

**Visual Elements**: Type icon, title, subtitle, day progress, action buttons

---

### Jobs/Kanban Components

#### `JobsPreview` (`src/components/jobs/JobsPreview.tsx`)
Compact preview of recent jobs for dashboard.

| Prop | Type | Description |
|------|------|-------------|
| `jobs` | Job[] | Jobs array |

**Visual Elements**: Job list, create button, go to jobs link

#### `KanbanBoard` (`src/components/kanban/KanbanBoard.tsx`)
Main Kanban board container managing all columns and state.

| Prop | Type | Description |
|------|------|-------------|
| `jobs` | Job[] | All jobs |
| `onJobsChange` | function | Callback when jobs updated |

**Features**: Search, filters, view toggle, drag-drop handling

#### `KanbanColumn` (`src/components/kanban/KanbanColumn.tsx`)
Individual pipeline stage column.

| Prop | Type | Description |
|------|------|-------------|
| `status` | JobStatus | Column status |
| `jobs` | Job[] | Jobs in column |
| `wipLimit` | number? | Work-in-progress limit |
| `onDrop` | function | Drop handler |
| `onDragStart` | function | Drag start handler |
| `onMoveJob` | function | Manual move handler |
| `onWipLimitChange` | function | WIP limit update handler |

**Visual Elements**: Header with count, WIP indicator, cards, column menu

#### `KanbanCard` (`src/components/kanban/KanbanCard.tsx`)
Individual job card within a column.

| Prop | Type | Description |
|------|------|-------------|
| `job` | Job | Job data |
| `onMoveJob` | function | Move to column handler |
| `onDragStart` | function | Drag start handler |

**Visual Elements**: Company logo, title, fit badge, tags, progress bar, next step button

#### `KanbanFilters` (`src/components/kanban/KanbanFilters.tsx`)
Side panel drawer for filtering jobs.

| Filter | Type | Options |
|--------|------|---------|
| Role Family | Multi-select | PM, SWE, DS, Design, Other |
| Work Mode | Multi-select | Remote, Hybrid, On-site |
| Fit Score | Button group | High, Medium, Low |
| Company | Text input | Free text |
| Tags | Multi-select | Dynamic from jobs |
| Status | Checkbox list | All pipeline stages |

---

### Job Detail Components

#### `ProgressTracker` (`src/components/job-detail/ProgressTracker.tsx`)
Visual checklist of job application milestones.

| Milestone | Description |
|-----------|-------------|
| Resume Tailored | Resume customized for role |
| Contact Selected | Identified target contact |
| Outreach Sent | Initial message sent |
| Follow-up Sent | Follow-up message sent |
| Reply Received | Got a response |
| Interview Scheduled | Interview booked |
| Interview Prep 1 | Day 1 prep complete |
| Interview Prep 2 | Day 2 prep complete |
| Interview Prep 3 | Day 3 prep complete |
| Outcome Recorded | Final outcome logged |

#### `ContactDiscovery` (`src/components/job-detail/ContactDiscovery.tsx`)
List and select potential contacts for outreach.

| Contact Field | Description |
|---------------|-------------|
| Name | Contact name |
| Title | Job title |
| Relationship | Recruiter/Hiring Manager/Team Lead/Employee |
| Confidence | High/Medium/Low match confidence |
| Source | Where found (LinkedIn, referral, etc.) |

#### `OutreachBuilder` (`src/components/job-detail/OutreachBuilder.tsx`)
Draft and track outreach messages.

| Feature | Description |
|---------|-------------|
| Message Editor | Textarea for message content |
| Copy Button | Copy to clipboard |
| Mark Sent | Record message as sent |
| History | Log of sent messages |

#### `FollowUpScheduler` (`src/components/job-detail/FollowUpScheduler.tsx`)
Schedule and manage follow-up communications.

| Feature | Description |
|---------|-------------|
| Date Picker | Select follow-up date |
| Message Template | Editable follow-up message |
| Copy/Mark Sent | Same as outreach |

#### `InterviewMode` (`src/components/job-detail/InterviewMode.tsx`)
Structured 3-day interview preparation workflow.

| Day | Focus |
|-----|-------|
| Day 1 | Company research, role understanding |
| Day 2 | STAR story preparation |
| Day 3 | Mock interviews, logistics |

**Features**: Date input, reminder toggle, day completion tracking

#### `OutcomeSection` (`src/components/job-detail/OutcomeSection.tsx`)
Record final application outcome with optional reflection.

| Outcome | Description |
|---------|-------------|
| Offer | Received job offer |
| Rejected | Application rejected |
| Withdrew | Candidate withdrew |
| No Response | No response received |

**Features**: Outcome selection, reflection textarea, clone job button

#### `PitchDeckPanel` (`src/components/job-detail/PitchDeckPanel.tsx`)
Prepare talking points and stories for interviews.

#### `FlashCardsPanel` (`src/components/job-detail/FlashCardsPanel.tsx`)
Interview question flash cards with STAR format.

| Field | Description |
|-------|-------------|
| Title | Question/topic |
| Strength | Key strength demonstrated |
| Evidence | Supporting example |
| Impact | Result/outcome |

#### `NotesAttachments` (`src/components/job-detail/NotesAttachments.tsx`)
Free-form notes and file management.

| Feature | Description |
|---------|-------------|
| Notes | Textarea for notes |
| Attachments | File upload area |
| Tags | Add/remove tags |

#### `ActivityTimeline` (`src/components/job-detail/ActivityTimeline.tsx`)
Chronological log of all job-related activities.

---

### Calendar Components

#### `CalendarSidebar` (`src/components/calendar/CalendarSidebar.tsx`)
Left sidebar with mini calendar, create button, and filters.

#### `CalendarHeader` (`src/components/calendar/CalendarHeader.tsx`)
Top bar with navigation, view switcher, and search.

#### `MonthView` (`src/components/calendar/MonthView.tsx`)
Traditional monthly calendar grid.

#### `WeekView` (`src/components/calendar/WeekView.tsx`)
7-day horizontal view with time slots.

#### `DayView` (`src/components/calendar/DayView.tsx`)
Single day detailed schedule.

#### `AgendaView` (`src/components/calendar/AgendaView.tsx`)
List view of upcoming events.

#### `EventDetailsPanel` (`src/components/calendar/EventDetailsPanel.tsx`)
Create and edit event slide-over panel.

---

## Data Models

### Job Model (`src/types/job.ts`)

```typescript
interface Job {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  dueDate: string;
  status: JobStatus;
  url: string;
  description?: string;
  progress: number;
  fitScore?: "High" | "Medium" | "Low" | null;
  workMode?: "Remote" | "Hybrid" | "On-site";
  roleFamily?: "PM" | "SWE" | "DS" | "Design" | "Other";
  hasSelectedContact: boolean;
  hasOutreachDraft: boolean;
  outreachMarkedSent: boolean;
  milestones: JobMilestones;
  contacts?: Contact[];
  tags?: string[];
  outcome?: "Offer" | "Rejected" | "Withdrew" | "No response";
  activityTimeline?: ActivityItem[];
}

type JobStatus = 
  | "Interested"
  | "Outreach Ready"
  | "Outreach Sent"
  | "Replied"
  | "Meeting Booked"
  | "Interviewing"
  | "Offer"
  | "Closed";
```

### Inbox Action Model (`src/types/inbox.ts`)

```typescript
interface InboxAction {
  id: string;
  type: InboxActionType;
  title: string;
  subtitleTag: string;
  linkedJobId: string;
  sequenceTotal?: number;
  sequenceCurrent?: number;
  isCompleted: boolean;
  isSnoozed: boolean;
  category: "priority" | "waiting" | "setup";
}

type InboxActionType = 
  | "FIND_CONTACTS"
  | "GENERATE_OUTREACH"
  | "SEND_OUTREACH"
  | "LOG_REPLY"
  | "INTERVIEW_PREP"
  | "WAITING_NUDGE"
  | "RATE_FIT";
```

### Calendar Event Model (`src/types/calendar.ts`)

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDateTime: Date;
  endDateTime: Date;
  allDay: boolean;
  recurrenceRule: RecurrenceRule;
  reminders: CalendarReminder[];
  linkedJobId?: string;
  linkedContactId?: string;
  notes?: string;
  status: "scheduled" | "done" | "canceled";
}

type CalendarEventType = 
  | "job"
  | "outreach"
  | "interview"
  | "coffee-chat"
  | "follow-up"
  | "relationship"
  | "personal";
```

---

## User Flows

### Flow 1: Adding a New Job

```
[Jobs Page] 
    → Click "+ Create Job"
    → Enter job URL
    → Job created in "Interested" column
    → Click job card to open detail page
    → Set up milestones, contacts, outreach
```

### Flow 2: Processing Inbox Actions

```
[Dashboard or Inbox Page]
    → See prioritized actions
    → Click "Start" on action
    → Navigate to relevant Job Detail section
    → Complete action
    → Click "Mark Done"
    → Action removed from inbox
```

### Flow 3: Moving Job Through Pipeline

```
[Jobs Page - Kanban Board]
    → Drag job card from "Interested" to "Outreach Ready"
    → Status updates automatically
    → New inbox actions generated based on status
    → Continue moving through pipeline
```

### Flow 4: Interview Preparation

```
[Job Detail Page - Status: Interviewing]
    → Interview Mode section appears
    → Set interview date
    → Enable reminders
    → Complete Day 1 prep tasks → Mark complete
    → Complete Day 2 prep tasks → Mark complete  
    → Complete Day 3 prep tasks → Mark complete
    → Conduct interview
    → Record outcome in Outcome Section
```

### Flow 5: Calendar Event Management

```
[Calendar Page]
    → Click "+ Create Event"
    → Event Details Panel slides in
    → Select event type
    → Set title, date/time
    → Link to job (optional)
    → Save event
    → Event appears on calendar
```

---

## Navigation Structure

### Primary Navigation (Sidebar)

| Item | Route | Icon | Description |
|------|-------|------|-------------|
| Home | `/` | Home | Dashboard overview |
| Inbox | `/inbox` | Inbox | Action items feed |
| Jobs | `/jobs` | Briefcase | Kanban board |
| Resume | `/resume` | FileText | Resume management |
| Support | `/support` | Headphones | Help & support |
| Settings | `/settings` | Settings | App settings |

### Secondary Navigation

| Location | Type | Destination |
|----------|------|-------------|
| Dashboard | Card link | Inbox page |
| Dashboard | Card link | Jobs page |
| Job card | Click | Job Detail page |
| Inbox action | Start button | Job Detail section |
| Calendar event | Click | Event Details panel |
| Job Detail | Back button | Dashboard |

---

## Responsive Considerations

- **Sidebar**: Fixed 80px width, icon-only design works at all sizes
- **Main content**: Fluid grid layout (`ml-20` offset)
- **Kanban board**: Horizontal scroll for columns on smaller screens
- **Cards**: Stack vertically on mobile
- **Modals/Panels**: Full-screen on mobile, slide-over on desktop

---

## Accessibility Notes

- **Focus states**: Visible focus rings on interactive elements
- **Color contrast**: WCAG AA compliant with semantic color tokens
- **Keyboard navigation**: Tab order follows visual layout
- **ARIA labels**: Icons have title attributes
- **Motion**: Uses reduced motion preferences where applicable

---

## Future Considerations

1. **Backend Integration**: Currently uses mock data; ready for Supabase/API integration
2. **Real-time Updates**: Structure supports WebSocket integration
3. **Mobile App**: Component architecture supports React Native adaptation
4. **Collaboration**: Multi-user workspace support
5. **AI Features**: Structure allows for AI-powered suggestions and automation

---

*Document generated for Jobless v1.0 — Last updated: December 2024*
