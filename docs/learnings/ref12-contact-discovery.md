# REF-12: Contact Discovery — Full Teach-Back

## What Was Built

Contact discovery lets users click a button on any job detail page and automatically get 5 ranked LinkedIn contacts at that company to reach out to for a coffee chat.

### Files Created
- `worker/app/consumers/contact_discovery.py` — the async worker that runs the full pipeline
- `backend/app/api/v1/contacts.py` — REST endpoints (list contacts, trigger discovery, delete)
- `frontend/src/lib/api/contacts.ts` — API client functions
- `frontend/src/hooks/useContacts.ts` — React Query hooks
- `backend/migrations/versions/c3d4e5f6a7b8_add_location_to_jobs.py`
- `backend/migrations/versions/d4e5f6a7b8c9_add_company_linkedin_url_to_jobs.py`
- `docs/learnings/ref12-contact-discovery.md` (this file)

### Files Modified
- `worker/app/scraper.py` — added company LinkedIn URL extraction + homepage footer scrape
- `worker/app/consumers/job_parsing.py` — added fallback chain for finding company LinkedIn URL
- `backend/app/services/queue.py` — added `publish_contact_discovery()`
- `backend/app/db/models/job.py` — added `company_linkedin_url` column
- `frontend/src/components/job-detail/ContactDiscovery.tsx` — wired to real API
- `frontend/src/hooks/useJobs.ts` — added 5s refetch interval
- `frontend/src/pages/JobDetail.tsx` — passes `jobId` instead of hardcoded contacts
- `frontend/src/types/job.ts` — updated Contact interface to match real DB schema
- `CLAUDE.md` — updated queue status table

---

## How It Works End-to-End

### Phase 1: Job Parsing (happens when user adds a job)
The job parser now does one extra thing beyond extracting title/company/description — it tries to find the correct LinkedIn company URL and saves it to `jobs.company_linkedin_url`. This is critical because contact discovery needs this URL to scrape the right company's employees on LinkedIn.

**For LinkedIn job URLs** (`linkedin.com/jobs/view/...`):
- The raw HTML reliably contains the company's LinkedIn URL near the top (logo and org-name links)
- We extract the first `linkedin.com/company/` match from the HTML before stripping it to text
- This is fast, free, and 100% accurate

**For non-LinkedIn job URLs** (company career sites, job boards, etc.):
1. First, fetch the company's homepage (e.g. `englobecorp.com`) and look for a LinkedIn icon/link in the footer — most companies list their LinkedIn there
2. If that fails, call `harvestapi/linkedin-company` on Apify with the company name, then validate the result by cross-referencing the `website` field with the job URL's domain. Only accept a match — never guess.
3. If neither works, `company_linkedin_url` stays null and contact discovery will log a warning

### Phase 2: Contact Discovery (triggered by user clicking "Discover Contacts")
1. **Frontend** calls `POST /jobs/{id}/contacts/discover`
2. **Backend** verifies the job belongs to the user, then calls `publish_contact_discovery()` which creates a `WorkflowRun` row (status: queued) and publishes a message to the `contact-discovery` Azure Service Bus queue
3. **Backend** returns `{ workflowRunId }` immediately (202 Accepted)
4. **Frontend** starts polling `GET /workflow-runs/{id}` every 2 seconds
5. **Worker** picks up the message and runs the pipeline:
   - Updates workflow status to `running`
   - Reads the job's `company_linkedin_url` from DB
   - Calls Apify `harvestapi~linkedin-company-employees` with that URL (or slug fallback)
   - Filters profiles: only keep people currently employed there (`_is_active()`)
   - Sends all profiles to GPT-4o-mini for scoring (0-100) with the job context
   - Sorts by score, takes top 5
   - For each of the top 5, fetches their recent LinkedIn posts (for outreach conversation starters)
   - Deletes any previously discovered contacts for this job
   - Saves 5 new contacts to the `contacts` table
   - Updates workflow status to `completed`
6. **Frontend** polling detects `completed`, invalidates the contacts cache, contacts appear

### Phase 3: Display
- `GET /jobs/{id}/contacts` returns contacts sorted by score descending
- The API computes `confidence` (High/Medium/Low from score) and `relationship` (inferred from title keywords) on the fly — these aren't stored
- The frontend renders each contact as a card with name, title, confidence badge, and a LinkedIn link

---

## Key Architectural Decisions and WHY

### 1. Company LinkedIn URL saved at parse time, not at discovery time
We extract and save `company_linkedin_url` during job parsing (not when the user clicks Discover) because:
- Job parsing already fetches the raw HTML — we get the URL for free with no extra API calls
- If we waited until discovery time, we'd have to re-fetch the job page or do a lookup, adding latency to an already slow pipeline
- It also lets us show the user which company will be searched before they trigger discovery (future feature)

### 2. Footer scrape → harvestapi fallback (not slug guessing)
The original code converted the company name to a URL slug (e.g. "Legend Global" → `legend-global`). This is unreliable — LinkedIn slugs are not predictable from company names (`legendglobal` not `legend-global`). We discovered this when contact discovery searched the wrong "Legend" company and returned 0 employees.

The two-step fallback is more reliable: the company's own website almost always has their LinkedIn in the footer, and if not, harvestapi can find it by name with domain validation to prevent wrong-company matches.

### 3. Message lock renewal
The Service Bus default message lock is 60 seconds. The contact discovery pipeline takes 3-8 minutes (multiple Apify calls). Without lock renewal, the message would expire mid-run, the broker would re-deliver it, and the same job would be processed twice. The `_renew_lock_periodically()` coroutine runs as a background task alongside `_process()`, renewing every 30 seconds.

### 4. DELETE contacts before INSERT
If the user clicks "Discover Contacts" twice (impatient, or testing), the old run's contacts and the new run's contacts would both be saved — duplicates. Deleting the existing contacts for that job before inserting new ones keeps the table clean.

### 5. Confidence computed in API, not stored
`confidence` (High/Medium/Low) is derived from `relevance_score`. We don't store it because it's a view-layer concern — if we ever change the thresholds (we did change them during this session), we don't need a data migration. Same for `relationship` (inferred from title keywords) and `source` (always "LinkedIn").

### 6. AUTOCOMMIT removed
The original worker used `isolation_level="AUTOCOMMIT"` which meant every SQL statement committed immediately. This made `db.rollback()` a no-op — if the worker crashed after inserting 3 of 5 contacts, those 3 would be permanently saved with no way to undo. Standard transactions (the default) mean rollback actually works.

---

## How It Connects to Existing Referro Components

- **Job Parsing Worker** → now extracts and saves `company_linkedin_url` alongside title/company/description. Contact discovery depends on this field.
- **WorkflowRun lifecycle** → contact discovery follows the exact same pattern as job parsing: queued → running → completed/failed. The frontend polls the same `/workflow-runs/{id}` endpoint.
- **Azure Service Bus** → the `contact-discovery` queue follows the same publisher/consumer pattern as `job-parsing`. Queue name must match exactly (kebab-case, case-sensitive).
- **Apify** → we now use two actors: `harvestapi~linkedin-company-employees` (employees scraper) and `apimaestro~linkedin-profile-posts` (recent posts). Both use the same `APIFY_API_TOKEN`.
- **React Query** → contacts use the same `useQuery`/`useMutation` pattern as jobs and milestones. Cache key is `["contacts", jobId]`.

---

## Things You Should Understand as the Developer

**The Apify output schema is not what you'd expect.**
The `harvestapi~linkedin-company-employees` actor returns position data in the `experience[]` array, not in `currentPositions` or `currentPosition`. The title field inside experience entries is called `position`, not `title`. A person is "currently employed" when their experience entry has no `endDate`. We learned this the hard way — the original code assumed `currentPositions` existed and had a `current: true` flag. Neither was true.

**GPT-4o-mini wraps JSON responses in markdown code fences.**
When you ask an LLM to return JSON, it often responds with ` ```json\n[...]\n``` `. `json.loads()` crashes on this. Always strip markdown fences before parsing. We added a regex strip step and also log the raw response so you can debug what the model actually returned.

**Non-LinkedIn job pages may embed unrelated LinkedIn URLs.**
The englobecorp.com job page had a LinkedIn link in its footer that pointed to SWCA Environmental Consultants — a completely unrelated company. Our extraction now only trusts LinkedIn company URLs from LinkedIn job pages. For all other sites, we do the footer scrape on the company's own domain.

**The venv path is hardcoded inside the venv itself.**
When the project folder was renamed from `fun stuff/` to `FunStuff/`, all three venvs broke silently. If you ever rename the project folder, delete and recreate all three venvs (`backend/venv`, `worker/venv`). Always use `python3.12 -m venv venv` — `python3` on this machine defaults to 3.9 which doesn't meet the `>=3.12` requirement.

**CORS origins must be explicitly listed.**
Vite picks a free port (8080, 8081, 8082...) when the default is taken. If you start services in a different order, the frontend may land on a port not in `CORS_ALLOWED_ORIGINS` in the backend `.env`, causing "Failed to fetch" errors with no obvious explanation. When in doubt, check the port Vite landed on and add it to CORS.
