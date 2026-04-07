# REF-12 Contact Discovery — Learnings

## What Was Built
AI-powered contact discovery pipeline: Apify LinkedIn scrape → active employee filter → AI scoring (gpt-4o-mini) → top-5 selection → save with posts.

---

## Lesson 1: Apify `harvestapi~linkedin-company-employees` Output Schema

### The Bug
The worker assumed position data would be at `currentPositions` or `currentPosition` with a `current: true` flag. None of those assumptions were correct.

### The Reality
| Field | What it contains | Usable for |
|-------|-----------------|------------|
| `currentPosition` | Array — just `companyName`, no title | Checking if employed (non-empty = active) |
| `currentPositions` | Does not exist in this actor | Nothing |
| `experience[]` | Full history — `position` (title), `companyName`, `startDate`, `endDate` | Title extraction, "still employed" check |

**Rule:** A profile is "currently employed at target company" when any `experience` entry has no `endDate`. Title comes from `experience[].position`, not `title`.

### The Fix
```python
def _is_active(profile):
    # Try lightweight current-position indicators first
    for key in ("currentPositions", "currentPosition"):
        if profile.get(key):
            return True
    # Fall back: any experience entry with no endDate
    return any(not e.get("endDate") for e in profile.get("experience") or [])

def _current_position(profile):
    # Normalize title from whichever field exists
    for key in ("currentPositions", "currentPosition"):
        cp = profile.get(key) or []
        if isinstance(cp, dict): cp = [cp]
        if cp:
            pos = cp[0]
            return {"title": pos.get("title") or pos.get("position", ""), ...}
    # Fall back to experience
    experience = profile.get("experience") or []
    current = [e for e in experience if not e.get("endDate")]
    entry = (current or experience)[:1]
    ...
```

### How to Debug This in the Future
The consumer already logs sample keys when profiles arrive:
```python
logger.info("Sample profile top-level keys: %s", list(profiles[0].keys()))
```
If the active filter returns 0, read those keys in the worker log and compare to what `_is_active()` checks.

---

## Lesson 2: AUTOCOMMIT Breaks Rollback

### The Bug
```python
_engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
```

With AUTOCOMMIT, every `db.execute()` statement commits immediately. The `db.rollback()` in the except block is a no-op. If the worker crashes mid-way through inserting 5 contacts, partial data survives.

### The Fix
Remove `isolation_level="AUTOCOMMIT"`. Use explicit `db.commit()` at logical checkpoints (which the code already had). Now rollback actually works.

---

## Lesson 3: Apify Field Name Conventions

- URLs: `linkedinUrl` (camelCase)
- Names: `firstName`, `lastName`
- Location: `location.linkedinText`
- Education: `education[].schoolName`
- Tenure: `tenureAtCompany.numYears` / `numMonths`
- Title: `experience[].position` (NOT `.title`)

Always log `list(profiles[0].keys())` at the start of any new Apify integration to verify the actual schema before writing filtering logic.

---

## Architecture Reminder
The full contact discovery lifecycle:
```
POST /jobs/{id}/contacts/discover
  → WorkflowRun created (queued)
  → Published to "contact-discovery" queue
  → Worker: queued → running → completed/failed
  → GET /jobs/{id}/contacts returns saved contacts
  → Frontend polls workflow_run until terminal status
```
