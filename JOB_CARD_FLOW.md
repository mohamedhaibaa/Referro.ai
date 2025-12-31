# Job Card Flow & Automation Blueprint

This document details how job cards work in the application, the data structure required, and everything needed to automate job card creation from a job description URL.

> ⚠️ **IMPORTANT**: The current job cards are **HARD-CODED** sample data in `src/data/jobs.ts`. There is no database or API connection. To make this dynamic, you need to replace the sample data with real data from an API or database.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Job Data Model](#job-data-model)
4. [Required Fields for Card Creation](#required-fields-for-card-creation)
5. [Optional Fields](#optional-fields)
6. [Component Breakdown with Code](#component-breakdown-with-code)
7. [Card Visual Components](#card-visual-components)
8. [Pipeline Stages & Status Flow](#pipeline-stages--status-flow)
9. [Progress Calculation](#progress-calculation)
10. [Next Step Logic](#next-step-logic)
11. [Milestones System](#milestones-system)
12. [Filtering System](#filtering-system)
13. [Automation Requirements](#automation-requirements)
14. [Data Extraction from Job URL](#data-extraction-from-job-url)
15. [Default Values for Automation](#default-values-for-automation)
16. [API Response Schema](#api-response-schema)
17. [What to Change vs What Not to Change](#what-to-change-vs-what-not-to-change)

---

## Overview

A job card represents a single job opportunity in the user's pipeline. Cards are displayed in a Kanban board with drag-and-drop functionality, and each card contains rich information about the job, company, and application status.

**Current State**: All job data is **hard-coded** in `src/data/jobs.ts`. The application uses React state to manage jobs in memory, but data is lost on page refresh.

---

## File Structure

### All Files Involved in Job Cards

| File Path | Purpose | Can Modify? |
|-----------|---------|-------------|
| `src/types/job.ts` | Type definitions for Job, Contact, etc. | ✅ Add new fields here |
| `src/data/jobs.ts` | **HARD-CODED** sample data | ⚠️ Replace with API calls |
| `src/components/kanban/KanbanCard.tsx` | Individual job card UI | ✅ Modify card appearance |
| `src/components/kanban/KanbanBoard.tsx` | Kanban board container | ✅ Modify board layout |
| `src/components/kanban/KanbanColumn.tsx` | Single column in board | ✅ Modify column behavior |
| `src/components/kanban/KanbanFilters.tsx` | Filter drawer component | ✅ Add/remove filters |
| `src/pages/Jobs.tsx` | Jobs page wrapper | ✅ Add API integration |
| `src/components/jobs/JobsPreview.tsx` | Dashboard preview widget | ✅ Modify preview |

---

## Job Data Model

### File: `src/types/job.ts`

This file contains all type definitions. **DO NOT REMOVE existing fields** as they are used throughout the app.

```typescript
// ============= FULL FILE: src/types/job.ts =============

export type JobStatus = 
  | "Interested"
  | "Outreach Ready"
  | "Outreach Sent"
  | "Replied"
  | "Meeting Booked"
  | "Interviewing"
  | "Offer"
  | "Closed";

export type FitScore = "High" | "Medium" | "Low" | null;
export type WorkMode = "Remote" | "Hybrid" | "On-site";
export type RoleFamily = "PM" | "SWE" | "DS" | "Design" | "Other";

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  dueDate: string;
  status: JobStatus;
  url: string;
  description?: string;
  progress: number;
  fitScore?: FitScore;
  workMode?: WorkMode;
  roleFamily?: RoleFamily;
  hasSelectedContact: boolean;
  hasOutreachDraft: boolean;
  outreachMarkedSent: boolean;
  milestones: {
    resumeTailored: boolean;
    contactSelected: boolean;
    outreachSent: boolean;
    followUpSent: boolean;
    replyReceived: boolean;
    interviewScheduled: boolean;
    interviewPrep1: boolean;
    interviewPrep2: boolean;
    interviewPrep3: boolean;
    outcomeRecorded: boolean;
  };
  contacts?: Contact[];
  selectedContactId?: string;
  outreachMessages?: OutreachMessage[];
  followUp?: FollowUp;
  notes?: string;
  tags?: string[];
  outcome?: "Offer" | "Rejected" | "Withdrew" | "No response";
  activityTimeline?: ActivityItem[];
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  relationship: "Recruiter" | "Hiring Manager" | "Team Lead" | "Employee";
  confidence: "High" | "Medium" | "Low";
  source: string;
  profileUrl?: string;
}

export interface OutreachMessage {
  id: string;
  message: string;
  sentAt?: string;
  type: "initial" | "followup";
}

export interface FollowUp {
  recommendedDate: string;
  message: string;
  sent: boolean;
  sentAt?: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  timestamp: string;
}

// Pipeline stages in order - used by KanbanBoard to create columns
export const PIPELINE_STAGES: JobStatus[] = [
  "Interested",
  "Outreach Ready",
  "Outreach Sent",
  "Replied",
  "Meeting Booked",
  "Interviewing",
  "Offer",
  "Closed",
];

// Logic for determining next action button text
export const getNextStepLabel = (job: Job): string => {
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

## Component Breakdown with Code

### 1. Hard-Coded Data Source

**File: `src/data/jobs.ts`**

> ⚠️ **THIS IS HARD-CODED DATA** - Replace with API calls for production

```typescript
// ============= FILE: src/data/jobs.ts =============
// This file contains SAMPLE DATA for development
// In production, replace this with API calls

import { Job } from "@/types/job";

export const sampleJobs: Job[] = [
  {
    id: "1",                                    // Unique ID - generate with crypto.randomUUID()
    title: "Senior Product Manager",            // Extracted from job posting
    company: "Google",                          // Extracted from job posting
    dueDate: "Jan 5, 2025",                     // User-set or default (now + 14 days)
    status: "Outreach Ready",                   // Pipeline stage
    url: "https://careers.google.com/jobs/123", // Original job posting URL
    description: "Lead product strategy...",    // Job description text
    progress: 20,                               // Calculated from milestones (20% = 2 milestones)
    fitScore: "High",                           // User assessment or AI-generated
    workMode: "Hybrid",                         // Extracted from posting
    roleFamily: "PM",                           // Detected from job title
    hasSelectedContact: true,                   // Has user picked a contact?
    hasOutreachDraft: false,                    // Has user written outreach?
    outreachMarkedSent: false,                  // Has outreach been sent?
    milestones: {
      resumeTailored: true,                     // Each true = 10% progress
      contactSelected: true,
      outreachSent: false,
      followUpSent: false,
      replyReceived: false,
      interviewScheduled: false,
      interviewPrep1: false,
      interviewPrep2: false,
      interviewPrep3: false,
      outcomeRecorded: false,
    },
    contacts: [                                 // Discovered contacts
      {
        id: "c1",
        name: "Sarah Chen",
        title: "Senior Recruiter",
        relationship: "Recruiter",
        confidence: "High",
        source: "LinkedIn",
      },
    ],
    tags: ["Dream job", "High priority"],       // User-created tags
    activityTimeline: [                         // Activity log
      { id: "a1", action: "Job added", timestamp: "Dec 28, 2024" },
      { id: "a2", action: "Resume tailored", timestamp: "Dec 29, 2024" },
    ],
  },
  // ... more sample jobs
];
```

---

### 2. Jobs Page (Entry Point)

**File: `src/pages/Jobs.tsx`**

```typescript
// ============= FILE: src/pages/Jobs.tsx =============
// This is where jobs state is managed
// Currently uses hard-coded sampleJobs

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import { sampleJobs } from "@/data/jobs";  // ⚠️ HARD-CODED DATA
import { Job } from "@/types/job";

const Jobs = () => {
  // Jobs stored in React state - lost on refresh!
  const [jobs, setJobs] = useState<Job[]>(sampleJobs);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8">
        <Header />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-serif font-bold text-foreground">Jobs</h2>
        </div>
        {/* KanbanBoard receives jobs and update function */}
        <KanbanBoard jobs={jobs} onJobsChange={setJobs} />
      </main>
    </div>
  );
};

export default Jobs;
```

**To make dynamic, replace with:**
```typescript
// Example with API integration
const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from API or database
    fetchJobs().then(data => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  // ... rest of component
};
```

---

### 3. Kanban Board Container

**File: `src/components/kanban/KanbanBoard.tsx`**

```typescript
// ============= KEY SECTIONS OF: src/components/kanban/KanbanBoard.tsx =============

interface KanbanBoardProps {
  jobs: Job[];                              // Array of all jobs
  onJobsChange?: (jobs: Job[]) => void;     // Callback when jobs are modified
}

const KanbanBoard = ({ jobs, onJobsChange }: KanbanBoardProps) => {
  // === STATE MANAGEMENT ===
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  
  // WIP limits per column (optional feature)
  const [wipLimits, setWipLimits] = useState<Partial<Record<JobStatus, number>>>({});
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    roleFamily: [],
    workMode: [],
    fitScore: [],
    company: "",
    tags: [],
    status: [],
  });

  // === FILTERING LOGIC ===
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Search by title, company, or tags
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          job.title.toLowerCase().includes(query) ||
          job.company.toLowerCase().includes(query) ||
          job.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      // ... more filter logic for roleFamily, workMode, fitScore, etc.
      return true;
    });
  }, [jobs, searchQuery, filters]);

  // === GROUP JOBS BY STATUS FOR COLUMNS ===
  const jobsByStatus = useMemo(() => {
    const grouped: Record<JobStatus, Job[]> = {
      Interested: [],
      "Outreach Ready": [],
      "Outreach Sent": [],
      Replied: [],
      "Meeting Booked": [],
      Interviewing: [],
      Offer: [],
      Closed: [],
    };
    filteredJobs.forEach((job) => {
      grouped[job.status].push(job);
    });
    return grouped;
  }, [filteredJobs]);

  // === CREATE JOB HANDLER ===
  // ⚠️ Currently just logs - needs implementation
  const handleCreateJob = () => {
    if (jobUrl.trim()) {
      console.log("Creating job from URL:", jobUrl);
      // TODO: Call API to scrape URL and create job
      // TODO: Add new job to jobs array
      setJobUrl("");
      setShowUrlInput(false);
    }
  };

  // === DRAG AND DROP HANDLERS ===
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: JobStatus) => {
    e.preventDefault();
    if (!draggedJobId) return;
    
    // Update job status
    const updatedJobs = jobs.map((job) =>
      job.id === draggedJobId ? { ...job, status: newStatus } : job
    );
    onJobsChange?.(updatedJobs);  // Notify parent of change
    setDraggedJobId(null);
  };

  // === RENDER ===
  return (
    <div className="bg-card rounded-2xl p-6 h-full flex flex-col">
      {/* Header with Create Job button */}
      {/* URL Input section */}
      {/* Toolbar with search, filters, view toggle */}
      
      {/* Kanban columns */}
      {PIPELINE_STAGES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          jobs={jobsByStatus[status]}
          wipLimit={wipLimits[status]}
          onWipLimitChange={handleWipLimitChange}
          onMoveJob={handleMoveJob}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          isHidden={hideEmptyColumns && jobsByStatus[status].length === 0}
        />
      ))}
      
      {/* Filter drawer */}
      <KanbanFilters
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={availableTags}
      />
    </div>
  );
};
```

---

### 4. Kanban Column

**File: `src/components/kanban/KanbanColumn.tsx`**

```typescript
// ============= KEY SECTIONS OF: src/components/kanban/KanbanColumn.tsx =============

interface KanbanColumnProps {
  status: JobStatus;                         // Column status (e.g., "Interested")
  jobs: Job[];                               // Jobs in this column
  wipLimit?: number;                         // Max cards allowed
  onWipLimitChange?: (status: JobStatus, limit: number | undefined) => void;
  onMoveJob?: (jobId: string, newStatus: JobStatus) => void;
  onDragStart?: (e: React.DragEvent, jobId: string) => void;
  onDrop?: (e: React.DragEvent, status: JobStatus) => void;
  isHidden?: boolean;                        // Hide empty columns
}

// Status indicator colors - CUSTOMIZE THESE FOR DIFFERENT THEMES
const statusColors: Record<JobStatus, string> = {
  Interested: "bg-slate-500",
  "Outreach Ready": "bg-amber-500",
  "Outreach Sent": "bg-orange-500",
  Replied: "bg-emerald-500",
  "Meeting Booked": "bg-cyan-500",
  Interviewing: "bg-blue-500",
  Offer: "bg-purple-500",
  Closed: "bg-gray-500",
};

const KanbanColumn = ({ status, jobs, wipLimit, ... }: KanbanColumnProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const isOverLimit = wipLimit !== undefined && jobs.length > wipLimit;

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop?.(e, status);  // Pass status to parent
  };

  return (
    <div className={cn(
      "flex flex-col w-72 shrink-0 bg-muted/30 rounded-xl",
      isDragOver && "ring-2 ring-primary/50 bg-primary/5"
    )}>
      {/* Column Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", statusColors[status])} />
          <h3 className="font-medium text-sm">{status}</h3>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full",
            isOverLimit ? "bg-red-100 text-red-600" : "bg-muted"
          )}>
            {jobs.length}{wipLimit !== undefined && `/${wipLimit}`}
          </span>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <KanbanCard
              key={job.id}
              job={job}
              onMoveToColumn={onMoveJob}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
```

---

### 5. Individual Job Card

**File: `src/components/kanban/KanbanCard.tsx`**

```typescript
// ============= FULL FILE: src/components/kanban/KanbanCard.tsx =============

interface KanbanCardProps {
  job: Job;                                              // The job data
  onMoveToColumn?: (jobId: string, newStatus: Job["status"]) => void;
  onDragStart?: (e: React.DragEvent, jobId: string) => void;
}

// === BADGE COLOR MAPPINGS - CUSTOMIZE THESE ===
const fitScoreColors: Record<NonNullable<FitScore>, string> = {
  High: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  Medium: "bg-amber-500/10 text-amber-600 border-amber-200",
  Low: "bg-red-500/10 text-red-600 border-red-200",
};

const workModeColors: Record<string, string> = {
  Remote: "bg-blue-500/10 text-blue-600",
  Hybrid: "bg-purple-500/10 text-purple-600",
  "On-site": "bg-orange-500/10 text-orange-600",
};

const KanbanCard = ({ job, onMoveToColumn, onDragStart }: KanbanCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const nextStep = getNextStepLabel(job);  // From types/job.ts

  const handleCardClick = () => {
    navigate(`/job/${job.id}`);  // Navigate to job detail page
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, job.id)}
      onClick={handleCardClick}
      className="group bg-card border border-border rounded-xl p-4 cursor-pointer 
                 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* === HEADER: Title + Actions === */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-foreground text-sm line-clamp-2">
          {job.title}  {/* Display job title */}
        </h4>
        {/* Dropdown menu for moving card */}
      </div>

      {/* === COMPANY INFO === */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
          {job.companyLogoUrl ? (
            <img src={job.companyLogoUrl} alt={job.company} className="h-4 w-4 rounded" />
          ) : (
            <Building2 className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {job.company}
        </span>
      </div>

      {/* === BADGES ROW: Fit Score, Work Mode, Role Family === */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 h-5",
            job.fitScore ? fitScoreColors[job.fitScore] : "text-muted-foreground"
          )}
        >
          Fit: {job.fitScore || "—"}
        </Badge>

        {job.workMode && (
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0 h-5", workModeColors[job.workMode])}
          >
            {job.workMode}
          </Badge>
        )}

        {job.roleFamily && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {job.roleFamily}
          </Badge>
        )}
      </div>

      {/* === CUSTOM TAGS (max 2 shown) === */}
      {job.tags && job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" 
                   className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary">
              {tag}
            </Badge>
          ))}
          {job.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{job.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* === PROGRESS BAR === */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{job.progress}%</span>
        </div>
        <Progress value={job.progress} className="h-1" />
      </div>

      {/* === NEXT STEP BUTTON === */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "w-full h-7 text-xs gap-1.5 transition-all duration-200",
          isHovered
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "hover:bg-muted"
        )}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/job/${job.id}`);
        }}
      >
        <Zap className="h-3 w-3" />
        {nextStep}  {/* Dynamic label from getNextStepLabel() */}
      </Button>
    </div>
  );
};
```

---

### 6. Filter Panel

**File: `src/components/kanban/KanbanFilters.tsx`**

```typescript
// ============= KEY SECTIONS OF: src/components/kanban/KanbanFilters.tsx =============

// Filter state shape - used by KanbanBoard
export interface FilterState {
  roleFamily: RoleFamily[];    // ["PM", "SWE"]
  workMode: WorkMode[];        // ["Remote", "Hybrid"]
  fitScore: FitScore[];        // ["High", "Medium"]
  company: string;             // "Google"
  tags: string[];              // ["Dream job"]
  status: JobStatus[];         // ["Interested", "Outreach Ready"]
}

// Available options for filters
const roleFamilies: RoleFamily[] = ["PM", "SWE", "DS", "Design", "Other"];
const workModes: WorkMode[] = ["Remote", "Hybrid", "On-site"];
const fitScores: NonNullable<FitScore>[] = ["High", "Medium", "Low"];

const KanbanFilters = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableTags,  // Tags extracted from all jobs
}: KanbanFiltersProps) => {
  
  // Toggle helper for multi-select filters
  const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    return arr.includes(item)
      ? arr.filter((i) => i !== item)
      : [...arr, item];
  };

  const handleClearAll = () => {
    onFiltersChange({
      roleFamily: [],
      workMode: [],
      fitScore: [],
      company: "",
      tags: [],
      status: [],
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Jobs</SheetTitle>
        </SheetHeader>
        
        {/* Role Family buttons */}
        {/* Work Mode buttons */}
        {/* Fit Score buttons */}
        {/* Company search input */}
        {/* Tags checkboxes */}
        {/* Status checkboxes */}
        
        <SheetFooter>
          <Button variant="outline" onClick={handleClearAll}>Clear all</Button>
          <Button onClick={() => onOpenChange(false)}>Apply</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
```

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

---

## Pipeline Stages & Status Flow

Jobs move through 8 stages in order (defined in `PIPELINE_STAGES` constant):

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

---

## Next Step Logic

The "Next Step" button dynamically shows the recommended action based on job state:

```typescript
// From src/types/job.ts
export const getNextStepLabel = (job: Job): string => {
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

---

## Milestones System

Milestones track granular progress through the job application journey:

| Milestone | Trigger Condition | Weight |
|-----------|-------------------|--------|
| `resumeTailored` | User marks resume as customized | 10% |
| `contactSelected` | User selects a contact | 10% |
| `outreachSent` | User marks outreach as sent | 10% |
| `followUpSent` | Follow-up message sent | 10% |
| `replyReceived` | Status changed to "Replied" | 10% |
| `interviewScheduled` | Status changed to "Interviewing" | 10% |
| `interviewPrep1` | First prep session completed | 10% |
| `interviewPrep2` | Second prep session completed | 10% |
| `interviewPrep3` | Third prep session completed | 10% |
| `outcomeRecorded` | Final outcome selected | 10% |

---

## Filtering System

**File:** `src/components/kanban/KanbanFilters.tsx`

The filter system supports multiple filter types that can be combined:

| Filter | Type | Description |
|--------|------|-------------|
| `roleFamily` | Multi-select | PM, SWE, DS, Design, Other |
| `workMode` | Multi-select | Remote, Hybrid, On-site |
| `fitScore` | Multi-select | High, Medium, Low |
| `company` | Text search | Fuzzy match on company name |
| `tags` | Multi-select | All unique tags from jobs |
| `status` | Multi-select | All 8 pipeline stages |

---

## What to Change vs What Not to Change

### ✅ SAFE TO CHANGE

| What | File | How |
|------|------|-----|
| Badge colors | `KanbanCard.tsx` | Modify `fitScoreColors` and `workModeColors` objects |
| Column colors | `KanbanColumn.tsx` | Modify `statusColors` object |
| Card layout/styling | `KanbanCard.tsx` | Modify JSX and Tailwind classes |
| Filter options | `KanbanFilters.tsx` | Add/remove from `roleFamilies`, `workModes`, `fitScores` arrays |
| Pipeline stages | `src/types/job.ts` | Modify `PIPELINE_STAGES` array (update `JobStatus` type too) |
| Next step labels | `src/types/job.ts` | Modify `getNextStepLabel` function |
| Sample data | `src/data/jobs.ts` | Add/remove sample jobs |

### ⚠️ CHANGE WITH CAUTION

| What | File | Why |
|------|------|-----|
| Job interface fields | `src/types/job.ts` | Required by multiple components |
| FilterState interface | `KanbanFilters.tsx` | Used by KanbanBoard |
| Milestones structure | `src/types/job.ts` | Progress calculation depends on it |

### ❌ DO NOT CHANGE (without updating consumers)

| What | Files Affected |
|------|----------------|
| `Job` interface required fields | All kanban components |
| `JobStatus` type | KanbanBoard, KanbanColumn, KanbanFilters |
| Props interface names | Parent components that import them |

---

## Automation Requirements

To automate job card creation from a job URL:

### 1. Current "Create Job" Flow (Not Implemented)

```typescript
// In KanbanBoard.tsx - currently just logs
const handleCreateJob = () => {
  if (jobUrl.trim()) {
    console.log("Creating job from URL:", jobUrl);  // TODO: Implement
    setJobUrl("");
    setShowUrlInput(false);
  }
};
```

### 2. What You Need to Implement

1. **URL Scraping**: Use Firecrawl or similar to extract job data
2. **Job Creation API**: Create a new job object with extracted data
3. **State Update**: Add new job to the jobs array

### 3. Example Implementation

```typescript
const handleCreateJob = async () => {
  if (!jobUrl.trim()) return;
  
  try {
    // 1. Scrape job URL
    const extracted = await scrapeJobUrl(jobUrl);
    
    // 2. Create job object
    const newJob: Job = {
      id: crypto.randomUUID(),
      title: extracted.title,
      company: extracted.company,
      url: jobUrl,
      dueDate: formatDate(addDays(new Date(), 14)),
      status: "Interested",
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
      // Optional extracted fields
      description: extracted.description,
      workMode: extracted.workMode,
      roleFamily: extracted.roleFamily,
      companyLogoUrl: extracted.companyLogoUrl,
      activityTimeline: [
        { id: crypto.randomUUID(), action: "Job added", timestamp: formatDate(new Date()) }
      ],
    };
    
    // 3. Update state
    onJobsChange?.([...jobs, newJob]);
    
    setJobUrl("");
    setShowUrlInput(false);
  } catch (error) {
    console.error("Failed to create job:", error);
  }
};
```

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
*Version: 2.0 - Added code snippets and file references*
