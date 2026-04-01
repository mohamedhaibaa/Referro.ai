# MEMORY.md — Referoo.ai Decisions & Lessons

> **Accumulated knowledge from building this project.** Check here before making architectural decisions or when something breaks unexpectedly. Update this file when you learn something new.

---

## Architecture Decisions (and WHY)

### 1. Three-service split: API + Worker + Frontend
**Decision:** Separate FastAPI (sync HTTP) from Worker (async queue consumer).
**Why:** AI calls take 5–30 seconds. If they ran inside API request handlers, the frontend would hang. Service Bus decouples them — API returns 202 immediately, worker processes in the background, frontend polls for results.
**Trade-off:** More complexity (3 services to run locally), but critical for UX.

### 2. Azure Service Bus over direct AI calls
**Why:** Queue provides retry capability, audit trail, backpressure. Worker can process even if frontend is offline. If AI Foundry is slow/down, messages sit in queue instead of timing out.
**Trade-off:** Added latency (queue hop) and Azure dependency.

### 3. JWT stateless auth (not sessions)
**Why:** Stateless scales across multiple container instances with zero shared state. Token is self-contained (holds user_id). No session store needed.
**Trade-off:** Can't invalidate individual tokens (logout is client-side only). Token theft = full access until expiry.

### 4. PostgreSQL over NoSQL
**Why:** Data is highly relational (jobs → contacts → outreach → follow-ups). ACID guarantees matter for milestone tracking. Complex queries (dashboard aggregations, job detail with all children) are natural in SQL.
**Trade-off:** Schema rigidity (need migrations for changes).

### 5. React Query over Redux
**Why:** Server state (jobs, contacts, dashboard) is the primary state. React Query handles caching, invalidation, polling, and loading states with less boilerplate than Redux. Client state is minimal (auth context, UI toggles).
**Trade-off:** Less control over cache shape. Debugging cache invalidation issues can be tricky.

### 6. Soft deletes over hard deletes
**Why:** Preserves data for audit/recovery. User can undo. Activity log stays intact.
**Trade-off:** All queries must filter `is_deleted == False`. Forgotten filters show "ghost" jobs.

### 7. Client-side inbox generation (temporary)
**Why:** Faster iteration during MVP. No backend changes needed to tweak inbox logic. Simple derived state from jobs array.
**Trade-off:** Not persistent (loses on refresh), can't snooze/complete permanently. **Must move to server-side in Phase 3.**

### 8. SQLAlchemy ORM over raw SQL
**Why:** Type safety, SQL injection prevention, portable queries. Model classes make intent clear.
**Trade-off:** Less control over complex queries. N+1 risks if not careful with eager loading.

### 9. Single monorepo
**Why:** Frontend, backend, worker stay in sync. Shared docs, one set of CI workflows. Easier for a small team.
**Trade-off:** Larger repo, all CI runs on every push (mitigated with path filters).

### 10. TypeScript strict mode OFF (temporary)
**Why:** Rapid prototyping during MVP. Strict mode would slow down scaffolding phase.
**Should be:** Turned ON in Phase 4 (Polish). Will require fixing hundreds of implicit `any` and null issues.

---

## Gotchas & Traps

### Database
- **Connection string must use `postgresql+psycopg://`** — not `postgresql://`. Missing the driver name causes cryptic connection errors.
- **Local Postgres runs on port 5433** (not default 5432) — defined in `docker-compose.local.yml`.
- **Alembic needs the model imported** in `env.py` to detect changes. If autogenerate produces an empty migration, check model imports.
- **UUID serialization:** UUID objects must be cast to `str()` in API responses. SQLAlchemy returns UUID objects, not strings.
- **datetime serialization:** Always use `.isoformat()`. Frontend expects ISO 8601 strings.

### Service Bus
- **Queue names are kebab-case and case-sensitive.** `"job-parsing"` ≠ `"job_parsing"` ≠ `"Job-Parsing"`.
- **6 queues must exist in Azure before workers can listen.** If a queue doesn't exist, the consumer throws on startup.
- **Messages are JSON strings.** Always `json.dumps()` before sending, `json.loads()` when receiving.

### Frontend
- **React Query cache keys must match exactly.** `["jobs"]` and `["jobs", jobId]` are different caches. Invalidating `["jobs"]` doesn't invalidate `["jobs", "abc-123"]`.
- **Toast from sonner, not from shadcn.** Both exist but `sonner` is the active toast library.
- **`@/` alias resolves to `frontend/src/`.** Configured in `vite.config.ts` and `tsconfig.json`.
- **shadcn components are in `src/components/ui/`.** Don't edit them — extend in new files.

### Auth
- **JWT secret must be ≥32 chars in production.** Short secrets are brute-forceable.
- **Changing JWT_SECRET_KEY invalidates all existing tokens.** All logged-in users get 401 until they re-login.
- **CORS_ALLOWED_ORIGINS is comma-separated.** Forgetting to add the production frontend URL means zero API access from prod.

### Worker
- **Worker uses AUTOCOMMIT isolation.** Unlike the API's transactional sessions. This is intentional — worker does explicit commits.
- **Worker functions are async.** Mixing sync/async causes event loop issues. Always use `await` for I/O.
- **AI Foundry uses httpx, not the Azure SDK.** Custom wrapper in `integrations/ai_foundry.py`.

---

## Lessons Learned

### Session 1: Initial Setup
- Docker Compose for local Postgres works well. Port 5433 avoids conflicts with any system Postgres.
- FastAPI + SQLAlchemy 2.0 `Mapped` syntax is cleaner than the old `Column()` syntax.
- Alembic autogenerate works but needs all models imported via `env.py`.

### Session 2: Auth Implementation
- `python-jose` for JWT works but has some rough edges with type hints.
- `passlib[bcrypt]` is the standard for password hashing. Don't roll your own.
- Storing token in localStorage is simple but vulnerable to XSS. Acceptable for MVP.

### Session 3: Job CRUD + Parsing
- The queue-publish-poll pattern (202 + WorkflowRun + polling) is verbose but robust.
- BeautifulSoup scraping is fragile — LinkedIn blocks most scraping attempts. ScrapingDog may be needed.
- AI Foundry JSON parsing sometimes returns markdown-wrapped JSON. Need to strip ``` markers.

### Session 4: Dashboard + Kanban
- React Query's `invalidateQueries` is the key to keeping UI in sync after mutations.
- Kanban drag-and-drop status updates need optimistic updates for smooth UX.
- Dashboard aggregation queries should be SQL-level `COUNT` + `GROUP BY`, not Python-level loops.

---

## Open Questions (Unresolved)

1. **Should we use ScrapingDog or enhance BeautifulSoup?** LinkedIn blocks direct scraping. ScrapingDog costs money. Need to decide before Phase 2.
2. **WebSocket vs SSE for real-time updates?** Polling works but is wasteful. WebSocket is bidirectional (overkill?). SSE is simpler and one-directional (probably better fit).
3. **How to handle AI response validation?** AI sometimes returns invalid JSON or missing fields. Need a robust parsing + fallback strategy.
4. **Should inbox move to server-side in Phase 3 or Phase 4?** Currently client-side. Server-side adds complexity but enables persistence and notifications.
5. **Rate limiting strategy?** Per-user vs per-IP? How many AI calls per day? Need to define limits before implementing.

---

## Update Log

| Date | What Changed | Why |
|------|-------------|-----|
| 2026-03-29 | Initial MEMORY.md created | Project knowledge base established |

> **To future Claude sessions:** Add your discoveries, mistakes, and decisions to this file. It's the institutional memory of the project.
