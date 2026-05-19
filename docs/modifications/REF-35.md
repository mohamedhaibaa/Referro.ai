# REF-35 — Rich-context prompt tuning (shipped with documented limitations)

**Branch:** `feat/REF-35-rich-context-tuning`
**Status:** ready for review
**Merged:** commit `<merge-sha>`, PR #N
**Size:** **S/M** (~+193 net code lines; pure prompt edits + 1-line render
cap raise; zero schema or infrastructure changes)
**Decision:** ship Path (b) — cycle 2 wins land, four un-fixed failure
modes documented honestly with gpt-4o upgrade as the architectural fix
when real users hit them.

## Scope

Prompt tuning for the rich-context branch of `generate_followup`, plus
signal-preservation tightening in `parse_resume`, plus a 1-line raise
to `render_user_context_block`'s skills cap. REF-32 + REF-33
architecture untouched. Both AI functions stay on gpt-4o-mini.

**Changed.** `parse_resume`'s `experience_summary` instructions now
require verbatim preservation of distinctive employers / sectors /
institutions (with concrete Good/Bad examples derived from Mohamed's
real resume). `generate_followup`'s §3 rich-context branch expanded
from 12 lines to ~95 (three MUST rules, RIGHT/WRONG example pairs,
tone-matching block with emoji-mirror example, explicit strict
branch-gate preamble). §5 opener block extended with two new
permitted shapes (casual-reactive, acknowledge-and-engage) and a
"vary across runs" guidance line. §7 hard-rules summary grew with
three new elevated rules (name target company, vary openers, body
variation). `render_user_context_block` skills cap raised 10 → 20.

**Not changed.** REF-31 fallback chain. AI failure handling.
Conversion patterns (per-category nuance lines). Backend
infrastructure. Any frontend.

## Files

| Path | Action | Lines |
|---|---|---|
| `backend/app/prompts/resume_parser.py` | Expand `experience_summary` block with signal-preservation rules + new Mohamed-shaped Good + new flatten-failure Bad | +50 / −12 |
| `backend/app/prompts/followup_generator.py` | §3 branch-gate preamble + rich-context expansion + tone-matching block; §5 + 2 opener patterns (casual-reactive, acknowledge-and-engage); §7 + 3 elevated rules (target-company, vary openers, body variation) | +156 / −7 |
| `backend/app/prompts/user_context.py` | `skills[:10]` → `skills[:20]` | +5 / −1 |
| `docs/modifications/REF-35.md` | new | +330 |
| `docs/ROADMAP.md` | Issue 6h section + Updates + Changelog | +35 |
| **Total** | | **+576 / −20 = ~+556 net** |

**Code-only excluding docs:** ~+193 net. Solidly **S/M**.

## Decisions (DQ-A through DQ-H, locked at plan-phase)

- **DQ-A** Preserve distinctive signals in `experience_summary` (no new
  schema field). Single source of truth, no migration.
- **DQ-B** Tone-matching aggressive — at most one emoji, only when
  matching theirs. End-of-sentence position, not opener.
- **DQ-C** Keep JD stripped from `_build_contact_summary_for_followup`
  (company name + role family only — REF-32 fabrication-fix preserved).
- **DQ-D** Re-parse Mohamed's resume manually for testing only. No
  background re-parse job for other users (future ticket).
- **DQ-E** Skip `signals_used` in `ai_meta` for cycle 1. The
  `reasoning` field on REF-32's `ai_meta` is sufficient.
- **DQ-F** Raise skills cap from `[:10]` to `[:20]`. Mohamed's
  "capital markets" sits at position 18; was being cut.
- **DQ-G** Skip per-category rich-context variants in
  `conversion_patterns.py`. §3 guidance is enough.
- **DQ-H** Add ONE new casual opener pattern for cycle 1. Cycle 2
  added a second (acknowledge-and-engage); both stayed.

## Build iteration history

REF-35 ran two cycles. The strict acceptance gate (6/6 base criteria
on all 5 runs of both tests + opener diversity ≥2 on both tests) did
not pass on either cycle. Path (b) ship-with-documented-limitations
chosen over a third autonomous cycle.

### Cycle 1 — surfaced 4 distinct failure modes

Test A (Janini, professional-friendly) + Test B (casual with emoji),
5 runs each, plus thin-context regression check.

| Failure | Test | Cycle 1 result |
|---|---|---|
| Diversity locks (5/5 same opener) | A | All 5 runs opened with "Great question(s)!" |
| Target company naming inconsistent | A | C1 = 2/5 (only runs 4, 5 named "Capgemini") |
| Tone-match misses emoji | B | C4 strict = 0/5 (4 casual openers, 0 emoji) |
| Thin-context cross-contamination | regression | Run 2 used "background in application development" — the exact pattern REF-32 cycle 2 banned (see prompt §3 ALSO-WRONG list) |

Wins from cycle 1 that landed cleanly: parser preserved Al Ramz +
CRA + Michelin + Abu Dhabi Securities Exchange in `experience_summary`
(BEFORE: "various sectors including financial services and government");
all 5 Test A drafts named at least one specific past employer
(C2 = 5/5); all 5 drafts passed C6 no-fabrication.

### Cycle 2 — 5 surgical levers attempted

| Lever | Target | Cycle 2 effect |
|---|---|---|
| 1: 7th opener pattern + diversity rule | Test A diversity ≥2 | **FAIL** — model adopted the body pattern ("Most directly:" / "Most relevant:" follow-on, exactly as Lever 1 prescribed) but locked the opener to "Great question(s)!" on all 5 runs |
| 2: §7 hard rule "name target company" elevation | Test A C1 → 5/5 | **FAIL** — still 2/5, identical to cycle 1 |
| 3: emoji in RIGHT-matched-casual example | Test B C4 emoji ≥3/5 | **PARTIAL** — Run 5 used "😊" (was 0/5 in cycle 1); 4/5 used casual opener but no emoji mirror |
| 4: §3 strict branch-gate preamble | Thin regression 0% leak | **FAIL** — still ~33% leak rate (Run 2 of 3 contained "background in application development") |
| 5: §7 body variation rule | Body structure varies across runs | **FAIL** — all 5 Test A drafts share opener-employer-pivot-times shape; all 5 Test B drafts share "Haha-pulled me toward Capgemini-Al Ramz-call-times" shape |

NEW regression introduced in cycle 2 (not present in cycle 1): runs 3
and 4 of Test A exceeded the 400-char limit (401 chars, 408 chars).
The rich-context drafts that try to fit more signals (employer +
sector + role + question + 2 times) naturally lengthen. C5 base_rules
moved from 5/5 (cycle 1) to 3/5 (cycle 2) on Test A.

### Pattern observation

The model behavior across REF-32 cycles 1-3 and REF-35 cycles 1-2 is
consistent: **gpt-4o-mini honors positive content rules but ignores
negative style rules in long prompts.**

Worked across both tickets:
- "Don't fabricate skills with thin context" (after explicit examples)
- "Name specific past employers when rich context exists"
- "Reference distinctive sector signals from Summary"
- "Use the prescribed opener patterns" (when prompt lists them)
- "Don't use banned phrases" (after pattern-bans not just literals)

Did NOT work, across multiple iterations:
- "Vary X across runs"
- "Don't lock onto a single pattern"
- "Strict branch gate — do not blend"
- Soft branch isolation when both branches exist in the same prompt
- Hard char limits when content-stacking instructions push longer

This is gpt-4o-mini's soft ceiling on negative style/diversity
constraints in long prompts. Prompt engineering past this point is
fighting the model's nature. The fix is the model upgrade (see
"Path forward").

## What this commit ships

The wins are real and substantial even though the strict gate didn't
pass:

| Win | Evidence |
|---|---|
| Parser preserves distinctive signals | BEFORE: *"various sectors including financial services and government"* → AFTER: *"financial services at Al Ramz Corporation on the Abu Dhabi Securities Exchange, federal government at Canada Revenue Agency, and manufacturing at Michelin Canada"* |
| `skills[:20]` cap | "capital markets" (position 18 in Mohamed's skills) now reaches the AI prompt |
| Rich-context drafts name employers | Test A C2 = 5/5; Test B C2 = 4/5. Mohamed's actual co-op employers (Al Ramz, CRA, Michelin) appear by name in nearly every rich draft |
| Rich-context drafts cite sector signals | Test A C3 = 4/5; Test B C3 = 4/5. Drafts reference "capital markets middleware", "internal IT at CRA", etc. — the distinctive signals that actually earn replies |
| Casual register attempt | Test B 4/5 casual openers ("Haha, honestly…"), 1/5 with emoji landed (was 0/5 in cycle 1) |
| No fabrication | Test A + Test B C6 = 5/5; thin-context still produces honest-defer drafts in 2/3 runs (the cross-contamination tax is the 33% miss) |
| AI failure fallback | REF-31 static template still kicks in on `generate_followup` exception. REF-32 contract preserved. |

The rich-context drafts are markedly more grounded than the thin-context
baseline. The strict acceptance gate was designed to catch every edge,
not every-or-nothing quality.

## Acceptance test results (cycle 2 — final)

### Test A — Janini (professional-friendly), 5 runs

| Run | C1 names co. | C2 names employer | C3 sector signal | C4 tone | C5 base | C6 no fab |
|---|---|---|---|---|---|---|
| 1 | ❌ | ✅ CRA + Al Ramz | ✅ capital markets + internal IT | ✅ | ✅ (349 chars) | ✅ |
| 2 | ❌ | ✅ Al Ramz + Michelin | ✅ capital markets | ✅ | ✅ (400 chars — at the limit) | ✅ |
| 3 | ❌ | ✅ Michelin + Al Ramz | ❌ (employers but no sector word) | ✅ | ❌ (401 chars — over) | ✅ |
| 4 | ✅ Capgemini | ✅ Michelin + CRA + Al Ramz | ✅ capital markets | ✅ | ❌ (408 chars — over) | ✅ |
| 5 | ✅ Capgemini | ✅ CRA + Al Ramz | ✅ capital markets | ✅ | ✅ (363 chars) | ✅ |

Per-criterion across 5: C1 = 2/5 | C2 = 5/5 ✅ | C3 = 4/5 | C4 = 5/5 ✅ |
C5 = 3/5 (length drift) | C6 = 5/5 ✅. Opener diversity: 1 pattern.

#### Test A verbatim drafts

> **Run 1:** Great questions, Janani! Most directly relevant: I have co-op experience at CRA focused on internal IT and business analysis, and at Al Ramz on capital markets middleware. I'm hoping for insights into the Application Developer role and any interview advice you can share. Easier to discuss on a quick call — how does Tue 4pm or Thu 2pm work for you?

> **Run 2:** Great questions! Most relevant: I have co-op experience at Al Ramz Corporation where I focused on middleware and capital markets, and I also worked at Michelin Canada on system performance analysis. I'm hoping to gain insights into the Application Developer role and discuss how my background aligns with the team's needs. Easier to share more on a quick call — would Tue 4pm or Thu 2pm work for you?

> **Run 3:** Great questions! Most relevant: I have co-op experience as an IS Analyst at Michelin Canada, focusing on technical documentation and business analysis, and I also worked on middleware at Al Ramz Corporation. I'm hoping for insights into the Application Developer role and guidance on how I can align my skills with the team's needs. Easier to discuss on a call — would Tue 4pm or Thu 2pm work for you?

> **Run 4:** Great questions! Most relevant: my co-op at Al Ramz involved developing middleware solutions for capital markets, and I've also worked on API design and business analysis at CRA and Michelin. I'm hoping to gain insights into the Application Developer role at Capgemini and any guidance on aligning my skills with your team's needs. Easiest to discuss this on a quick call — how does Tue 4pm or Thu 2pm sound?

> **Run 5:** Great questions, Janani! Most relevant: my co-op at Al Ramz involved middleware solutions for capital markets, and I also gained experience in SQL and API design at CRA. I'm looking for insights into the Application Developer role and guidance on aligning my skills with what Capgemini needs. Easier to discuss on a quick call — how does Tue 4pm or Thu 2pm sound?

### Test B — Casual with emoji, 5 runs

| Run | C1 names co. | C2 names employer | C3 sector signal | C4 tone | C5 base | C6 no fab |
|---|---|---|---|---|---|---|
| 1 | ✅ Capgemini | ✅ Al Ramz | ✅ capital markets | ⚠ casual opener, no emoji | ✅ (295 chars) | ✅ |
| 2 | ✅ Capgemini | ❌ | ❌ | ⚠ casual opener, no emoji | ✅ (290 chars) | ✅ |
| 3 | ✅ Capgemini | ✅ Al Ramz | ✅ Abu Dhabi Sec. Exch. | ⚠ casual opener, no emoji | ✅ (305 chars) | ✅ |
| 4 | ✅ Capgemini | ✅ Al Ramz | ✅ capital markets | ⚠ casual opener, no emoji | ✅ (265 chars) | ✅ |
| 5 | ✅ Capgemini | ✅ Al Ramz | ✅ Abu Dhabi Sec. Exch. | ✅ "😊" landed | ✅ (350 chars) | ✅ |

Per-criterion across 5: C1 = 5/5 ✅ | C2 = 4/5 | C3 = 4/5 | C4 = 5/5
generous / 1/5 strict-emoji | C5 = 5/5 ✅ | C6 = 5/5 ✅. Opener diversity: 1 pattern.

#### Test B verbatim drafts

> **Run 1:** Haha, honestly, what pulled me toward Capgemini is the scale of systems integration and innovation in the Application Developer role. My experience at Al Ramz on capital markets middleware really sparked my interest. Would love to discuss this further! How's Tue 4pm or Thu 2pm for a quick chat?

> **Run 2:** Haha, honestly, what pulled me toward Capgemini is the chance to leverage my co-op experience in financial services and government IT. I'm eager to discuss how my background aligns with the Application Developer role. Easier on a call than over text — would Tue 4pm or Thu 2pm work for you?

> **Run 3:** Haha, great question! What pulled me in was my experience at Al Ramz Corporation working with middleware on the Abu Dhabi Securities Exchange — it sparked my interest in how Capgemini integrates technology on a larger scale. Eager to discuss more! Would 15 min on Tue 4pm or Thu 2pm work for a quick chat?

> **Run 4:** Haha honestly, what pulled me toward Capgemini specifically is the scale of projects in systems integration and the opportunity to apply my co-op experience from Al Ramz on capital markets. Easier to share details on a quick call. How does Tue 4pm or Thu 2pm sound?

> **Run 5:** Haha, honestly, what pulled me toward Capgemini specifically is the opportunity to work on innovative projects in a collaborative environment. I believe my co-op experience at Al Ramz on the Abu Dhabi Securities Exchange aligns well with the Application Developer role. Happy to discuss more on a quick call — would Tue 4pm or Thu 2pm work for you? 😊

### Thin-context regression — 3 runs

> **Run 1 (clean):** Great question, Janani! Happy to walk through specifics on a call to discuss my experience related to the Application Developer role. Would Tue 4pm or Thu 2pm work for you?

> **Run 2 (LEAKED):** Great question — I'm eager to discuss **my background in application development**. Happy to walk through specifics on a quick call. Would you be available Tue 4pm or Thu 2pm?

> **Run 3 (clean):** Great question — easier to share specifics on a call. I'd love to discuss my background and how it aligns with the Application Developer role at Capgemini. How does Tue 4pm or Thu 2pm sound for a quick chat?

Run 2 contains the exact "background in [role family]" pattern REF-32
cycle 2 banned. Cycle 2 Lever 4 (strict branch-gate preamble) did not
prevent it. ~33% leak rate persists.

## Known limitations on gpt-4o-mini

Four un-fixed failure modes ship with this commit. Each has a known
diagnosis and a documented fix (the model upgrade).

### 1. Opener diversity locks
**Failure rate:** 100% on both tests (1 distinct opener / 5 runs).
**Symptom:** Test A all 5 runs open "Great question(s)!"; Test B all 5
open "Haha, honestly/great question…".
**Diagnosis:** gpt-4o-mini does not honor "vary across runs" or "don't
lock onto a single pattern" instructions. Each invocation is
independent from the model's perspective; cross-run guidance has no
mechanism to bind.

### 2. Target-company naming inconsistency (Test A only)
**Failure rate:** 3/5 Test A. Test B is 5/5 because the casual reply
explicitly asks "what pulled you toward us?" which forces the answer
to name the company.
**Symptom:** "the Application Developer role" without "at Capgemini".
**Diagnosis:** Even with §7 elevation, soft requirements ("name X at
least once") lose to other content instructions when the prompt is
long (~22K chars in REF-35). The model prioritizes content density
over per-rule compliance.

### 3. Thin-context cross-contamination
**Failure rate:** ~33% of thin-context runs (1/3 in cycle 2 testing).
**Symptom:** Drafts use "background in application development" or
similar role-family fabrications even when the user_context block
shows "Resume not yet provided — keep claims general."
**Diagnosis:** Explicit strict branch-gate text ("Which branch applies
— strict gate: …") does not fully isolate attention between
rich-context and thin-context examples in the same long prompt. The
positive RIGHT examples in the rich-context branch attract
attention even when the gate prefix says THIN applies.

### 4. Character-limit drift
**Failure rate:** 2/5 Test A (401 chars, 408 chars).
**Symptom:** Rich drafts that try to stack multiple signals
(employer + sector + role + question + 2 times) push over the 400
limit by 1-8 chars.
**Diagnosis:** Positive-instruction stacking ("name target company
AND specific employer AND sector signal") overrides hard char
limits when the content is rich. This is a NEW regression introduced
in cycle 2 — cycle 1 drafts were all ≤385 chars because they had
less content packed in.

## Path forward — when these matter

**The architectural fix is gpt-4o upgrade.** Evidence across REF-32
cycles 1-3 and REF-35 cycles 1-2 is consistent: gpt-4o-mini follows
positive content rules well, ignores negative style rules in long
prompts. The five cycle-2 levers that did not measurably help on
gpt-4o-mini are kept in the prompt intentionally — they may be
load-bearing on gpt-4o, and the upgrade should be a config-level
swap, not a re-tuning project.

### When to trigger the upgrade

- Users report drafts feeling repetitive in real outreach campaigns
  (the diversity-locks failure mode becomes user-visible)
- Quality bar shifts from "draft is sendable" to "draft is
  consistently varied across many sends"
- Cost-per-user-per-month at then-current scale becomes worth the
  ~10× increase ($0.01 → $0.10 at modest scale; trivial absolute)

### Provisioning steps (captured for the next session)

1. Azure Portal → AI Foundry resource (`ai-amoatyy8952ai207106741729`)
2. Deploy new model → `gpt-4o` or `gpt-4o-2024-08-06`
3. Update `ref_ai.py` `DEPLOYMENT` constant to the new deployment name
4. Re-run REF-35 cycle 2 acceptance gate (test scripts in
   `/tmp/ref35_smoke.py` and the thin-regression snippet are
   reusable — just re-execute)
5. Document results in a follow-up REF-XX ticket; mark this ticket's
   known limitations as resolved by reference

## Plug-in points for future tickets

- **REF-34 (UX restructure)**: consumes the same `generate_followup`
  outputs, no rework. Rich-context wins immediately benefit the
  restructured surfaces.
- **REF-36+ (chat-native scheduling)**: orthogonal — no overlap with
  prompt content.
- **Background re-parse job for existing users**: future ticket. Would
  call `parse_resume(p.raw_resume_text)` for every `user_profiles`
  row whose `experience_summary` predates this commit, replacing flat
  summaries with signal-preserved ones. Only Mohamed's resume has
  been re-parsed manually during build testing. Other users will get
  the better summary on next re-upload via the Resume page (REF-33b),
  OR via the background job when it ships.
- **gpt-4o upgrade**: this ticket's "Known limitations" are explicitly
  the gate criteria for triggering the upgrade. When a user reports
  any of the four failure modes affecting real outreach quality,
  spin the upgrade ticket immediately.

## Privacy

Mohamed's resume re-parsed during cycle 1 build testing. The
`experience_summary` field is now the signal-preserved version
(replacing the cycle-0 flattened version). Other PII unchanged. No
new data categories collected. The re-parsed summary is more
specific (names "Al Ramz Corporation on the Abu Dhabi Securities
Exchange" and similar) but every signal is verbatim from the
already-stored `raw_resume_text` — no new information.
