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

## Open product decisions

- **PD-1 (blocks Issue 1)**: Do we add a `connected` lifecycle state?
  Adding it means a schema migration + state machine update. Skipping
  it means the post-connection-click flow goes directly to `drafted`.
- **PD-2 (blocks Issue 2)**: What does the renamed "(simulate)" button
  say? It can't actually detect LinkedIn acceptance — the user still
  has to tell us. So: what's the new label? ("She accepted" /
  "Mark as connected" / something else?)
- **PD-3 (blocks Issue 4)**: After clicking "send", how do we confirm
  the message went out? (a) confirmation prompt on tab return,
  (b) immediate optimistic mark-sent, (c) something else. Browser
  focus events are unreliable — pick the UX.
- **PD-4 (blocks Issue 6c)**: For v1, is "extract proposed time + write
  to `coffee_chat_scheduled_at`" sufficient, or do we need real calendar
  invites (Google Calendar / Calendly / .ics)? The latter is an
  entirely new external integration (zero code exists today).

## Issues

### Issue 1 — Connection Request Button

**Status**: Not started
**Ticket**: (none yet)
**Estimated complexity**: M
**Dependencies**: none upstream; blocks Issue 2 (copy & simulate decisions intertwine)

#### What this issue is

After contact selection, the chat surfaces an "I sent the connection
request ✅" button. Target: turn it into a deep-link "Click to connect
with `<name>` on LinkedIn" that opens LinkedIn, and on user return
moves lifecycle to "connected."

#### What the audit found

The button is seeded by `init_chat` at `backend/app/api/v1/ref_chat.py:451-459`
(action `sent_connection_request`, primary). Clicking it triggers
`POST /ref-chat` → state machine at `ref_chat.py:167-185` returns the
"Nice. Connection requests usually take a day or two…" copy plus the
simulate button. **No URL is opened.** A separate "Open LinkedIn" icon
exists in the popup header (`ContactPopup.tsx:175-185`), and the
chat's `open_linkedin` action handler at `RefChatPanel.tsx:123-128` is
implemented — but it's only surfaced AFTER draft approval, not on the
connection step.

The lifecycle (`backend/app/api/v1/outreach.py:44-77`) has no
`connected` state. It goes `not_contacted → drafted → sent → …`. The
`sent_connection_request` action does not advance lifecycle today.

LinkedIn has **no public deep link for sending a connection request.**
The closest is opening the profile URL (`contact.linkedin_url`) and
the user clicks Connect manually. Anything more elaborate (URN
scraping, bookmarklets) is out of scope.

#### Decisions needed

- **PD-1** (new `connected` lifecycle state)
- **PD-2** (button copy / simulate replacement — overlaps with Issue 2)

#### Ticket breakdown

- REF-XX (TBD): "Wire connection-request deep-link + introduce
  `connected` lifecycle state" — one ticket, M complexity. Includes
  schema migration if PD-1 resolves "yes."

#### Updates

(Empty — append as tickets ship.)

---

### Issue 2 — Connection-Pending Copy

**Status**: Not started
**Ticket**: (none yet)
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

#### Decisions needed

- **PD-2** (new label for the simulate button)

#### Ticket breakdown

- REF-XX (TBD): "Rewrite connection-pending copy + plumb user first
  name into ref_chat state machine" — XS-S. May be folded into Issue 1
  if shipped together.

#### Updates

(Empty.)

---

### Issue 3 — Edit/Revision UX

**Status**: Not started
**Ticket**: (none yet)
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

- REF-XX (TBD): "Reshape draft editor as inline chat composer; remove
  no-op Edit button" — XS-S.

#### Updates

(Empty.)

---

### Issue 4 — Send-Message Flow

**Status**: Not started
**Ticket**: (none yet)
**Estimated complexity**: S (button consolidation + simple focus listener) → M (robust confirmation flow)
**Dependencies**: none upstream; Issue 5 layers on top

#### What this issue is

Currently after the user approves a draft, the chat shows 3 separate
buttons: Copy, Open LinkedIn, Mark sent. Target: one button that
(a) deep-links to LinkedIn DM with the contact, (b) copies the
approved draft to clipboard, (c) on user return marks the message as
sent.

#### What the audit found

The 3 buttons come from the state machine after `approve_draft` at
`backend/app/api/v1/ref_chat.py:258-277`:

```
📋 Copy message     → action kind "copy"          (client-only)
🔗 Open LinkedIn    → action kind "open_linkedin" (client-only)
✅ Mark sent        → action kind "mark_sent"     (server-bound)
```

Copy uses `navigator.clipboard.writeText`; Open LinkedIn uses
`window.open(contact.linkedinUrl, "_blank")` — both at
`RefChatPanel.tsx:110-128`. Mark sent chains
`useSendRefChat → useUpdateOutreach` at `RefChatPanel.tsx:140-164`.

**LinkedIn messaging deep links require the recipient URN/conversation
thread ID**, which we don't store. `contact.linkedin_url` is the
public profile slug (e.g. `linkedin.com/in/sarah-chen-123`). Realistic
v1: open the profile and the user clicks "Message."

**"On user return marks sent"** is the fragile piece. No
`visibilitychange` / focus listener exists today. Browsers fire
`visibilitychange` for any tab switch, not specifically for "returned
from LinkedIn." Likely needs a confirmation prompt regardless of
auto-detection.

#### Decisions needed

- **PD-3** (confirmation flow on tab return vs. immediate optimistic
  mark-sent)

#### Ticket breakdown

- REF-XX (TBD): "Consolidate post-approve buttons into one combined
  send action" — S. Pure backend state-machine + frontend handler
  change.

#### Updates

(Empty.)

---

### Issue 5 — Post-Send Navigation

**Status**: Not started
**Ticket**: (none yet)
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

- REF-XX (TBD): "Extend RefChatPanel to render past drafted (sent,
  followup_*, replied, coffee_chat_scheduled)" — M. Could split per
  state if scope balloons; current expectation is one ticket.

#### Updates

(Empty.)

---

### Issue 6 — Reply handling + coffee chat (sub-issues 6a–6e)

Issue 6 splits into **3 tickets**:

- **Ticket A** (covers 6a + 6b): Reply capture + AI reply parsing.
  **M complexity. Deps: Issue 5.**
- **Ticket B** (covers 6c, v1 scope): Extract proposed time + prefill
  coffee chat picker. **S complexity. Deps: Issue 5, Ticket A.**
  Real calendar invite work is deliberately deferred (see PD-4).
- **Ticket C** (covers 6d + 6e): AI follow-up generation + coffee
  chat prep button. **M complexity. Deps: Issue 5, Ticket A.**

Per-sub-issue audit findings:

#### 6a — Reply capture in chat

After mark-sent, today's reply affordance is the legacy
`MessageDraftView` "They replied" button
(`frontend/src/components/room/MessageDraftView.tsx:192-198`) which
PATCHes `replied_at = now()` via `setContactRepliedAt`
(`ContactPopup.tsx:31-41`). **The reply text is never captured or
stored.** `OutreachMessage` (`backend/app/db/models/job.py:100-110`)
models only outbound messages. Minimum viable approach: repurpose
the existing text-edit branch at `backend/app/api/v1/ref_chat.py:226-256`;
capture reply text in `ref_chat_messages` only; defer schema changes.
Decision needed: persist replies first-class (new column / table) or
keep as chat-history audit trail.

#### 6b — AI reply parsing

**Nothing exists.** `backend/app/services/ref_ai.py` has only
`generate_initial_draft` (`:65-97`) and `revise_draft` (`:99-136`).
The system prompt already covers the work conceptually — Section 6
"Meeting-Funnel Moves" in
`backend/app/prompts/ref_system_prompt.py:97-117` specifies pivots per
reply pattern. `build_ref_context`
(`backend/app/prompts/ref_context.py:96-196`) already structures
per-call context. Missing: a `parse_reply` AI function + JSON schema
(intent enum, extracted time, suggested next message).

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
build parallel to this roadmap (PD-4).

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
