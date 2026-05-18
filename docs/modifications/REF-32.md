# REF-32 — AI-generated per-category reply drafts (`generate_followup`)

**Branch:** `feat/REF-32-generate-followup-ai`
**Status:** ready for review
**Merged:** commit `21b08e7`, PR #18
**Size:** **M-edge-of-L** (~+645 net code lines including the two new
prompt modules; ~+200 net Python logic)

## Scope

**Changed.** REF-31's `INTENT_TO_DRAFT_TEMPLATE` lookup +
`fill_template()` call (the only two lines of the
`draft_reply_*` state-machine branch that REF-32 replaces) is
swapped for an AI call. The new `generate_followup(contact, job,
user_context, recruiter_reply_text, intent_category,
extracted_data, initial_outreach_text)` reads the recruiter's
actual reply text and writes a contextual draft that engages with
what was said and pivots toward a 15-minute coffee chat. REF-31's
static template is preserved as the fallback when the AI call
fails (or no `ContactReply` exists at preload time) — user
always gets *something* in the draft_card.

Foundation-ready: the new `UserContext` dataclass + builder lives
in `backend/app/prompts/user_context.py` (promoted from REF-13's
21-line stub). v1 populates `full_name`/`first_name`/`email` from
the User row. v2 fields (`skills`, `experience_summary`,
`education`, `target_roles`, etc.) default empty and will be
populated when REF-33 ships resume parsing — the prompt's §3 has
explicit conditional rules for thin vs rich user context. Zero
architecture change when REF-33 lands, just data population.

`CONVERSION_PATTERNS` (the per-category reply playbook) lifted
into a new shared module imported by both `REF_SYSTEM_PROMPT`
(initial-draft generation — AI is primed for eventual reply
scenarios) and `FOLLOWUP_GENERATOR_SYSTEM_PROMPT` (REF-32 primary
consumer). Single source of truth (DD-12) — the two prompts
can't drift.

**Not changed.** Frontend rendering, lifecycle cascade,
`ContactReply` schema, REF-31's draft-button vocabulary,
`VALID_USER_ACTIONS`, the chat composer's visibility rules, the
`yes_to_coffee_chat` PostReplyView bridge. REF-31's
`fill_template` + `INTENT_TO_DRAFT_TEMPLATE` are preserved
(serve as fallback). `generate_initial_draft` / `revise_draft`
behavior unchanged (the `build_user_context_block()` shim keeps
the existing call sites at the "Resume not yet provided"
placeholder until REF-33 swaps them).

## Files

| Path | Action | Lines |
|---|---|---|
| `backend/app/prompts/conversion_patterns.py` | new — DD-12 shared playbook for 9 draftable + yes_to_coffee_chat | +140 |
| `backend/app/prompts/followup_generator.py` | new — `FOLLOWUP_GENERATOR_SYSTEM_PROMPT` (~14.5 KB after cycle 3) | +196 |
| `backend/app/prompts/ref_system_prompt.py` | refactor — splice `CONVERSION_PATTERNS` via string concat (PQ-2 (c)) | +40 / −49 |
| `backend/app/prompts/user_context.py` | promote stub → `UserContext` dataclass + `build_user_context()` + `render_user_context_block()` + zero-arg shim | +118 / −19 |
| `backend/app/services/ref_ai.py` | +`_build_contact_summary_for_followup`, +`generate_followup` (raises on failure for caller to handle fallback) | +138 |
| `backend/app/api/v1/ref_chat.py` | +`logger`, +`_initial_outreach_text_for_contact`, post_chat preload extension with try/except, new `followup_ai_result` parameter on `_generate_ref_response`, state-machine branch refactor (prefer AI, fall back to template), `ai_meta` sidecar | +110 / −5 |
| `frontend/src/types/refChat.ts` | +1 line — optional `ai_meta?: Record<string, unknown>` | +1 |
| `docs/modifications/REF-32.md` | new — this file | +260 |
| `docs/ROADMAP.md` | Issue 6g (new sub-issue) → Shipped + Changelog | +12 |

Net code change: **+694 / −49 = +645 net.** Tracks the M-edge-of-L
plan estimate. The prompt files account for ~280 lines of "data
as code"; the actual Python logic is ~+250 net.

## Build iteration history (honest record)

REF-32 shipped in three cycles. The Janini acceptance test —
paste a real multi-part recruiter reply asking about user
background + offering four lanes of help, then verify the AI
engages with the lanes AND honestly defers on the experience
question AND proposes two specific times AND stays under 400
chars AND doesn't feel templated — was the merge gate throughout.

**Cycle 1 — Janini 0/5 pass.**
The AI fabricated specific user skills (Python, Java, REST APIs)
in 4/5 runs despite the prompt's §3 thin-context rule. Root
cause: `_build_contact_summary_for_followup` included the JD
description truncated to 600 chars, and the JD literally
contained "Strong Python, Java, REST APIs." The AI conflated
"role requires" with "user has" when the recruiter asked about
background. The prompt rule was present but the data structure
made the violation almost inevitable.

**Cycle 2 — Janini 3/5 pass.**
Five fixes (Option A+):
1. Stripped `job.description` from `_build_contact_summary_for_followup`
   (kept title/company/role_family/work_mode — categorical only).
2. Added "JD-leak trap" negative-example block to §3 with
   specific WRONG/RIGHT phrasings.
3. Strengthened thin-context rule in §7 hard-rules summary.
4. Added vary-opening guidance to §5.
5. Tightened `send_job_link` + `maybe_later` patterns in
   `CONVERSION_PATTERNS` with explicit placeholder mechanics
   and explicit "DO NOT" anti-patterns.

Hard fabrication (named technologies) eliminated in all 5 runs.
2/5 runs still made softer general claims ("diverse background
in engineering" / "experience in application development").
`soft_no` smoke regressed on a banned-phrase variant ("Wishing
you and your team continued success" — word-injected around the
literal "Wishing you success" ban). `maybe_later` smoke
partially fixed (pinned a `[date]` placeholder but kept the
banned "I'll reach out in a few weeks" preamble).

**Cycle 3 — Janini 5/5 pass.**
Mohamed approved Option J (prompt-only on `gpt-4o-mini`, no
model upgrade) after gpt-4o was confirmed unavailable on the
Azure Foundry endpoint (11 candidate deployment names probed,
all 404; only `gpt-4o-mini` deployed). Three fixes:
1. Expanded §3 with explicit "ALSO WRONG (general experience
   claims with thin context)" block: bans
   "diverse background in", "experience in [role family]",
   "solid foundation in", "I'm eager to discuss how my
   background aligns..." — closes the general-claim gap.
2. Converted literal banned phrases to pattern bans:
   `"Wishing you/your..." closing pattern`,
   `"Hope you/your..." pattern`, `"Best of luck/wishes/..."` —
   blocks word-injection around the literals.
3. Converted §5 vary-opening from soft "Must do" to **HARD
   RULE**: "NEVER start with Hi {first}, thanks for..." with
   five required opening patterns (lane-pick, reaction,
   confirmation, redirect, acceptance) and explicit forbidden
   list.

5/5 Janini runs strictly pass all 5 criteria. All 5 runs opened
with "Easier on a call than over text" — the prescribed reaction
pattern for "asked a question" replies. Zero technology
fabrication. Zero soft general-claims. Zero banned closers. The
prompt-only fix lifted gpt-4o-mini past the gate; the Azure
gpt-4o provision discussion is deferred.

**Cycle progression scorecard:**

| Gate | Cycle 1 | Cycle 2 | Cycle 3 |
|------|---------|---------|---------|
| Janini 5/5 strict | 0/5 | 3/5 | **5/5** |
| send_job_link bug | broken | fixed | clean |
| maybe_later bug | broken | partial | clean |
| im_slammed regression | clean | clean | clean |
| not_right_person regression | clean | clean | clean |
| soft_no regression | clean | regressed (Wishing-you variant) | clean |
| Fallback chain | works | works | works |

The cycle history is preserved here because the lessons —
"don't put role-requirements text where the AI can read it as
user-skills"; "literal phrase bans get word-injected, ban the
pattern"; "soft 'try to vary' instructions don't override
templated training data, you need hard rules" — are the kind of
prompt-iteration knowledge worth keeping for future AI work.

## Test plan

### Programmatic
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean
  (only the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9)
- Python AST parse on all 6 backend files
- Full import smoke: `CONVERSION_PATTERNS` len ~5500, `FOLLOWUP_GENERATOR_SYSTEM_PROMPT`
  len ~15300, `REF_SYSTEM_PROMPT` contains the splice marker,
  `build_user_context_block()` shim still returns None
- Grep verifications: `CONVERSION_PATTERNS` in 3 files, `FOLLOWUP_GENERATOR_SYSTEM_PROMPT`
  in 2 files, `generate_followup` defn + import + call, `UserContext`/`build_user_context`/`render_user_context_block`
  imports clean, `ai_meta` in backend (5+ hits) + frontend type (1
  hit), **zero hits in `RefChatPanel.tsx`** (not rendered)

### Manual gate (cycle 3 — gpt-4o-mini)

- ✅ **JANINI 5/5 strict** — all 5 runs engage 1+ lane, honest
  experience defer, 2 specific times, <400 chars, prescribed
  opener pattern (all used reaction "Easier on a call than over
  text")
- ✅ AI failure fallback — `_call_ai_foundry_with_temp` patched
  to raise; `generate_followup` propagates; caller's try/except
  catches; `followup_ai_result = None`; state machine falls back
  to REF-31's `fill_template`; `ai_meta` absent from the
  resulting draft_card
- ✅ `send_job_link` — uses `[paste job link here]` placeholder
- ✅ `maybe_later` — pins specific date ("Putting Thursday,
  December 7th at 2pm") + cancel-if-not mechanic, no lazy preamble
- ✅ `im_slammed`, `not_right_person`, `soft_no` regressions —
  all clean; `soft_no` produced "All good — appreciate you
  taking a look. If anything opens on the team later, I'll be
  here." with zero banned closers

### Deferred (post-merge)

- Real-user testing across the 9 draftable categories with more
  recruiter-reply samples
- `ai_meta` sidecar offline evaluation queries — query
  `ref_chat_messages` for `kind='draft_card'` rows with `content
  -> 'ai_meta' IS NOT NULL` to build a prompt-quality dataset

## Decisions

(All 12 DDs locked during plan-phase + 3 PQs answered during build
approval.)

- **DD-1** UserContext promotion in-place: `backend/app/prompts/user_context.py`
  promoted from stub (no new file). Existing import path preserved.
- **DD-2** One big `FOLLOWUP_GENERATOR_SYSTEM_PROMPT` with all 9
  category branches visible. Enables cross-pollination; single
  source of truth for prompt iteration.
- **DD-3** Prompt includes `initial_outreach_text` only (no full
  chat history). Surgical, sufficient.
- **DD-4** Log `raw_ai_response` as JSONB sidecar in
  `ref_chat_messages.content.ai_meta`. Zero schema change.
  Queryable. Frontend's `ai_meta?: Record<string, unknown>` keeps
  the type contract open without rendering.
- **DD-5** Temperature 0.7 for `generate_followup` (drafting is
  creative work). Matches `generate_initial_draft`.
- **DD-6** Silent fallback to REF-31 static template on AI
  failure. Server-side `logger.exception`. User never sees
  AI-availability state.
- **DD-7** "Here's the play — copy it, send on LinkedIn, then
  come back." text stays static. Only the draft is AI-generated.
- **DD-8** Log the `play` name in `ai_meta` only; not surfaced
  to user.
- **DD-9** `initial_outreach_text` = `OutreachMessage` where
  `type='initial'`. Skip follow-ups. Handle the legacy
  no-initial case (parameter becomes None; prompt's "(not
  available — write fresh)" branch handles it).
- **DD-10** `gpt-4o-mini`. Acceptance gate is the Janini test;
  if quality insufficient, escalate to gpt-4o with explicit
  approval. After cycle 3 prompt tightening, gpt-4o-mini cleared
  the gate; gpt-4o upgrade not needed.
- **DD-12** Extract `REF_SYSTEM_PROMPT` §6 into shared
  `backend/app/prompts/conversion_patterns.py`. Both prompts
  import + interpolate. Single source of truth for the per-
  category playbook.
- **PQ-1** Rich `CONVERSION_PATTERNS` (~700 tokens) with prose
  explanation per category. The marginal +500 input tokens on
  `generate_initial_draft` / `revise_draft` is acceptable for the
  single-source-of-truth guarantee + cross-pollination benefit
  during initial drafting.
- **PQ-2 (c)** String concatenation for the `REF_SYSTEM_PROMPT`
  splice (`_PREAMBLE + CONVERSION_PATTERNS + _SUFFIX`). Zero
  brace-collision risk. `FOLLOWUP_GENERATOR_SYSTEM_PROMPT` (new
  file) uses f-string with `{{ }}` escaping for the literal JSON
  example.
- **PQ-3** Minimal frontend widening: 1 line added to
  `RefChatDraftContent` in `refChat.ts` (`ai_meta?: Record<string, unknown>`).

## Plug-in points

**For REF-33 (resume parsing + user_profiles table):**
- `build_user_context(user)` signature extends to
  `build_user_context(user, db)` and JOINs a user_profiles row.
  Backward-compatible — every other call site stays the same.
- `UserContext`'s v2 fields (`skills`, `experience_summary`,
  `education`, `job_titles_history`, `target_roles`,
  `target_companies`, `experience_years`, `raw_resume_text`) are
  the schema REF-33 populates.
- `render_user_context_block(ctx)` already branches on
  `ctx.is_thin()` — rich contexts auto-render the new fields,
  thin contexts continue to emit the "Resume not yet provided"
  marker that the prompt's §3 looks for.
- `generate_initial_draft` and `revise_draft` will swap from the
  zero-arg `build_user_context_block()` shim to
  `render_user_context_block(build_user_context(user))` once
  REF-33 ships data worth showing them.

**For REF-34 (AI follow-up bumps for fu1/fu2):**
- The architecture transfers cleanly. `generate_followup`'s
  signature is shaped for it: pass the latest sent
  `OutreachMessage` text instead of the initial; flip
  `intent_category` to a "no-reply bump" sentinel.
- `CONVERSION_PATTERNS` already covers the bump cadence
  conceptually in `REF_SYSTEM_PROMPT` §7 (which lives outside
  the spliced section). REF-34 may want to lift §7 into its own
  shared module the way REF-32 did for §6.

**For future prompt iteration:**
- `ai_meta` sidecar in `ref_chat_messages.content` is the
  offline-evaluation seam. Query the JSONB to build
  (input, output, model, intent, reasoning) tuples for prompt
  quality assessment without a new table.

## Cost impact

`gpt-4o-mini` pricing: $0.15/1M input + $0.60/1M output.

- `generate_followup` per-call (cycle 3 system prompt is ~15.3KB
  / ~3800 tokens; user message ~400 tokens; output ~300 tokens):
  input 4200 × $0.15/1M + output 300 × $0.60/1M ≈ **$0.00081/call**
- `generate_initial_draft` per-call (system prompt now larger by
  ~500 tokens from the `CONVERSION_PATTERNS` splice): ~$0.00088
  (was ~$0.00080)
- `revise_draft` per-call: ~$0.00088 (was ~$0.00080)
- `parse_reply` per-call: unchanged at ~$0.00040

Per-user-per-month at modest scale (5 jobs × 8 contacts × 30%
reply × 1.5 draft clicks/replied = ~18 `generate_followup` calls
+ 8 `generate_initial_draft` + a handful of revises + ~12 parse_reply):
**~$0.024/user/month.** Still trivial.

Cycle 3 prompt growth (12,825 → 15,298 chars on
`FOLLOWUP_GENERATOR_SYSTEM_PROMPT`) added ~$0.00009/call to
generate_followup. Negligible.
