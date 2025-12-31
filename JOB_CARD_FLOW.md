# Job Card Flow & Automation Blueprint

This document details how job cards work in the application, the data structure required, and everything needed to automate job card creation from a job description URL.

---

## Table of Contents

1. [Overview](#overview)
2. [Job Data Model](#job-data-model)
3. [Required Fields for Card Creation](#required-fields-for-card-creation)
4. [Optional Fields](#optional-fields)
5. [Card Visual Components](#card-visual-components)
6. [Pipeline Stages & Status Flow](#pipeline-stages--status-flow)
7. [Progress Calculation](#progress-calculation)
8. [Next Step Logic](#next-step-logic)
9. [Milestones System](#milestones-system)
10. [Automation Requirements](#automation-requirements)
11. [Data Extraction from Job URL](#data-extraction-from-job-url)
12. [Default Values for Automation](#default-values-for-automation)
13. [API Response Schema](#api-response-schema)

---

## Overview

A job card represents a single job opportunity in the user's pipeline. Cards are displayed in a Kanban board with drag-and-drop functionality, and each card contains rich information about the job, company, and application status.

**File Locations:**
- Type Definition: `src/types/job.ts`
- Card Component: `src/components/kanban/KanbanCard.tsx`
- Sample Data: `src/data/jobs.ts`
- Board Component: `src/components/kanban/KanbanBoard.tsx`

---

## Job Data Model

### Core Interface

```typescript
interface Job {
  // === REQUIRED FIELDS ===
  id: string;                    // Unique identifier (UUID recommended)
  title: string;                 // Job title (e.g., "Senior Product Manager")
  company: string;               // Company name (e.g., "Google")
  dueDate: string;               // Target date (e.g., "Jan 5, 2025")
  status: JobStatus;             // Current pipeline stage
  url: string;                   // Original job posting URL
  progress: number;              // 0-100, calculated from milestones
  hasSelectedContact: boolean;   // Has user selected a contact?
  hasOutreachDraft: boolean;     // Has user drafted outreach?
  outreachMarkedSent: boolean;   // Has outreach been sent?
  milestones: Milestones;        // Progress tracking object

  // === OPTIONAL FIELDS ===
  companyLogoUrl?: string;       // Company logo image URL
  description?: string;          // Job description text
  fitScore?: FitScore;           // "High" | "Medium" | "Low" | null
  workMode?: WorkMode;           // "Remote" | "Hybrid" | "On-site"
  roleFamily?: RoleFamily;       // "PM" | "SWE" | "DS" | "Design" | "Other"
  contacts?: Contact[];          // Array of discovered contacts
  selectedContactId?: string;    // ID of selected contact
  outreachMessages?: OutreachMessage[]; // Drafted/sent messages
  followUp?: FollowUp;           // Follow-up message data
  notes?: string;                // User notes
  tags?: string[];               // Custom tags (e.g., ["Dream job", "High priority"])
  outcome?: Outcome;             // Final result when closed
  activityTimeline?: ActivityItem[]; // Activity log
}
```

### Type Definitions

```typescript
type JobStatus = 
  | "Interested"
  | "Outreach Ready"
  | "Outreach Sent"
  | "Replied"
  | "Meeting Booked"
  | "Interviewing"
  | "Offer"
  | "Closed";

type FitScore = "High" | "Medium" | "Low" | null;
type WorkMode = "Remote" | "Hybrid" | "On-site";
type RoleFamily = "PM" | "SWE" | "DS" | "Design" | "Other";
type Outcome = "Offer" | "Rejected" | "Withdrew" | "No response";
```

---

## Required Fields for Card Creation

When creating a new job card (either manually or via automation), these fields are **REQUIRED**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique identifier | `"uuid-1234-5678"` |
| `title` | string | Job title | `"Senior Product Manager"` |
| `company` | string | Company name | `"Google"` |
| `dueDate` | string | Target/deadline date | `"Jan 5, 2025"` |
| `status` | JobStatus | Initial pipeline stage | `"Interested"` |
| `url` | string | Job posting URL | `"https://careers.google.com/..."` |
| `progress` | number | Progress percentage (0-100) | `0` |
| `hasSelectedContact` | boolean | Contact selection status | `false` |
| `hasOutreachDraft` | boolean | Outreach draft status | `false` |
| `outreachMarkedSent` | boolean | Outreach sent status | `false` |
| `milestones` | Milestones | Progress tracking | See below |

### Required Milestones Object

```typescript
milestones: {
  resumeTailored: boolean;      // Has resume been customized?
  contactSelected: boolean;     // Has a contact been chosen?
  outreachSent: boolean;        // Has initial outreach been sent?
  followUpSent: boolean;        // Has follow-up been sent?
  replyReceived: boolean;       // Has target replied?
  interviewScheduled: boolean;  // Is interview scheduled?
  interviewPrep1: boolean;      // First prep session done?
  interviewPrep2: boolean;      // Second prep session done?
  interviewPrep3: boolean;      // Third prep session done?
  outcomeRecorded: boolean;     // Has final outcome been recorded?
}
```

---

## Optional Fields

These fields enhance the card but are not required:

| Field | Type | Purpose | Display Location |
|-------|------|---------|------------------|
| `companyLogoUrl` | string | Company logo | Left of company name |
| `description` | string | Full job description | Job detail page |
| `fitScore` | FitScore | Role match rating | Tag badge (color-coded) |
| `workMode` | WorkMode | Work arrangement | Tag badge (color-coded) |
| `roleFamily` | RoleFamily | Role category | Tag badge |
| `tags` | string[] | Custom labels | Below work mode badge |
| `contacts` | Contact[] | Potential contacts | Contact discovery panel |
| `notes` | string | User notes | Notes section |
| `outcome` | Outcome | Final result | Only for "Closed" status |

---

## Card Visual Components

The job card displays information in this hierarchy:

```
┌─────────────────────────────────────────┐
│ [Title]                    [Actions ⋯]  │
├─────────────────────────────────────────┤
│ [Logo] Company Name                     │
├─────────────────────────────────────────┤
│ [Fit: High] [Remote] [SWE]              │  ← Badges row
├─────────────────────────────────────────┤
│ [Dream job] [High priority] +1          │  ← Custom tags (max 2 shown)
├─────────────────────────────────────────┤
│ Progress ─────────────────── 40%        │
├─────────────────────────────────────────┤
│ [⚡ Generate Outreach]                  │  ← Next step button
└─────────────────────────────────────────┘
```

### Badge Color Mapping

**Fit Score Colors:**
```typescript
High:   "bg-emerald-500/10 text-emerald-600 border-emerald-200"
Medium: "bg-amber-500/10 text-amber-600 border-amber-200"
Low:    "bg-red-500/10 text-red-600 border-red-200"
```

**Work Mode Colors:**
```typescript
Remote:  "bg-blue-500/10 text-blue-600"
Hybrid:  "bg-purple-500/10 text-purple-600"
On-site: "bg-orange-500/10 text-orange-600"
```

---

## Pipeline Stages & Status Flow

Jobs move through 8 stages in order:

```
1. Interested       → Found a job, added to track
2. Outreach Ready   → Contact found, ready to reach out
3. Outreach Sent    → Initial message sent
4. Replied          → Got a response
5. Meeting Booked   → Coffee chat/call scheduled
6. Interviewing     → In interview process
7. Offer            → Received offer
8. Closed           → Final outcome recorded
```

### Status Transitions

| From | Valid Next States |
|------|-------------------|
| Interested | Outreach Ready, Closed |
| Outreach Ready | Outreach Sent, Closed |
| Outreach Sent | Replied, Closed |
| Replied | Meeting Booked, Interviewing, Closed |
| Meeting Booked | Interviewing, Closed |
| Interviewing | Offer, Closed |
| Offer | Closed |
| Closed | (Terminal) |

---

## Progress Calculation

Progress is a percentage (0-100) calculated from completed milestones:

```typescript
// 10 milestones, each worth 10%
const calculateProgress = (milestones: Milestones): number => {
  const completedCount = Object.values(milestones).filter(Boolean).length;
  return completedCount * 10;
};
```

### Milestone Weights

| Milestone | Weight | Cumulative |
|-----------|--------|------------|
| resumeTailored | 10% | 10% |
| contactSelected | 10% | 20% |
| outreachSent | 10% | 30% |
| followUpSent | 10% | 40% |
| replyReceived | 10% | 50% |
| interviewScheduled | 10% | 60% |
| interviewPrep1 | 10% | 70% |
| interviewPrep2 | 10% | 80% |
| interviewPrep3 | 10% | 90% |
| outcomeRecorded | 10% | 100% |

---

## Next Step Logic

The "Next Step" button dynamically shows the recommended action:

```typescript
const getNextStepLabel = (job: Job): string => {
  if (!job.hasSelectedContact) return "Find Contacts";
  if (!job.hasOutreachDraft) return "Generate Outreach";
  if (!job.outreachMarkedSent) return "Mark Outreach Sent";
  if (job.status === "Outreach Sent") return "Follow-up Prep";
  if (job.status === "Replied") return "Log Reply";
  if (job.status === "Meeting Booked") return "Prep Coffee Chat";
  if (job.status === "Interviewing") return "Start Interview Prep";
  if (job.status === "Offer") return "Review Offer";
  if (job.status === "Closed") return "View Summary";
  return "Next Step";
};
```

### Action Flow Chart

```
┌─────────────────────────────────────────────────────────┐
│                    NEW JOB CREATED                       │
└────────────────────────┬────────────────────────────────┘
                         ▼
            ┌──────────────────────┐
            │ hasSelectedContact?  │──No──► "Find Contacts"
            └──────────┬───────────┘
                       │ Yes
                       ▼
            ┌──────────────────────┐
            │ hasOutreachDraft?    │──No──► "Generate Outreach"
            └──────────┬───────────┘
                       │ Yes
                       ▼
            ┌──────────────────────┐
            │ outreachMarkedSent?  │──No──► "Mark Outreach Sent"
            └──────────┬───────────┘
                       │ Yes
                       ▼
              Status-based actions
```

---

## Milestones System

Milestones track granular progress through the job application journey:

### Milestone Definitions

| Milestone | Trigger Condition |
|-----------|-------------------|
| `resumeTailored` | User marks resume as customized for role |
| `contactSelected` | User selects a contact from discovery |
| `outreachSent` | User marks outreach as sent |
| `followUpSent` | Follow-up message sent |
| `replyReceived` | Status changed to "Replied" |
| `interviewScheduled` | Status changed to "Interviewing" |
| `interviewPrep1` | First prep session completed |
| `interviewPrep2` | Second prep session completed |
| `interviewPrep3` | Third prep session completed |
| `outcomeRecorded` | Final outcome selected |

---

## Automation Requirements

To automate job card creation from a job URL, you need to:

### 1. Extract Data from URL

Parse the job posting page to extract:

| Priority | Field | Extraction Method |
|----------|-------|-------------------|
| Required | title | `<h1>` or `job-title` class |
| Required | company | Company name element or domain |
| Required | url | Input URL |
| Optional | description | Job description section |
| Optional | workMode | Search for "remote", "hybrid", "on-site" |
| Optional | roleFamily | Match against known categories |
| Optional | companyLogoUrl | `<img>` in header/logo section |

### 2. Set Default Values

```typescript
const createJobFromUrl = (extractedData: ExtractedJobData): Job => ({
  // Generated
  id: crypto.randomUUID(),
  
  // Extracted from URL
  title: extractedData.title,
  company: extractedData.company,
  url: extractedData.url,
  
  // Extracted (optional)
  description: extractedData.description || "",
  workMode: extractedData.workMode || undefined,
  roleFamily: extractedData.roleFamily || undefined,
  companyLogoUrl: extractedData.companyLogoUrl || undefined,
  
  // Default values
  dueDate: formatDate(addDays(new Date(), 14)), // 2 weeks from now
  status: "Interested",
  progress: 0,
  fitScore: null,
  hasSelectedContact: false,
  hasOutreachDraft: false,
  outreachMarkedSent: false,
  
  // Empty defaults
  milestones: {
    resumeTailored: false,
    contactSelected: false,
    outreachSent: false,
    followUpSent: false,
    replyReceived: false,
    interviewScheduled: false,
    interviewPrep1: false,
    interviewPrep2: false,
    interviewPrep3: false,
    outcomeRecorded: false,
  },
  contacts: [],
  tags: [],
  activityTimeline: [
    {
      id: crypto.randomUUID(),
      action: "Job added",
      timestamp: formatDate(new Date()),
    },
  ],
});
```

---

## Data Extraction from Job URL

### Recommended Extraction Strategy

1. **Use Firecrawl API** (if available) to scrape job posting
2. **Parse structured data** (JSON-LD, Open Graph)
3. **Fallback to DOM parsing** for key elements

### Common Job Site Patterns

| Site | Title Selector | Company Selector |
|------|---------------|-----------------|
| LinkedIn | `.jobs-unified-top-card__job-title` | `.jobs-unified-top-card__company-name` |
| Indeed | `.jobsearch-JobInfoHeader-title` | `[data-company-name]` |
| Glassdoor | `.job-title` | `.employer-name` |
| Greenhouse | `.app-title` | Meta tag or header |
| Lever | `h2.posting-headline` | `.posting-categories` |

### Work Mode Detection

```typescript
const detectWorkMode = (text: string): WorkMode | undefined => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("fully remote") || lowerText.includes("100% remote")) {
    return "Remote";
  }
  if (lowerText.includes("hybrid")) {
    return "Hybrid";
  }
  if (lowerText.includes("on-site") || lowerText.includes("in-office")) {
    return "On-site";
  }
  return undefined;
};
```

### Role Family Detection

```typescript
const detectRoleFamily = (title: string): RoleFamily => {
  const lower = title.toLowerCase();
  
  if (lower.includes("product manager") || lower.includes(" pm ")) {
    return "PM";
  }
  if (lower.includes("engineer") || lower.includes("developer") || 
      lower.includes("swe") || lower.includes("frontend") || 
      lower.includes("backend") || lower.includes("fullstack")) {
    return "SWE";
  }
  if (lower.includes("data scientist") || lower.includes("ml engineer") ||
      lower.includes("machine learning") || lower.includes("data analyst")) {
    return "DS";
  }
  if (lower.includes("designer") || lower.includes("ux") || lower.includes("ui")) {
    return "Design";
  }
  return "Other";
};
```

---

## Default Values for Automation

When creating a job card automatically, use these defaults:

```typescript
const AUTOMATION_DEFAULTS = {
  status: "Interested" as JobStatus,
  progress: 0,
  fitScore: null,
  hasSelectedContact: false,
  hasOutreachDraft: false,
  outreachMarkedSent: false,
  daysUntilDue: 14, // 2 weeks
  
  milestones: {
    resumeTailored: false,
    contactSelected: false,
    outreachSent: false,
    followUpSent: false,
    replyReceived: false,
    interviewScheduled: false,
    interviewPrep1: false,
    interviewPrep2: false,
    interviewPrep3: false,
    outcomeRecorded: false,
  },
};
```

---

## API Response Schema

If building an API endpoint to create jobs from URLs, return this schema:

### Request

```typescript
interface CreateJobRequest {
  url: string;
  tags?: string[];           // Optional user-provided tags
  fitScore?: FitScore;       // Optional manual fit score
  dueDate?: string;          // Optional custom due date
}
```

### Response

```typescript
interface CreateJobResponse {
  success: boolean;
  job?: Job;                 // Created job object
  error?: string;            // Error message if failed
  extracted?: {              // What was extracted from URL
    title: string;
    company: string;
    description?: string;
    workMode?: WorkMode;
    roleFamily?: RoleFamily;
    companyLogoUrl?: string;
  };
}
```

---

## Contact Object Schema

When discovering contacts for a job:

```typescript
interface Contact {
  id: string;                // Unique identifier
  name: string;              // Full name
  title: string;             // Job title at company
  relationship: ContactRelationship;  // Role type
  confidence: "High" | "Medium" | "Low";  // Match confidence
  source: string;            // Where found (e.g., "LinkedIn")
  profileUrl?: string;       // Profile link
}

type ContactRelationship = 
  | "Recruiter"
  | "Hiring Manager"
  | "Team Lead"
  | "Employee";
```

---

## Activity Timeline Schema

Track all actions on a job:

```typescript
interface ActivityItem {
  id: string;
  action: string;            // Description of action
  timestamp: string;         // Formatted date string
}

// Common activity actions:
const ACTIVITY_ACTIONS = [
  "Job added",
  "Resume tailored",
  "Contact selected",
  "Outreach sent",
  "Follow-up sent",
  "Reply received",
  "Meeting booked",
  "Interview scheduled",
  "Interview prep completed",
  "Offer received",
  "Application closed",
];
```

---

## Summary Checklist

### Minimum Viable Job Card (Automation)

- [ ] Generate unique `id`
- [ ] Extract `title` from page
- [ ] Extract `company` from page
- [ ] Store original `url`
- [ ] Set `status` = "Interested"
- [ ] Set `progress` = 0
- [ ] Set `dueDate` = now + 14 days
- [ ] Set boolean flags to `false`
- [ ] Initialize empty `milestones`
- [ ] Add "Job added" to activity timeline

### Enhanced Job Card (Full Extraction)

- [ ] All minimum fields above
- [ ] Extract and set `description`
- [ ] Detect and set `workMode`
- [ ] Detect and set `roleFamily`
- [ ] Extract `companyLogoUrl`
- [ ] User can add `tags`
- [ ] User can set `fitScore`

---

## Quick Reference: Creating a Job Object

```typescript
// Minimal job creation
const newJob: Job = {
  id: crypto.randomUUID(),
  title: "Software Engineer",
  company: "Acme Corp",
  dueDate: "Feb 1, 2025",
  status: "Interested",
  url: "https://acme.com/careers/swe",
  progress: 0,
  hasSelectedContact: false,
  hasOutreachDraft: false,
  outreachMarkedSent: false,
  milestones: {
    resumeTailored: false,
    contactSelected: false,
    outreachSent: false,
    followUpSent: false,
    replyReceived: false,
    interviewScheduled: false,
    interviewPrep1: false,
    interviewPrep2: false,
    interviewPrep3: false,
    outcomeRecorded: false,
  },
};
```

---

*Document generated: December 31, 2024*
*Version: 1.0*
