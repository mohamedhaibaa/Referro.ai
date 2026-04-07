# Lessons Learned — Referro.ai

Running log of patterns discovered, mistakes made, and rules for future sessions.

---

## REF-12: Contact Discovery (April 2026)

### Always log the raw API response before parsing it
When integrating with any AI or third-party API that returns structured data, log the raw response before calling `json.loads()`. We spent time debugging a silent crash that turned out to be GPT-4o-mini wrapping its JSON in markdown code fences. A single `logger.info("Raw response: %r", result)` line would have shown us immediately.

**Rule:** Every AI response parsing call must have a raw log line above it.

---

### Never assume a third-party API's output schema — verify it live
We coded the Apify contact filter assuming `currentPositions` existed with a `current: true` flag. Neither existed. The actor uses `experience[]` with title as `position` and "currently employed" meaning no `endDate`. We only found out when 0 contacts were saved and we read the actual keys from the log.

**Rule:** When integrating a new Apify actor (or any external API), add a log line that prints the top-level keys of the first result. Read them before writing any field-extraction logic.

---

### Slug guessing for company URLs is unreliable — never ship it as the primary strategy
"Legend Global" → `legend-global` seemed reasonable. LinkedIn's actual slug was `legendglobal`. The wrong company was scraped, returning 0 employees. Extract the URL from the source (job page HTML) or look it up via API. Guessing from a name is always a last resort, never a primary strategy.

**Rule:** If you're constructing a URL from a company name, it's a smell. Find a way to get the real URL from a trusted source.

---

### AUTOCOMMIT in SQLAlchemy makes rollback() a silent no-op
The worker used `isolation_level="AUTOCOMMIT"` which committed every SQL statement immediately. The `db.rollback()` in the except block did nothing. Partial data could survive errors. Always use standard transactions (the SQLAlchemy default) in workers that do multi-step DB writes.

**Rule:** Never set `isolation_level="AUTOCOMMIT"` in workers that use rollback for error recovery.

---

### Service Bus message locks expire during long-running workers
Azure Service Bus default lock duration is 60 seconds. The contact discovery pipeline takes 3-8 minutes. Without lock renewal, the broker re-delivers the message mid-run, causing duplicate processing. Add a background coroutine that renews the lock every 30 seconds for any consumer that does external API calls.

**Rule:** Any worker that calls external APIs (Apify, AI, etc.) must renew its Service Bus message lock periodically.

---

### CORS origins must match the exact port Vite lands on
Vite auto-increments the port (8080 → 8081 → 8082) if the default is taken. If the frontend lands on a port not listed in `CORS_ALLOWED_ORIGINS`, all API calls fail with "Failed to fetch" — no useful error message, no hint it's a CORS issue. Check the port in Vite's startup output and add it to the backend `.env`.

**Rule:** Keep `CORS_ALLOWED_ORIGINS` broad during local development (add 8080-8083). Tighten it only in production.

---

### Renaming the project folder breaks all venvs
Python venvs hardcode the absolute path of the interpreter inside themselves. When the project folder was renamed from `fun stuff/` to `FunStuff/`, all venvs silently broke. Every `python`, `uvicorn`, and `alembic` command failed with path errors.

**Rule:** Never rename the project root folder without recreating all venvs. Always use `python3.12` explicitly — `python3` on this machine defaults to 3.9.

---

### Compute confidence at API time, not stored in DB
We initially had `confidence` (High/Medium/Low) as part of the Contact type on the frontend. It was tempting to store it. We didn't — we compute it from `relevance_score` in the API serializer. During this session we changed the thresholds twice. If it were stored, we'd need a data migration every time we tune the scoring. Derived/view-layer fields should stay derived.

**Rule:** Only store what the worker computed. Compute display-layer fields (confidence, relationship labels) in the API serializer.

---

### Non-LinkedIn pages embed unrelated LinkedIn URLs
When scraping a non-LinkedIn job page to extract the company's LinkedIn URL, you will find LinkedIn links from unrelated companies in the page footer, header, or embedded widgets. Only trust LinkedIn company URL extraction from LinkedIn's own job pages. For other sites, scrape the company's own homepage footer or use an API lookup with domain validation.

**Rule:** Never take the first `linkedin.com/company/` URL from a non-LinkedIn page and assume it's the posting company.
