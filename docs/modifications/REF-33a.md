# REF-33a — Resume parsing backend (UserContext v2 populated)

**Branch:** `feat/REF-33a-resume-parsing-backend`
**Status:** ready for review
**Merged:** commit `6ffa32f`, PR #19
**Size:** **M-L** (~+710 net code lines including 1 prompt + 1 mod doc;
~+540 Python logic + new prompt; one new table)

## Scope

REF-32 shipped `generate_followup` with a foundation-ready `UserContext`
dataclass — v2 fields (`skills`, `experience_summary`, etc.) defaulted
empty pending REF-33. REF-33a populates them via resume upload + AI parse.

**Changed.** New `user_profiles` table (1:1 with users, CASCADE delete).
Real `BlobStorageClient` implementation (the worker stub finally becomes
live, moved to `backend/app/services/blob_storage.py`; worker keeps a
re-export shim). New `parse_resume` AI function + `RESUME_PARSER_SYSTEM_PROMPT`
mirroring REF-30's `parse_reply` pattern (temp 0.2, defensive try/except
with empty-dict fallback). New `backend/app/api/v1/profile.py` with four
endpoints (POST upload, GET, PATCH, DELETE). `build_user_context(user)`
extended to `build_user_context(user, db)` and JOINs `user_profiles`
when it exists. **All three** AI function call sites
(`generate_initial_draft`, `revise_draft`, `generate_followup`) updated to
pass `db` through — rich context flows into ALL existing AI calls the
moment a user uploads a resume.

**Not changed.** Frontend (entirely deferred to REF-33b). REF-32 architecture
(`ai_meta` sidecar, fallback chains, `_generate_ref_response`) untouched.
Lifecycle cascade, contact replies, chat messages — untouched. The shim
`build_user_context_block()` is preserved but unused (insurance against
missed callers; remove in future cleanup).

## Files

| Path | Action | Lines |
|---|---|---|
| `backend/migrations/versions/o5p6q7r8s9t0_add_user_profiles_table.py` | new | +75 |
| `backend/app/db/models/user.py` | +UserProfile class | +60 / −2 |
| `backend/app/core/config.py` | +`BLOB_STORAGE_CONNECTION_STRING` setting | +1 |
| `backend/app/services/blob_storage.py` | new — real Azure Blob client (replaces NotImplementedError stub) | +70 |
| `worker/app/integrations/blob_storage.py` | replace with re-export shim | +9 / −22 |
| `backend/app/services/resume_extraction.py` | new — pypdf + python-docx defensive extraction | +35 |
| `backend/app/services/ref_ai.py` | +`parse_resume`, +`_empty_parse_result`, +`db` param on `generate_initial_draft`/`revise_draft`, swap zero-arg shim → `build_user_context(user, db)` | +95 / −5 |
| `backend/app/prompts/resume_parser.py` | new `RESUME_PARSER_SYSTEM_PROMPT` | +110 |
| `backend/app/prompts/user_context.py` | `build_user_context(user)` → `build_user_context(user, db)` with `UserProfile` JOIN; shim docstring marked deprecated | +35 / −15 |
| `backend/app/api/v1/profile.py` | new — 4 endpoints (POST upload + GET + PATCH + DELETE), Pydantic models, serializers | +260 |
| `backend/app/api/v1/router.py` | +1 import + 1 include_router | +2 |
| `backend/app/api/v1/ref_chat.py` | 3 call-site updates (thread `db` through) | +3 / −3 |
| `backend/pyproject.toml` | +pypdf>=4.0 + python-docx>=1.1 | +2 |
| `docs/modifications/REF-33a.md` | new | +260 |
| `docs/ROADMAP.md` | Issue 7a Shipped + Changelog | +20 |

Net: **+1037 / −47 = +990 net.** Higher than plan estimate (+840) — bulk
is mod doc (260 lines) + the new `profile.py` being larger than estimated
(serializers + Pydantic models + UPSERT manual-edit preservation logic).
**Code-only excluding docs: ~+710 net.** Tracks recon's L sizing.

## Build iteration history

Single-cycle build — no iteration required. Programmatic checks clean
on first run; all 12 smoke tests passed first attempt; parse quality
acceptable on first synthesis resume; integration test confirmed rich-
context plumbing works through `generate_followup` end-to-end.

One small surprise during build: `alembic check` surfaced pre-existing
ORM-style drift (DateTime() vs TIMESTAMP(timezone=True)) across all
existing tables, plus two tables without models (`credit_transactions`,
`waitlist_signups`). REF-33a's `user_profiles` columns matched the
existing convention exactly (the migration applies `TIMESTAMP(timezone=True)`
on the DB side; the model declares plain `datetime` matching every
other table in `job.py`). No regression — left as-is.

## Test plan results

### Programmatic
- ✅ Full import smoke (`app.main` loads cleanly; all new modules import)
- ✅ Python AST parse on all touched backend files
- ✅ Zero remaining zero-arg `build_user_context()` calls
- ✅ `build_user_context_block` shim only referenced from its own definition + docstring
- ✅ All three AI function call sites in `ref_chat.py` pass `db`

### Migration
- ✅ Applied to Azure prod: `n4o5p6q7r8s9` → `o5p6q7r8s9t0`
- ✅ Table inspection confirms: 17 columns, unique constraint on user_id, FK with CASCADE, index on user_id
- ✅ Round-trip: `alembic downgrade -1` + `alembic upgrade head` clean

### Manual gate (against Azure prod via in-process TestClient)

**AI failure fallback** — `parse_resume` and `parse_reply` both return
their empty/uncategorized fallbacks when AI raises. No 500s.

**12 backend smoke tests — 12/12 PASS:**

| # | Test | Status |
|---|---|---|
| 1 | POST PDF | 201 ✅ |
| 2 | POST DOCX | 201 ✅ |
| 3 | POST >5MB | 413 ✅ |
| 4 | POST text/plain | 415 ✅ |
| 5 | POST no auth | 401 ✅ |
| 6 | Re-POST replaces blob + UPSERTs row | 201 ✅ |
| 7 | PATCH+re-POST preserves manual edits + surfaces flag | flag=True, kept=True ✅ |
| 8 | GET with profile | 200, is_thin=False ✅ |
| 9 | GET no profile (thin envelope) | 200, is_thin=True, skills=[] ✅ |
| 10 | PATCH target_roles (Q3 — not AI-parsed) | 200, user_edited_fields=['skills','target_roles'] ✅ |
| 11 | DELETE resume | 204, row + blob gone ✅ |
| 12 | Re-POST after DELETE | 201, overwrote_user_edits=[] (fresh) ✅ |

**parse_resume quality** (synthesis resume — Stripe/Shopify/RBC, MS NYU,
BSc UToronto, Python/Go/Java skills):
- skills: 8 real technical skills, no soft-skill fluff
- experience_years: 5 (judgment-based; reasonable given internship +
  3 years + ~4 years current)
- experience_summary: 3 descriptive sentences, no promotional language
- education: highest degree first, format matches spec
- job_titles_history: chronological from most recent, format matches spec

**Integration — rich context flows through all 3 AI functions:**
- ✅ `generate_followup` user_message contains skills, summary,
  `Experience: 6 years`, education, past titles
- ✅ Thin-context regression: without UserProfile row, prompt still
  emits "Resume not yet provided" marker (REF-32 fallback preserved)

## Decisions (DQ-A through DQ-L locked)

- **DQ-A** New `user_profiles` 1:1 table. Single migration. Clean
  separation from auth/billing.
- **DQ-B** Azure Blob via `BlobServiceClient.from_connection_string`.
  Connection string in `BLOB_STORAGE_CONNECTION_STRING` env var
  (added to `config.py`). Container `resumes` was pre-named.
- **DQ-C** Skip `target_roles` / `target_companies` extraction.
  Columns provisioned for future onboarding ticket.
- **DQ-D** Per-field structured editor — frontend (REF-33b). Backend
  PATCH accepts individual fields per Pydantic model.
- **DQ-E** Dismissible banner for thin-context users — frontend (REF-33b).
- **DQ-F** Hard delete: row + blob both removed on DELETE.
- **DQ-G** LinkedIn URL alternative deferred (potential REF-35+).
- **DQ-H** UserMenu dropdown for Settings nav — frontend (REF-33b).
- **DQ-I** Skip = navigate immediately (frontend behavior).
- **DQ-J** UPSERT via SQLAlchemy ORM (load-or-create pattern with
  manual-edit preservation), not raw `INSERT ... ON CONFLICT`. Cleaner
  with SQLAlchemy.
- **DQ-K** Edits override AI. `user_edited_fields` JSONB list tracks
  field names manually touched via PATCH. Re-upload preserves edited
  fields; meta response surfaces `overwrote_user_edits[]` so frontend
  can show "we kept your edits to: X, Y".
- **DQ-L** All three AI functions threaded with `db`. Rich context
  flows everywhere immediately on resume upload.

## Q1-Q4 locked answers applied

- **Q1** `BLOB_STORAGE_CONNECTION_STRING` env var; lazy
  `BlobServiceClient.from_connection_string`.
- **Q2** DELETE drops row entirely (not soft-delete). Row exists ↔
  user has resume data.
- **Q3** PATCH accepts `target_roles` / `target_companies` writes
  even though they're not AI-parsed.
- **Q4** parse_resume failure → upload still 201 with
  `parse_failed=true` flag + empty fields. Blob saved either way.

## Known limitations

- `target_roles` / `target_companies` columns provisioned but
  unpopulated (DQ-C — future onboarding-question ticket adds them
  via PATCH without migration).
- No multi-resume support — one profile per user, re-upload replaces.
- No re-parse on PATCH — DQ-K: manual edits override AI.
- LinkedIn URL alternative deferred (DQ-G).
- PDF extraction quality varies for image-only scans / complex
  multi-column layouts. By design, messy text passes to the AI;
  gpt-4o-mini handles imperfect input. Worst case: empty fields +
  `parse_failed=true` flag → user fills manually via REF-33b PATCH.

## Privacy

Resume contains PII (work history, education, sometimes addresses).
Same posture as REF-30's `contact_replies.reply_text`. `DELETE /api/v1/profile/resume`
is hard delete (blob + row both gone); GDPR/CCPA aligned. Future TOS
update should explicitly call out resume storage.

## Cost impact

- `parse_resume` per upload: ~$0.0009 on gpt-4o-mini (one-time cost
  per user per re-upload).
- `generate_initial_draft` / `revise_draft` / `generate_followup`:
  per-call cost ticks up ~$0.0001-0.0003 when a user has a populated
  resume (rich UserContext block adds ~150-300 input tokens).
- File storage: ~$0.02/GB/month Azure Blob. At 10k users × 200KB =
  2GB → ~$0.04/month.
- Per-user-per-month delta: well under $0.05 at realistic scale.

## REF-33b dependencies

REF-33b is the frontend half. Required API surfaces (all live in this
PR):

- `POST /api/v1/profile/resume` — multipart upload; returns
  `{ data: ProfileData, meta: { overwrote_user_edits: string[],
  parse_failed: bool } }`
- `GET /api/v1/profile` — always returns 200 with thin envelope
  (`is_thin=true`) when no profile exists. Simplifies the React
  Query hook.
- `PATCH /api/v1/profile` — partial body; touched fields land in
  `user_edited_fields` and are preserved across re-upload.
- `DELETE /api/v1/profile/resume` — 204; idempotent.

UX hints for REF-33b:
- Upload flow latency: 5-10s end-to-end (blob upload ~1s + extraction
  ~0.5s + AI parse ~3-7s). Frontend must show a clear "Parsing your
  resume…" indicator. Suggest existing `<Loader2 className="animate-spin" />`.
- Confirmation panel: render parsed fields as editable inputs from
  the start. User trust depends on visible AI extraction + low-friction
  correction.
- Re-upload UX: when `meta.overwrote_user_edits` is non-empty, show
  "We kept your manual edits to: skills, education" so the user knows.
- `parse_failed=true` path: show "We couldn't read your resume. Please
  fill in the fields below manually." User can PATCH instead of
  re-uploading.

## Plug-in points for future tickets

- **Future onboarding-question ticket**: PATCH `target_roles` /
  `target_companies` from a dedicated UI step. No new endpoint, no
  migration.
- **REF-35 LinkedIn alternative**: alternate POST endpoint at e.g.
  `/api/v1/profile/linkedin` that scrapes a LinkedIn URL and
  populates the same `UserProfile` schema. Reuses everything below
  parse_resume.
- **Multi-resume support**: new table `resume_versions` (FK to
  user_profile); requires endpoint changes but parse pipeline stays
  identical.
- **Prompt-quality eval**: `parse_raw_response` JSONB on UserProfile
  is the offline-eval seam (queryable raw AI output, same pattern as
  ContactReply.raw_ai_response).
