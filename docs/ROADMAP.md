# Contact Outreach Flow Roadmap

> Status as of 2026-05-12. This is a living document — update the
> Status field per issue as tickets ship. Don't rewrite history;
> add to it.

## Context

This roadmap covers the **post-contact-selection chat flow** in the job
room: everything that happens after the user picks contacts and clicks
Confirm, from the connection request all the way to a booked coffee
chat. The 6 issues span the chat-driven UI (`RefChatPanel.tsx`), the
underlying state machine in `backend/app/api/v1/ref_chat.py`, and the
AI integration layer in `backend/app/services/ref_ai.py`.

The roadmap was triggered by an audit on 2026-05-12. The audit mapped
each issue's current code surface (file:line), identified what's
missing for the target state, and estimated complexity. This document
captures those findings and the proposed sequencing so future tickets
can be scoped from a shared starting point.

The roadmap builds directly on three recent shipments. **REF-13**
(PR #3, `c00d832`) created the chat-driven popup foundation for
`not_contacted` and `drafted` states. **REF-17** (`11eb977`, merged
in `4f4ab78`) replaced the stub draft generator with real Azure AI
calls, set up `backend/app/prompts/`, and added the JSON-shaped
`generate_initial_draft` / `revise_draft` services. **REF-20**
(PR #6, `ca69823`) reshaped contact selection to allow 1–9 contacts.
Everything in this roadmap layers on top of that foundation.

## Sequencing (current plan)

- **Sprint 1 — Visible polish, no schema risk**: Issue 3 (XS-S), Issue 2 (XS)
- **Sprint 2 — Connection step rework**: Issue 1 (M)
- **Sprint 3 — Load-bearing migration**: Issue 4 (S), Issue 5 (M)
- **Sprint 4 — Coffee chat closing loop**: Issue 6a+6b (M), Issue 6c (S),
  Issue 6d (M, with 6e folded in as XS)

Note: sequencing can change; this is the starting plan, not a commitment.

## Product decisions

- **PD-1 (Issue 1)**: Do we add a `connected` lifecycle state?
  Adding it means a schema migration + state machine update. Skipping
  it means the post-connection-click flow goes directly to `drafted`.
  - **Resolved 2026-05-13.** Decision: Add a `connected` lifecycle
    state. Rationale: matches the user's mental model of the funnel
    and gives the chat a clean state to render between "request sent"
    and "draft generated"; implementation lands as part of Issue 1's
    ticket (schema migration + state machine update + UI branches).
- **PD-2 (Issue 2)**: What does the renamed "(simulate)" button
  say? It can't actually detect LinkedIn acceptance — the user still
  has to tell us. So: what's the new label? ("She accepted" /
  "Mark as connected" / something else?)
  - **Resolved 2026-05-13.** Decision: Label is `"✅ {first_name}
    accepted"` with the contact's first name interpolated. Rationale:
    matches the personalization pattern being added to Issue 2's
    copy, removes the "(simulate)" demo framing without pretending
    we have automatic detection.
- **PD-3 (Issue 4)**: After clicking "send", how do we confirm
  the message went out? (a) confirmation prompt on tab return,
  (b) immediate optimistic mark-sent, (c) something else. Browser
  focus events are unreliable — pick the UX.
  - **Resolved 2026-05-13.** Decision: Tab-return confirmation prompt
    with ~5s debounce on `visibilitychange` to avoid false triggers
    on quick tab switches. After detection, show "Did you send the
    message? [Yes / Not yet]" — only Yes marks the message as sent.
    Rationale: visibility events alone are too noisy to auto-mark;
    explicit user confirmation keeps the lifecycle truthful.
- **PD-4 (Issue 6c)**: For v1, is "extract proposed time + write
  to `coffee_chat_scheduled_at`" sufficient, or do we need real calendar
  invites (Google Calendar / Calendly / .ics)? The latter is an
  entirely new external integration (zero code exists today).
  - **Resolved 2026-05-13.** Decision: v1 scope is extract proposed
    time + prefill the existing picker + write to
    `coffee_chat_scheduled_at`. No calendar invites. Rationale: ships
    the AI value (parsed time → less typing) without committing to
    OAuth or .ics generation; real calendar invite work is deferred
    to a future ticket outside this roadmap.

## Issues

### Issue 1 — Connection Request Button

**Status**: Shipped
**Ticket**: REF-28
**Estimated complexity**: M
**Dependencies**: none upstream

#### What this issue was

The "I sent the connection request" button was a no-op state advance:
it triggered an AI message about waiting for acceptance but didn't
open LinkedIn and didn't change lifecycle. Target was a deep-link
button that opens the contact's LinkedIn profile and moves lifecycle
to a new `connected` state between `not_contacted` and `drafted`.
Detail in `/docs/modifications/REF-28.md`.

#### Decisions

- PD-1 resolved (see Product decisions section): add `connected`
  lifecycle state.
- PD-2 resolved (see Product decisions section): button label
  `"✅ {first_name} accepted"`.

#### Ticket breakdown

- REF-28 (shipped): "Wire connection-request deep-link + introduce
  `connected` lifecycle state" — one ticket, M (lower end), ~+89
  net code lines + migration `m3n4o5p6q7r8`.

#### Updates

2026-05-13 — REF-28 shipped (commit `eee40ef`, PR #14): new
`connected` lifecycle state between `not_contacted` and `drafted`,
backed by a nullable `contacts.connected_at` column (migration
`m3n4o5p6q7r8`, applied to Azure prod). Click "🔗 Send connection
request" → frontend opens `contact.linkedinUrl` in a new tab AND
server PATCHes `connected_at = now()` via a new `MarkConnected`
side-effect descriptor. `she_accepted` validation widened to accept
both NOT_CONTACTED (legacy) and CONNECTED. Drafted-undo cascades
automatically to `connected` (preserves the LinkedIn click).
DQ-9: `init_chat` NOT_CONTACTED seed now greets the user by first
name for parity with the new CONNECTED seed.

---

### Issue 2 — Connection-Pending Copy

**Status**: Shipped
**Ticket**: REF-25
**Estimated complexity**: XS (copy + name) → S (if simulate button is also being redesigned)
**Dependencies**: Issue 1 (the copy fires after Issue 1's button; simulate-button decision overlaps)

#### What this issue is

The AI message that follows the connection-request action ("Nice.
Connection requests usually take a day or two…"). Target: rewrite the
copy, personalize it with the user's first name, change or remove the
"(simulate)" demo affordance.

#### What the audit found

The copy is hardcoded at `backend/app/api/v1/ref_chat.py:172-178`. The
contact's first name is already interpolated (`first =
(contact.full_name or "there").split(" ")[0]` at `ref_chat.py:160`).
The user's first name is **not** plumbed in: `_generate_ref_response`
receives `contact, user_action, current_state, edits_left_after,
ai_result` but no `user`. The handler at `ref_chat.py:618-624` has
`current_user` in scope and would need to pass it through.

The simulate button is at `ref_chat.py:182` (label
"🎉 They accepted! (simulate)", action `she_accepted`). It exists
because there is no API path to detect real LinkedIn acceptance.

`User.name` is a single full-name field
(`backend/app/db/models/user.py:20`, NOT NULL); the same
`split(" ")[0]` pattern works.

#### Decisions

- PD-2 resolved (see Product decisions section): button label is
  `"✅ {first_name} accepted"`.

#### Ticket breakdown

- REF-25 (shipped): "Rewrite connection-pending copy + plumb user
  first name into ref_chat state machine" — XS, ~+10 net lines.

#### Updates

2026-05-13 — REF-25 shipped (commit `ced866e`, PR #11): post-"I
sent the connection request" copy rewritten to greet the user by
first name and reframe the wait honestly. Button relabeled
"🎉 They accepted! (simulate)" → "✅ {contact_first} accepted".
`_generate_ref_response` gained an optional `user: User` parameter.
Issue 1's PD-1 work will revisit this state when the `connected`
lifecycle state lands.

---

### Issue 3 — Edit/Revision UX

**Status**: Shipped
**Ticket**: REF-21
**Estimated complexity**: XS (cosmetic) → S (if anything semantic changes)
**Dependencies**: none

#### What this issue is

The current draft-message screen has an "Edit" button + a text box,
with a "2 free edits" allowance. Target: redesign so edits happen
inline in the chat (revisions appear as chat messages under the
original draft) with a "Looks fire" confirmation button.

**Important**: the issue's framing in the original ask is misleading.
The target state is mostly already built. The actual work is cosmetic.

#### What the audit found

Revisions **already produce inline chat messages today.** Each text
edit creates a new user bubble (the user's instruction, persisted as a
`text` user message at `ref_chat.py:613-615`) AND a new ref `draft_card`
(the revised draft, persisted via `_persist_ref_messages` at
`ref_chat.py:651-653`). All draft_cards in history are rendered by
`RefChatPanel.tsx:191` mapping over `messages`, hitting the
`draft_card` case at `:263-264`.

The "2 free edits" counter is server-tracked at
`backend/app/services/ref_ai.py` (consumed by `_count_user_text_messages`
in `ref_chat.py:337-343`) with `DRAFT_EDITS_INITIAL = 2` at
`ref_chat.py:38`. The counter renders per-draft-card at
`RefChatPanel.tsx:354-362`. Server rejects further edits at
`ref_chat.py:573-579`.

The "Looks fire 🔥" confirmation button is wired:
`ref_chat.py:217, 238, 489` (`approve_draft` action). The dummy
"📝 Edit" button at the same locations is a **no-op**
(`RefChatPanel.tsx:129-132`).

What's missing is purely visual: (a) the editor textarea
(`RefChatPanel.tsx:202-232`) sits in its own panel below the chat,
which feels separate from a chat composer; (b) the no-op Edit button
deserves either a clear behavior or removal.

#### Decisions needed

None.

#### Ticket breakdown

- REF-21: "Reshape draft editor as inline chat composer; remove no-op
  Edit button" — XS-S. Shipped.

#### Updates

2026-05-12 — REF-21 shipped (commit `a626156`, PR #7): pinned
composer to bottom of chat, edits-left counter relocated to composer
area, "📝 Edit" no-op button removed from state machine + type union,
Enter sends / Shift+Enter newline. Composer hidden in `not_contacted`
and post-approve states. No backend or AI logic changes.

---

### Issue 4 — Send-Message Flow

**Status**: Shipped
**Ticket**: REF-23
**Estimated complexity**: S (button consolidation + simple focus listener) → M (robust confirmation flow)
**Dependencies**: none upstream; Issue 5 layers on top

#### What this issue is

Currently after the user approves a draft, the chat shows 3 separate
buttons: Copy, Open LinkedIn, Mark sent. Target: one button that
(a) deep-links to LinkedIn DM with the contact, (b) copies the
approved draft to clipboard, (c) on user return marks the message as
sent.

#### What the audit found

3-button row emitted by `approve_draft` handler — single helper
`_copy_send_buttons()` (renamed to `_send_message_button` in REF-23)
in `backend/app/api/v1/ref_chat.py`. Frontend client-only handlers
for `copy` / `open_linkedin` + server-bound `mark_sent` chain via
`useUpdateOutreach`. **No LinkedIn messaging deep-link available** —
we have profile URLs, not recipient URNs. **No
`visibilitychange`/focus listener exists** in the codebase yet;
REF-23 establishes the pattern. Detail in `/docs/modifications/REF-23.md`.

#### Decisions

- PD-3 resolved (see Product decisions section): tab-return
  confirmation prompt with ~5s `visibilitychange` debounce; explicit
  user Yes marks sent.

#### Ticket breakdown

- REF-23 (shipped): "Consolidate post-approve buttons into one
  combined send action" — S, ended up ~+144 net code lines.

#### Updates

2026-05-13 — REF-23 shipped (commit `2f4b315`, PR #9): the
3-button post-approve row collapses into one "📨 Send message"
button. Click → copies draft + opens LinkedIn + arms
`visibilitychange` listener (5s debounce, 60s safety timeout) → on
return, shadcn `AlertDialog` confirms ("Did you send the message?").
Yes dispatches `mark_sent`; Not yet / Escape resets. linkedinUrl-null
contacts skip `window.open` and open the dialog immediately with
adjusted copy. Backend helper renamed `_send_message_button`. Legacy
3-button handlers preserved in `handleAction` for backward compat
with pre-REF-23 chat histories.

---

### Issue 5 — Post-Send Navigation

**Status**: Shipped (conservative scope; `replied` deferred — see Updates)
**Ticket**: REF-22
**Estimated complexity**: M
**Dependencies**: none upstream; pre-req for Issues 6a, 6b, 6c, 6d, 6e

**Flag**: this is the choke point for the whole roadmap. Issue 6 has
no path forward without Issue 5 landing first.

#### What this issue is

After sending, the user is currently kicked out of the chat back into
the legacy button-based outreach view. Target: keep the user in chat,
and advance a visible roadmap/progress indicator (step 1 → step 2 →
…) instead.

#### What the audit found

The "kick out" is a conditional in `frontend/src/components/room/ContactPopup.tsx:209-228`:
only `not_contacted` and `drafted` route to `RefChatPanel`. Every
other lifecycle state falls through to `PostReplyView` (if post-reply)
or `MessageDraftView` (otherwise). The popup itself stays open — only
the body content swaps.

The chat router state machine in `backend/app/api/v1/ref_chat.py:144-294`
has zero branches past `drafted`. `init_chat` at
`ref_chat.py:404-507` only seeds for `not_contacted` and `drafted`.

A roadmap indicator already exists: `StateTimeline`
(`frontend/src/components/room/StateTimeline.tsx`) is mounted in the
popup header at `ContactPopup.tsx:194-196`. It advances across 5 steps
(`not_contacted → outreach → replied → meeting → outcome`) defined in
`frontend/src/lib/contactLifecycle.ts:68-83`. May or may not match the
user's mental "step 1 → step 2" roadmap — a chat-tuned variant could
live alongside it.

The real work: extend chat coverage past `drafted` into `sent`,
`followup_1_drafted`, `followup_1_sent`, `followup_2_drafted`,
`followup_2_sent`, `replied`, and eventually `coffee_chat_scheduled`.
Each new state needs (a) a router branch in `_generate_ref_response`,
(b) a seed in `init_chat` for legacy contacts, (c) a conditional
update in `ContactPopup.tsx:209`.

#### Decisions needed

- Scope: which states does the chat cover? Minimum is `sent` +
  `replied` for Issue 6 to function. `followup_*` is needed for Issue
  6d. `coffee_chat_*` is needed for Issue 6c+6e. All are reasonable to
  pack into one ticket; can also be split per-state.

#### Ticket breakdown

- REF-22 (shipped): "Extend RefChatPanel past `drafted` (5 new
  states: `sent` + `followup_1_drafted` + `followup_1_sent` +
  `followup_2_drafted` + `followup_2_sent`)" — M, conservative
  scope band.
- REF-23 (TBD, future): "Bring `replied` + meeting + outcome states
  into chat" — depends on Issue 6c's picker UX decisions.

#### Updates

2026-05-13 — REF-22 shipped (commit `7c10862`, PR #8): chat
covers 5 new lifecycle states (`sent`, `fu1_drafted`, `fu1_sent`,
`fu2_drafted`, `fu2_sent`). Added actions `they_replied`,
`draft_followup_1`, `draft_followup_2`, `undo`. Generalized
side-effect descriptors (`CreateOutreach(type)`, `UpdateCurrentDraft`,
`DeleteCurrentDraft`, `UndoSent`). Per-draft edit budget fix
(counter resets at each new draft). Stale-button toast: server emits
consistent 400 template; frontend parses and surfaces a specific
toast. Dropped `replied` from scope per DQ-1; `replied`+ continue to
route to PostReplyView via the natural conditional swap. No new AI
functions (DD-B held); follow-up drafts use static stub. Issue 6
sub-tickets now unblocked.

---

### Issue 6 — Reply handling + coffee chat (sub-issues 6a–6e)

Issue 6 splits into **3 tickets**:

- **Ticket A** (covers 6a + 6b): Reply capture + AI reply parsing.
  **REF-30 shipped 2026-05-17 (commit `4846277`, PR #16)** — capture
  + classify + generic chat response. Per-category intelligence (Ref
  text variants, per-category placeholder drafts, apply-and-confirm
  flow) carved out to REF-31. Sized L, not M (original estimate was
  M; honest +753 net code lines).
- **Ticket A′ (carve-out from A)** (covers 6f — per-category
  intelligence): **REF-31 shipped 2026-05-18 (commit `c41c412`,
  PR #17)** — per-category Ref text + per-category draft buttons +
  per-category templates filled from `extracted_data`. Chat-only
  drafts (Plan §L decision (L-i)); no `OutreachMessage` row created.
  Sized M (+312 net lines).
- **Ticket A″ (carve-out from A′)** (covers 6g — AI-generated
  reply drafts): **REF-32 shipped 2026-05-18 (commit `21b08e7`,
  PR #18)** — `generate_followup` AI function replaces REF-31's
  static `INTENT_TO_DRAFT_TEMPLATE` lookup. Reads recruiter reply
  text + classification + extracted_data + user/contact/job
  context; writes contextual draft that engages with what was
  said. REF-31 static template preserved as fallback. Foundation-
  ready: new `UserContext` dataclass accepts REF-33 resume
  enrichment without architecture change. Sized M-edge-of-L
  (+645 net lines including 2 new prompt modules). Three prompt-
  iteration cycles required to clear the strict Janini gate on
  gpt-4o-mini.
- **Ticket B** (covers 6c, v1 scope): Extract proposed time + prefill
  coffee chat picker. **S complexity. Deps: Ticket A.** Real calendar
  invite work is deliberately deferred (see PD-4).
- **Ticket C** (covers 6d + 6e): AI follow-up generation (bumps
  for fu1/fu2) + coffee chat prep button. **M complexity. Deps:
  Ticket A.** REF-32 architecture transfers cleanly — see
  `/docs/modifications/REF-32.md` plug-in points.

Per-sub-issue status:

#### 6a — Reply capture in chat — **Shipped (REF-30)**

Composer in `SENT_STATES` accepts a pasted reply via
`POST /ref-chat` with `kind="reply_paste"`. Persists a `ContactReply`
row (new table, migration `n4o5p6q7r8s9` applied to Azure prod) with
reply text + classification metadata. Sets `contact.replied_at`,
cascade transitions to `replied`. `replied` is now in
`CHAT_OWNED_STATES`. Detail in `/docs/modifications/REF-30.md`.

#### 6b — AI reply parsing — **Shipped (REF-30)**

New `parse_reply` AI function in `backend/app/services/ref_ai.py`
classifies into 10 intent categories (per
`/docs/research/coffee_chat_conversion.md §4`) with confidence
levels. New system prompt at
`backend/app/prompts/reply_classifier.py`. Shared taxonomy module
at `backend/app/prompts/intent_taxonomy.py` (DQ-8) is imported by
both `ref_ai.py` and `ref_chat.py`. Temperature 0.2 for
determinism. Try/except fallback returns uncategorized-low on AI
failure; reply text still saved.

#### 6g — AI-generated reply drafts — **Shipped (REF-32)**

Carve-out from REF-31. `generate_followup` in `ref_ai.py`
replaces REF-31's `INTENT_TO_DRAFT_TEMPLATE` lookup; reads
recruiter reply text + classification + extracted_data + user/
contact/job context and writes a draft that engages with what
was actually said. REF-31's static template is the fallback when
the AI call fails or no `ContactReply` exists at preload —
user always gets *something*. New `UserContext` dataclass in
`backend/app/prompts/user_context.py` (promoted from REF-13's
stub) is foundation-ready for REF-33 (resume parsing): v1
populates name/email; v2 fields default empty until REF-33 wires
them up. New `CONVERSION_PATTERNS` module shared by
`REF_SYSTEM_PROMPT` and `FOLLOWUP_GENERATOR_SYSTEM_PROMPT` —
DD-12 single source of truth for the per-category playbook.
`ai_meta` sidecar in `ref_chat_messages.content` logs play +
reasoning + model for offline prompt-quality evaluation (DD-4).
Three prompt-iteration cycles required to clear the strict
Janini gate on gpt-4o-mini — see mod record's "Build iteration
history" section. Detail in `/docs/modifications/REF-32.md`.

#### 6f — Per-category intelligence — **Shipped (REF-31)**

Carve-out from REF-30. `INTENT_TO_REF_TEXT` (10 entries) gives each
classification its own Ref voice; nine intents (everything except
`yes_to_coffee_chat`) gain a `[✏️ Draft <pattern>]` primary button
that fills `INTENT_TO_DRAFT_TEMPLATE[intent]` via `fill_template(...)`
using the latest `ContactReply.extracted_data`. Draft is chat-only —
no `OutreachMessage` row, no lifecycle mutation (Plan §L decision
(L-i): adding an OutreachMessage to a `replied` contact doesn't
transition lifecycle because the cascade short-circuits at
`replied_at`). Both the live reply-capture handler and the legacy
`init_chat` reconstruction handler delegate to a shared helper for
parity. New parameter `extracted_data` on `_generate_ref_response`
(DQ-H: NOT a reuse of `ai_result`). Detail in
`/docs/modifications/REF-31.md`.

#### 6c — Coffee chat scheduling

Existing scheduling is a date+time picker
(`frontend/src/components/room/PostReplyView.tsx:189-237`) writing
ISO to `Contact.coffee_chat_scheduled_at`
(`backend/app/db/models/job.py:85`). **No calendar invite goes out.**
I grepped `backend/`, `worker/`, `frontend/src/` for `calendly`,
`google.calendar`, `gcal`, `nylas`, `scheduling` (excluding
`node_modules` and `__pycache__`) — only `azure-servicebus` internals
matched. **No calendar integration exists.** v1 scope: piggyback on
6b's parser for extracted time, pre-fill the existing picker, save to
the existing column. Real calendar invites are a separate L-sized
build parallel to this roadmap (PD-4 resolved 2026-05-13, see Product
decisions section: v1 = extract + prefill only).

#### 6d — Funnel-to-coffee follow-up

Legacy: `MessageDraftView` "Draft follow-up" button
(`MessageDraftView.tsx:200-208`) creates an empty `OutreachMessage`
with a static stub from `buildStub` (`MessageDraftView.tsx:29-32`).
**No AI.** The Service Bus consumer at
`worker/app/consumers/follow_up_generation.py` is a 14-18-line stub
(CLAUDE.md §9). Pattern to follow: clone `generate_initial_draft` to
make `generate_followup(...)`. Section 7 "Follow-Up Cadence" in
`ref_system_prompt.py:120-130` already specifies Day 0 / 5-7 / 12-14
cadence. Lifecycle states `followup_1_drafted` etc. already exist
(`outreach.py:70-75`); only chat rendering is missing.

#### 6e — Coffee chat prep view

Route `/jobs/:id/contacts/:contactId/coffee-chat-prep` exists
(`frontend/src/App.tsx` ~line 46). Page
`frontend/src/pages/CoffeeChatPrep.tsx:1-47` is a placeholder.
`PostReplyView.tsx:281-289` already links to it when
`status === coffee_chat_scheduled`. Chat equivalent: one button +
one navigate. Filling the prep view with real content is a separate
M-L ticket outside this roadmap.

#### Updates

2026-05-18 — Folded into REF-31: dropped redundant SENT-state
buttons (`[They replied]`, `[Open LinkedIn]`, `[Undo send]`) now
that `parse_reply` makes paste-to-classify the primary reply path.
Composer alone (REF-30) handles capture; only `[📝 Draft follow-up]`
remains in `sent` / `fu1_sent` (none in `fu2_sent`). Per-state Ref
voice rewritten via new `_sent_state_text` helper shared by both
`init_chat` seeds and the post-mark_sent response.

2026-05-18 — REF-32 shipped (Issue 6g, AI-generated reply drafts).
Real AI behind REF-31's per-category draft buttons. Required 3
prompt-iteration cycles to clear strict Janini gate on gpt-4o-mini
(JD-leak in cycle 1; soft general claims + banned-phrase
word-injection in cycle 2; HARD-RULE openers + pattern bans in
cycle 3). Foundation-ready UserContext dataclass for REF-33.
Shared CONVERSION_PATTERNS module via string-concat splice.

---

### Issue 7 — Resume integration (sub-issues 7a backend, 7b frontend)

REF-32's UserContext is foundation-ready but v2 fields default empty
until a resume is uploaded. Issue 7 populates them so AI drafts can
ground claims in real user background instead of falling back to
"happy to walk through specifics on a call".

Splits into 2 tickets:

- **Ticket 7a (backend)**: **REF-33a shipped 2026-05-18 (commit
  `6ffa32f`, PR #19)** — new `user_profiles` table (1:1, CASCADE),
  real `BlobStorageClient` (worker stub replaced + moved to backend),
  `parse_resume` AI function + `RESUME_PARSER_SYSTEM_PROMPT`,
  `POST/GET/PATCH/DELETE /api/v1/profile/resume`, `build_user_context(user, db)`
  JOINs the new table, ALL THREE existing AI functions
  (`generate_initial_draft`, `revise_draft`, `generate_followup`) now
  receive rich context the moment a user uploads. Sized M-L (+710 net
  code lines).
- **Ticket 7b (frontend)**: signup wizard step at `/onboarding/resume`,
  `/settings` page with `Resume & Background` section, parsed-fields
  editor (per-field structured input — DQ-D), dismissible
  ResumeNudgeBanner on dashboard for thin-context users (DQ-E),
  UserMenu dropdown linking to Settings (DQ-H). **Depends on REF-33a
  deploy.** Sized L (~+890 frontend lines).

#### 7a — Backend (resume upload + parsing) — **Shipped (REF-33a)**

Adds `user_profiles` table holding parsed resume data + raw blob
path. UPSERT preserves manually-edited fields across re-upload (the
`overwrote_user_edits` meta flag surfaces which fields were kept).
Hard delete clears blob + row. AI parsing degrades gracefully —
upload always succeeds; empty parse returns 201 with
`parse_failed=true` for the frontend to surface. Detail in
`/docs/modifications/REF-33a.md`.

#### 7b — Frontend (signup wizard + settings page + nudge banner)

Blocked on 7a deploy. See REF-33 recon for design questions already
locked (DQ-A through DQ-L).

#### Updates

2026-05-18 — REF-33a shipped (Issue 7a backend). UserContext v2
fields now populate from `user_profiles` whenever a resume has been
uploaded. REF-32's `generate_followup` and REF-17's
`generate_initial_draft` / `revise_draft` all benefit immediately
on first upload — no further code change required for rich context
to land in AI prompts.

## Cross-cutting notes

- **The "(simulate)" button context.** There is no LinkedIn API access
  for connection-acceptance detection. The user must confirm
  acceptance manually for the foreseeable future. PD-2 is about
  renaming the affordance, not removing the manual confirm.
- **`OutreachMessage` does not model incoming replies.** Currently
  models outbound user messages only
  (`backend/app/db/models/job.py:100-110`). May matter for Issue 6a if
  product wants first-class reply persistence (a `reply_text` column
  or a new `incoming_messages` table). Minimum viable is to keep
  replies in `ref_chat_messages` only.
- **The REF-17 system prompt already covers Issue 6 conceptually.**
  Section 6 "Meeting-Funnel Moves" and Section 7 "Follow-Up Cadence"
  in `backend/app/prompts/ref_system_prompt.py` describe the desired
  behavior. New work for Issues 6b and 6d is adding the AI **functions**
  that call this prompt with appropriate JSON schemas — not authoring
  new prompt content.
- **The follow-up worker stub isn't wired.**
  `worker/app/consumers/follow_up_generation.py` is a 14-18-line stub
  per CLAUDE.md §9. Issue 6d goes through the **sync** `ref_ai.py`
  path (same as REF-17's initial draft), not the worker. The stub
  remains orphaned after Issue 6d ships unless someone deliberately
  rewires the worker for batch follow-ups (not in scope).

## Changelog

2026-05-12 — Roadmap created.
2026-05-12 — REF-21 shipped (Issue 3): pinned chat composer, removed
no-op Edit button, relocated edits counter to composer.
2026-05-13 — PD-1, PD-2, PD-3, PD-4 resolved. See Product decisions
section for outcomes.
2026-05-13 — REF-22 shipped (Issue 5, conservative scope): chat
extended to cover 5 new lifecycle states past `drafted`. Unblocks
Issue 6.
2026-05-13 — REF-23 shipped (Issue 4): post-approve 3-button row
collapsed into a single "📨 Send message" with visibility-tracked
confirmation dialog.
2026-05-13 — REF-25 shipped (Issue 2): connection-pending copy
greets the user by first name; simulate button relabeled.
2026-05-13 — REF-28 shipped (Issue 1): new `connected` lifecycle
state + connection-request deep link. Schema migration applied to
Azure prod. REF-25 supersession noted in its mod record.
2026-05-17 — REF-30 shipped (Issue 6a + 6b, commit `4846277`, PR #16):
chat-native reply capture in SENT_STATES + parse_reply AI
classification into 10 intent categories. New `contact_replies` table
(migration `n4o5p6q7r8s9` applied to Azure prod). `replied` joined
CHAT_OWNED_STATES; PostReplyView gained controllable
`mode`/`onModeChange` props for the chat → scheduling bridge.
Per-category intelligence + per-category placeholder drafts +
apply-and-confirm flow carved out to REF-31. Sized L (not M as
originally estimated; +753 net code lines).
2026-05-18 — REF-31 shipped (Issue 6f, commit `c41c412`, PR #17):
per-category Ref text (`INTENT_TO_REF_TEXT`, 10 entries) + nine
per-category `[✏️ Draft …]` buttons emitting templates filled from
`ContactReply.extracted_data`. Chat-only drafts (Plan §L decision
(L-i)) — no `OutreachMessage` row created, no lifecycle mutation.
New `extracted_data` parameter on `_generate_ref_response` (DQ-H:
distinct from `ai_result`). Shared helper
`_replied_state_response_for_category` guarantees parity between
live capture and `init_chat` legacy reconstruction. Sized M (+312
net code lines). Closes Ticket A′ carve-out.
2026-05-18 — REF-32 shipped (Issue 6g, commit `21b08e7`, PR #18):
`generate_followup` AI function replaces REF-31's static
`INTENT_TO_DRAFT_TEMPLATE` lookup with real per-category AI
generation grounded in recruiter reply + classification +
extracted_data + user/contact/job context. REF-31 static template
preserved as fallback (DD-6 silent fallback chain). New
`UserContext` dataclass (foundation-ready for REF-33 resume
parsing — v1 thin, v2 fields default empty). New shared
`CONVERSION_PATTERNS` module spliced into both
`REF_SYSTEM_PROMPT` (via string concat — PQ-2 (c)) and
`FOLLOWUP_GENERATOR_SYSTEM_PROMPT` (via f-string). `ai_meta`
JSONB sidecar in `ref_chat_messages.content` (DD-4 — frontend
type accepts as `Record<string, unknown>`, never rendered).
Sized M-edge-of-L (+645 net code lines). Three prompt-iteration
cycles required to clear strict Janini gate on gpt-4o-mini —
honest cycle history preserved in mod record. Zero schema
changes. Closes Ticket A″ carve-out.
2026-05-18 — REF-33a shipped (Issue 7a backend, commit
`6ffa32f`, PR #19): new `user_profiles` table (migration
`o5p6q7r8s9t0` applied to Azure prod, push-first per CLAUDE.md
§5), real `BlobStorageClient` via `BlobServiceClient.from_connection_string`
(replaces the NotImplementedError stub; moved from worker to
backend with re-export shim), `parse_resume` AI function + new
`RESUME_PARSER_SYSTEM_PROMPT` (temp 0.2, defensive empty-dict
fallback mirroring REF-30 `parse_reply`),
`POST/GET/PATCH/DELETE /api/v1/profile/resume` endpoints with
manual-edit preservation across re-upload (DQ-K). All three
existing AI functions (`generate_initial_draft`, `revise_draft`,
`generate_followup`) threaded with `db` so rich UserContext flows
through immediately on resume upload. Sized M-L (+710 net code
lines). REF-33b frontend follows.
