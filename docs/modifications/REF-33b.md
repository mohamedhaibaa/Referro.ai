# REF-33b — Resume upload frontend

**Branch:** `feat/REF-33b-resume-frontend`
**Status:** ready for review
**Merged:** commit `<merge-sha>`, PR #N
**Size:** **L** (~+1200 net code lines; pure frontend, zero backend
or schema changes)

## Scope

Frontend half of REF-33. REF-33a (commit `6ffa32f`, PR #19) shipped
the backend: `user_profiles` table, `BlobStorageClient`,
`parse_resume`, 4 profile endpoints, and `build_user_context(user, db)`
threaded through all three AI functions. REF-33b adds the user-facing
surfaces against that live backend — closes Issue 7.

**Built:**

- Post-signup `/onboarding/resume` step with upload + skip + parse-
  failure recovery (manually fill fields when AI extraction returns
  empty).
- New `/resume` page (Sidebar `FileText` icon at line 14 already
  pointed there — REF-33b fills it in). Includes filename + uploaded
  date header, `[Replace resume]` re-upload flow with manual-edit-
  preservation toast (DQ-K UX surface), `ParsedFieldsEditor` with
  per-field structured inputs (DQ-D), destructive
  `[Delete my resume data]` with `AlertDialog` confirmation (DQ-F).
- `ResumeNudgeBanner` on `Home.tsx` for thin-context users (Q2 lean
  — Home only, not every page). Dismissal scoped to `sessionStorage`
  per DQ-E.
- Shared `ResumeUploadCard` (used by both onboarding and resume
  pages) and `ParsedFieldsEditor` (used by both pages + reused as
  the edit surface in `/resume`). Inline `<TagInput>` inside
  `ParsedFieldsEditor` since no chip-input component existed in
  `components/ui/` (Q5 lean — used 4× in one file, no need to extract).
- `api.upload<T>(path, FormData)` helper added to `lib/api/client.ts`
  so REF-33b's multipart upload reuses the existing 401-redirect
  flow without forcing `Content-Type: application/json`.

**Scope correction during build:** the original plan called the
settings page `Settings.tsx` at `/settings`. After plan review,
Mohamed noticed `Sidebar.tsx:14` already wires `/resume` (and
`:19` wires `/settings`, but neither route existed). Built
`Resume.tsx` at `/resume` instead — uses the sidebar nav as
already intended, doesn't introduce a duplicate Settings surface.
`/settings` stays unowned until a future ticket adds non-resume
settings (account, billing). This is a cleaner shipping outcome
than the original plan.

**Not built (DQ-G, Q1):**

- LinkedIn URL alternative upload path (deferred to future ticket).
- UserMenu dropdown (Q1 — Sidebar's `Settings` icon already exists
  and points to `/settings`; a dropdown would duplicate nav).
- Settings page at `/settings` (sidebar link stays dead until a
  future ticket fills it).
- Multi-resume support, version history.

## Files

| Path | Action | Lines |
|---|---|---|
| `frontend/src/lib/api/client.ts` | +`api.upload<T>` multipart helper | +28 |
| `frontend/src/lib/api/profile.ts` | new — getProfile / uploadResume / patchProfile / deleteResume with snake→camel transform (Q3) | +80 |
| `frontend/src/types/profile.ts` | new — `ProfileResponse` / `UploadResumeResponse` / `ProfilePatch` | +43 |
| `frontend/src/hooks/useProfile.ts` | new — React Query hooks (queryKey `["profile"]`) | +58 |
| `frontend/src/components/profile/ResumeUploadCard.tsx` | new — shared drag/drop + spinner + error UI | +130 |
| `frontend/src/components/profile/ParsedFieldsEditor.tsx` | new — per-field editor + inline `<TagInput>` + "edited" badges + dirty-only PATCH | +282 |
| `frontend/src/components/ResumeNudgeBanner.tsx` | new — sessionStorage-dismissible banner | +64 |
| `frontend/src/pages/OnboardingResume.tsx` | new — idle/reviewing state machine with skip + parse-failed branches | +97 |
| `frontend/src/pages/Resume.tsx` | new — full edit surface, replace flow, hard-delete dialog | +210 |
| `frontend/src/pages/Home.tsx` | render `<ResumeNudgeBanner />` at top of `<main>` (small layout restructure: column flex so banner sits above centered hero) | +10 / −3 |
| `frontend/src/pages/Signup.tsx` | `navigate("/")` → `navigate("/onboarding/resume")` | +3 / −1 |
| `frontend/src/App.tsx` | +2 routes (`/onboarding/resume`, `/resume`) + 2 imports | +4 |
| `docs/modifications/REF-33b.md` | new | +200 |
| `docs/ROADMAP.md` | Issue 7b Shipped + Issue 7 closed + Changelog | +15 |
| **Total** | | **+1224 / −4 = ~+1220 net** |

Code-only excluding docs: **~+1006 net.** Solidly L. Lower than
plan's +1283 because the scope correction (no separate `Settings.tsx`)
and Q1 skip (no UserMenu) trimmed ~150 lines.

## Decisions (all locked from REF-33 recon + plan triage)

- **DQ-D** Per-field structured editor — `ParsedFieldsEditor` has
  individual inputs per field (skills/jobs/targets as chip inputs,
  experience_years as number, summary/education as textareas with
  char counters).
- **DQ-E** Dismissible banner via sessionStorage — reappears next
  session, gone forever once a resume is uploaded.
- **DQ-G** LinkedIn URL alternative deferred.
- **DQ-H** Skipped UserMenu dropdown — Sidebar already has Settings.
- **DQ-I** Skip = navigate immediately; banner handles persistence.
- **Q1** UserMenu skipped (see DQ-H above).
- **Q2** Banner renders only on Home.tsx (top of `<main>`, above
  the centered hero — required a small column-flex restructure to
  preserve vertical centering of existing content).
- **Q3** Snake → camel transform in the API client functions
  (REF-33a backend untouched). PATCH body stays snake_case.
- **Q4** Sonner for toasts (CLAUDE.md §3 lean — Sonner is the
  project's choice; shadcn `Toaster` is mounted but unused).
- **Q5** Inline `<TagInput>` in `ParsedFieldsEditor.tsx` (~30
  lines, used 4×, no need to extract to `components/ui/`).
- **Q6** Indeterminate spinner during upload — no percentage bar
  (the latency is mostly the AI call, not the transfer).

## Test plan + results

### Programmatic
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean (only the 3
  pre-existing `data/jobs.ts` errors per CLAUDE.md §9)
- ✅ All new modules import + render without runtime errors
- ✅ All routes resolve: `/onboarding/resume`, `/resume`

### Magic-moment test (the gate — programmatic via in-process TestClient against Azure prod)

Used Mohamed's actual resume at `/tmp/test_resume.docx`. Patched
`_call_ai_foundry_with_temp` to spy on the prompt body sent to AI,
then ran `generate_followup` on Janani's verbatim multi-part reply
BEFORE and AFTER upload.

**BEFORE (thin context):**
> "Easier on a call than over text. I'm particularly interested in
> gaining insights into the role and team dynamics at Capgemini.
> Would 15 min on Tue 4pm or Thu 2pm work for you?" (175 chars)

**AFTER (rich context — resume uploaded):**
> "Easier on a call than over text. I have experience in SQL, API
> design, and data engineering from my co-op roles, and I'm keen
> to get technical guidance and insights into the Application
> Developer role. Would you be available for a quick chat on Tue
> 4pm or Thu 2pm?" (264 chars)

**Verification:**
- ✅ Thin-context marker (`"Resume not yet provided — keep claims
  general."`) present in BEFORE prompt; absent in AFTER prompt.
- ✅ At least one parsed skill (SQL / API design / Java / Python /
  HTML/CSS / etc. — all real skills from Mohamed's resume) appears
  in AFTER prompt's `User context` block.
- ✅ AFTER draft references real items: "SQL, API design, and
  data engineering" — these are actual skills + role from Mohamed's
  co-op history. "from my co-op roles" is an honest framing
  given the resume.
- ✅ AFTER draft engages with the "technical guidance" lane —
  Janani offered four (technical guidance / interview advice /
  resume feedback / role insights); the AI picked one she explicitly
  mentioned.

**This is the end-to-end value proof.** REF-33a + REF-33b deliver
the product win: AI drafts now ground claims in real user
background instead of the conversion-positive defer "happy to walk
through specifics on a call."

### Manual (deferred to reviewer — browser verification)

Tests 1-14, 16, 17 from plan §12 require a running dev server +
browser interaction. tsc clean + import smoke + the magic-moment
gate provide high confidence the components render and the
backend integration works. Reviewer to verify:

1-5. Onboarding flow (signup → /onboarding/resume → skip vs
upload, parseFailed UX)

6-9. Resume page (Sidebar → /resume → edit/replace/delete flows)

10-14. Banner behavior (visible when thin, sessionStorage dismiss,
new-tab reappear, gone after upload)

16-17. Auth redirects (`/onboarding/resume`, `/resume` →
`/login` when unauthenticated — `ProtectedRoute` handles)

## Bug fixes during build review

Two bugs surfaced when Mohamed uploaded his real resume through
the running dev server. Both fixed before push; diagnosis report
preserved in commit history for future reference.

### Bug A — Resume.tsx parseFailed UX gap (frontend, reproducible)

**Symptom:** upload returned `parseFailed=true` → toast said
"Resume saved, but we couldn't extract the fields — please fill
them in below" → page rendered the upload card AGAIN, with no
editor below to fill in. User stuck.

**Root cause:** Resume.tsx gated rendering solely on
`useProfile().isThin`. When parse failed, all server fields
(including `raw_resume_text`) were empty → backend
`_profile_to_data` computed `is_thin=true` → React Query
invalidation refetched → component re-rendered the upload card
branch. The `onUploadComplete` handler only showed a toast; it
did not change any state.

**Fix:** mirror OnboardingResume.tsx's local-state pattern.
Added `const [uploadResult, setUploadResult] = useState(null)`.
`onUploadComplete` now calls `setUploadResult(result)` after the
toast. The render gate became:

```ts
const editorProfile = uploadResult?.profile ?? profile;
const showEditor = uploadResult !== null || !isThin;
```

Four render states covered: thin-no-upload → upload card;
post-parseFailed → editor seeded from `uploadResult.profile`
(empty fields, ready for manual fill); post-success → editor
from `uploadResult.profile`; steady-state → editor from
`useProfile().profile`. Save clears `uploadResult` so subsequent
renders use the refetched profile (which now reflects the user's
edits + `user_edited_fields` tracking). Delete clears
`uploadResult` so `isThin` (now true from the post-delete
refetch) takes over and the upload card returns.

Added an inline amber callout above the editor when
`uploadResult?.parseFailed` is true so the user knows why the
fields are empty.

**Verified:** unit test exercises all 4 render-gate states + the
editor-profile selection. All 4 pass; State 2 (the parseFailed
case that was BROKEN pre-fix) now correctly renders the editor
seeded with empty fields.

### Bug B — extract_text silent failure (backend, transient)

**Symptom:** Mohamed's actual upload at 2026-05-19 01:45:58 UTC
saved `raw_resume_text=""` to his `user_profiles` row. Same
file bytes (SHA256 `105173a2ba0c35fe…`) extracted cleanly
(6113 chars) on subsequent runs. The transient failure had no
captured log.

**Root cause (unconfirmed):** likely a `python-docx` /
`lxml` flake during the live upload — `extract_text`'s
`except Exception: logger.exception(); return ""` swallowed
whatever raised, and the live log wasn't captured. Not
reproducible on demand.

**Fix:** observability addition rather than a behavior change
(we don't know what to "fix" without diagnostic data when the
bug recurs). `extract_text` now returns
`tuple[str, dict | None]`:

```python
return "", {"type": type(exc).__name__,
            "message": str(exc)[:500],
            "extension": ext}
```

`profile.py`'s upload endpoint catches the `error_info` and
injects it into `parsed["raw_ai_response"]` under the
`_extraction_error` key. Next time the bug fires, the
exception type + message land in `user_profiles.parse_raw_response`
JSONB — queryable for post-hoc debugging:

```sql
SELECT user_id, parse_raw_response
FROM user_profiles
WHERE parse_raw_response ? '_extraction_error';
```

The user-visible behavior is unchanged (`parse_failed=true`
returns; `raw_resume_text=""` saved; upload still succeeds).
Bug A's fix means even when extraction fails, the user gets a
working manual-fill editor instead of being stuck on the upload
card.

**Verified:** unit test on corrupt PDF / corrupt DOCX / empty
PDF / empty DOCX / unsupported extension / valid DOCX — all
return the expected `(text, error_info)` shape. End-to-end test
uploads corrupt-DOCX bytes through the live API and confirms
`user_profiles.parse_raw_response` contains
`{"_extraction_error": {"type": "BadZipFile", "message": "File
is not a zip file", "extension": ".docx"}}`.

### Files touched by the bug-fix iteration

| Path | Change | Lines |
|---|---|---|
| `frontend/src/pages/Resume.tsx` | +useState `uploadResult`; new render gate; clear on save+delete; inline parseFailed callout | +44 / −15 |
| `backend/app/services/resume_extraction.py` | return type → `tuple[str, dict \| None]`; exception path returns error_info | +20 / −5 |
| `backend/app/api/v1/profile.py` | unpack tuple; inject `_extraction_error` into `parsed["raw_ai_response"]` | +10 / −2 |
| `docs/modifications/REF-33b.md` | this section | +90 |

## Known limitations

- LinkedIn URL alternative deferred (DQ-G) — future ticket.
- No multi-resume support (one per user; re-upload replaces).
- No A/B testing on banner copy or onboarding flow.
- `/settings` sidebar link remains a dead link until a future
  ticket builds the Settings page.
- ParsedFieldsEditor's "edited" badge is helpful but doesn't tell
  the user WHEN they edited a field — adequate for v1.

## Plug-in points for future tickets

- **REF-34 (UX restructure):** `useProfile()` hook + `isThin`
  flag are the seams. Restructured REPLIED-state UX can check
  `isThin` to decide whether to auto-generate vs. show an upload
  nudge inline.
- **REF-35 (prompt tuning):** zero frontend impact — REF-33b
  doesn't constrain the prompt's expectations of `UserContext`.
- **Future onboarding-question ticket (target_roles /
  target_companies as proper questions):** add a step to
  `OnboardingResume.tsx`'s state machine; the `ParsedFieldsEditor`
  already accepts and PATCHes these fields, no rework needed.
- **Future Settings page:** when built, the existing
  `Sidebar.tsx:19` Settings link will activate; no nav rewire.
- **LinkedIn URL alternative (REF-35+):** add a "Or import from
  LinkedIn" CTA inside `ResumeUploadCard`; reuses
  `useUploadResume` pattern with a different API client function.
