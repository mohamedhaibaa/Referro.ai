# Referoo.ai — Claude Code Setup Guide

## For: Co-Founder Onboarding
## Purpose: Understand how our AI coding assistant is configured and how to work with it

---

## What Is This?

We've set up Claude Code (Anthropic's AI coding agent) as our primary development tool for Referoo. Instead of letting it freestyle, we've created a structured system of instruction files that tell it exactly how our project works, what patterns to follow, and how to communicate with us.

Think of it like onboarding a new senior developer — except we do it at the start of every coding session, instantly, with perfect consistency.

---

## The Five Files

We have 5 markdown files that live in the root of our repo. Claude Code reads these before doing any work.

### 1. CLAUDE.md — The Master Rulebook

**What it does:** This is the first file Claude reads on every task. It contains the non-negotiable rules for working in our codebase.

**What's in it:**
- Project identity (what Referoo is, what stack we use)
- Golden rules (never break working features, always use the response envelope, always filter by user_id, etc.)
- Architecture overview (the three-service diagram: Frontend → API → Worker)
- File naming conventions (where things go, how they're named)
- All dev commands (make frontend, make backend, make migrate, etc.)
- Database quick reference (16 tables, key relationships, job status flow)
- Service Bus queue reference (which queues exist, which are working vs stubbed)
- A "what NOT to do" list (no cookies for auth, no hardcoded URLs, no raw SQL, etc.)

**Why it matters:** Without this, Claude would make reasonable but wrong assumptions about our architecture. For example, it might put auth in cookies instead of JWT, or write raw SQL instead of using SQLAlchemy. This file prevents that.

### 2. CONTEXT.md — The Project State Map

**What it does:** Tells Claude exactly what exists, what's partially done, and what hasn't been started.

**What's in it:**
- Feature status matrix with three sections:
  - ✅ Fully working (auth, job CRUD, parsing, dashboard, kanban, workflow polling)
  - 🟡 Partially implemented (contacts, outreach, follow-ups, flash cards, pitch deck, file upload, notes, activity, inbox)
  - ❌ Not started (email integration, calendar sync, resume parsing, analytics, rate limiting, WebSocket, Docker, deploy pipeline)
- Tech debt and known issues (ranked by severity)
- All environment variables with descriptions
- The phased execution plan (Phase 2 through Phase 5)
- Links to all 14 docs in the `/docs/` folder

**Why it matters:** When we say "implement contact discovery," Claude knows exactly which files exist, which are stubs, what the API spec expects, and what phase we're in. It doesn't re-invent or conflict with existing work.

### 3. SKILLS.md — The Pattern Library

**What it does:** Contains copy-paste-ready code patterns for every layer of the stack. Claude follows these exactly instead of inventing new approaches.

**What's in it (10 skills):**
1. Backend API endpoint (GET list, GET single, POST with async, PATCH, DELETE)
2. Database model (SQLAlchemy 2.0 with UUID, timestamps, indexes)
3. Worker consumer (Service Bus listener, WorkflowRun lifecycle, error handling)
4. AI Foundry prompt (structured JSON output format)
5. Frontend API hook (React Query list, mutation, polling)
6. Frontend API client (typed wrapper around fetch)
7. Frontend component (feature panel with loading/empty/error states)
8. Queue publishing (Service Bus message format)
9. Alembic migration (generate + apply commands)
10. Type definitions (union types, interfaces, helper functions)

**Why it matters:** Every new feature follows the exact same structure as existing features. The contacts endpoint looks like the jobs endpoint. The outreach worker looks like the job-parsing worker. Consistency = fewer bugs and easier code review.

### 4. MEMORY.md — The Institutional Brain

**What it does:** Stores architectural decisions (and WHY), gotchas, lessons learned, and open questions. Claude updates this after each session.

**What's in it:**
- 10 architecture decisions with rationale (why Service Bus over direct calls, why JWT over sessions, why PostgreSQL over NoSQL, etc.)
- Gotchas and traps (port 5433 not 5432, queue names are case-sensitive, UUID must be cast to string, etc.)
- Lessons from past sessions (what worked, what broke, what surprised us)
- Open questions (ScrapingDog vs BeautifulSoup, WebSocket vs SSE, etc.)
- Update log (chronological record of changes)

**Why it matters:** This is the "why did we do it this way?" file. Without it, Claude (or a new developer) might undo good decisions or repeat past mistakes. It's also where we track decisions that haven't been made yet.

### 5. AGENT.md — The Working Process

**What it does:** Defines how Claude should behave as a collaborator — when to ask questions, when to suggest, when to just build.

**What's in it:**
- The 6-step process (read files → clarify → plan → build → verify → document)
- Question templates (scope, design, priority, impact questions)
- Plan template (files to create, files to modify, DB changes, steps, remaining questions)
- Suggestion protocol:
  - 🟢 Always suggest (missing error handling, missing validation, inconsistent naming)
  - 🟡 Suggest with context (noticed a bug in adjacent code, could add empty states)
  - 🔴 Flag but don't act (TypeScript strict mode, auth token security, migration backfills)
- Communication style (be specific, be honest, be proactive, show work)
- What to do when things go wrong (break something → stop → revert → discuss)
- Completion checklist (12 items to verify before marking done)

**Why it matters:** This prevents Claude from silently making changes, skipping error handling, or building without asking about ambiguous requirements. It turns Claude from a "code generator" into a "collaborative engineer."

---

## How It Works in Practice

### Starting a New Task

When you open Claude Code and give it a task like "implement the contact discovery worker," here's what happens:

1. Claude reads CLAUDE.md → knows the architecture rules
2. Claude reads CONTEXT.md → sees that contact discovery is "partially implemented" with stubs
3. Claude reads SKILLS.md → knows to follow the Skill 3 (Worker Consumer) and Skill 4 (AI Prompt) patterns
4. Claude reads MEMORY.md → checks if there are relevant decisions or gotchas
5. Claude reads AGENT.md → follows the process: asks clarifying questions first

Then Claude will ask something like:
> "Contact discovery touches backend + worker + frontend. The API stub exists at POST /contacts/discover but doesn't publish to the queue yet. Should I:
> 1. Implement the full stack (backend publish + worker consumer + AI prompt)?
> 2. Just the worker consumer for now?
> Also, for the AI prompt — should the contacts include LinkedIn profile URLs, or just names and titles?"

You answer, Claude proposes a plan, you approve, and Claude builds it following the exact patterns in SKILLS.md.

### After Completing a Task

Claude updates MEMORY.md with what it learned:
> "Session 5: Contact Discovery
> - AI Foundry sometimes returns contacts as a JSON array wrapped in markdown code blocks. Added `.strip('```json').strip('```')` to handle this.
> - The contact confidence score (High/Medium/Low) works best when you give the AI specific criteria in the prompt."

This means the next session already knows about this quirk.

---

## How to Use It Day-to-Day

### As a product person / co-founder:
- **Give tasks in plain English.** "Add the ability to generate outreach messages for a contact" is perfect.
- **Answer Claude's questions.** It will ask about scope, priority, and design choices.
- **Review the plan before Claude builds.** The plan shows every file that will be created or modified.
- **Check MEMORY.md periodically** to stay current on decisions and open questions.

### If you want to change something:
- **Architecture change?** Update CLAUDE.md and MEMORY.md with the new decision.
- **New pattern?** Add it to SKILLS.md.
- **Feature status changed?** Update CONTEXT.md.
- **New gotcha discovered?** Add to MEMORY.md.

### If Claude is doing something wrong:
- Tell it directly: "That's not following the pattern in SKILLS.md. Look at Skill 3 again."
- Or: "Check MEMORY.md — we decided not to do it that way because of X."

---

## File Locations

All five files live in the project root:

```
Referoo.ai/
├── CLAUDE.md        ← Master rulebook
├── CONTEXT.md       ← Project state map
├── SKILLS.md        ← Code pattern library
├── MEMORY.md        ← Decisions & lessons
├── AGENT.md         ← Working process
├── frontend/
├── backend/
├── worker/
└── docs/
```

---

## Key Takeaways

1. **Claude Code is not just autocomplete.** With these files, it understands our architecture, follows our patterns, and asks intelligent questions before building.

2. **The system is self-improving.** Every session adds to MEMORY.md, making future sessions smarter.

3. **Consistency is the goal.** Every new endpoint, hook, component, and worker follows the same patterns. This makes the codebase predictable and maintainable.

4. **You stay in control.** Claude proposes plans and asks questions. You make the decisions. Claude executes.

5. **The files are living documents.** Update them as the project evolves. They should always reflect the current state of the project.
