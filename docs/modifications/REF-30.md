# REF-30 — Reply capture in chat + parse_reply AI

**Branch:** `feat/REF-30-reply-capture-and-classification`
**Status:** shipped
**Merged:** commit `4846277`, PR #16
**Size:** **L** (the plan estimated +627 net code lines; honest L sizing.
M-ceiling per ROADMAP was overshot. No scope cut.)

## Scope

**Changed.** Chat-native reply capture across `SENT_STATES`. The
composer (`RefChatPanel.tsx`) now renders in `sent` / `followup_1_sent`
/ `followup_2_sent` with placeholder "Paste their reply here…". User
pastes → dispatches `POST /ref-chat` with `kind="reply_paste"` → server
calls new `parse_reply` AI function → classifies into one of 10 intent
categories (per `/docs/research/coffee_chat_conversion.md §4`) →
persists a `ContactReply` row + sets `replied_at` + recomputes
lifecycle → emits a classification chip + generic Ref text + action
buttons.

New `contacts.replied` is now chat-owned: added to `CHAT_OWNED_STATES`.
Two backward-compat init_chat paths for legacy contacts already in
`replied` — (a) no `ContactReply` row → active-paste prompt + composer,
(b) `ContactReply` exists but chat history was wiped → reconstruct
post-reply view from saved classification.

Per-category content for the action buttons is **deliberately generic**
in REF-30: every category shows `[📊 Record outcome]` + `[↩ Undo replied]`;
`yes_to_coffee_chat` adds `[☕ Schedule coffee chat]` (primary) that
bridges to PostReplyView's existing scheduling picker. Per-category Ref
text variations + per-category placeholder drafts + apply-and-confirm
flow are **REF-31's job**.

**Not changed.** AI generation paths (`generate_initial_draft`,
`revise_draft`) untouched. `OutreachMessage` schema untouched. Worker
code untouched. Existing draft-edit composer behavior in DRAFT_STATES
unchanged. PostReplyView's internal logic mostly unchanged (just
gained externally-controllable `mode` + `onModeChange` props per DQ-9).

## Files

| Path | Action | Lines |
|---|---|---|
| `backend/migrations/versions/n4o5p6q7r8s9_add_contact_replies_table.py` | new | +50 |
| `backend/app/db/models/job.py` | +ContactReply model | +35 |
| `backend/app/prompts/intent_taxonomy.py` | new (DQ-8 shared module) | +40 |
| `backend/app/prompts/reply_classifier.py` | new | +130 |
| `backend/app/services/ref_ai.py` | +parse_reply + helpers | +110 |
| `backend/app/api/v1/ref_chat.py` | +constants, +CaptureReply SE, +_generate_reply_capture_response, +REPLIED init_chat seed (both cases), +reply_paste validation, +reply_paste AI invocation, +CaptureReply application, +UndoReplied activation, +REPLIED undo branch, widened ACTION_UNDO validation | +270 / −10 |
| **Backend subtotal** | | **+625** |
| `frontend/src/types/refChat.ts` | +2 kinds, +2 content interfaces, +PostBody variant, widened union | +18 |
| `frontend/src/components/room/PostReplyView.tsx` | +mode/onModeChange props, +useEffect sync, +external→internal seeding | +35 / −5 |
| `frontend/src/components/room/ContactPopup.tsx` | +STATES.REPLIED to CHAT_OWNED_STATES, +forcedPostReplyMode state, +bridge wiring, +PostReplyMode import | +25 |
| `frontend/src/components/room/RefChatPanel.tsx` | +auto-init filter, +composer-visibility widening, +placeholder helper, +state-dependent dispatch kind, +UserReplyBubble + ReplyClassificationChip sub-components, +switch_to_* action handlers, +onRequestLegacyView prop | +95 / −10 |
| **Frontend subtotal** | | **+158** |
| `docs/modifications/REF-30.md` | new | this file |
| `docs/ROADMAP.md` | Issue 6a + 6b → Shipped (with REF-31 carve-out) | +15 |

Net code change: **+778 / −25 = +753 net.** Solidly L. Plan estimate
was +627; the overshoot is in backend `ref_chat.py` (more init_chat
seed text + careful inline comments) and frontend `PostReplyView.tsx`
+ `RefChatPanel.tsx` (DQ-9 refactor + the bridge plumbing).

## Test plan

Programmatic (run by agent):
- Alembic migration applied to Azure prod (head: `n4o5p6q7r8s9`).
- Column verification via `information_schema.columns`: 9 columns
  matching the migration spec (id, contact_id, user_id, reply_text,
  classified_intent, classification_confidence, extracted_data,
  raw_ai_response, created_at).
- Alembic round-trip (downgrade → upgrade) on Azure prod: clean.
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean (only
  the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).
- Python AST parse on all backend files touched: OK.
- Grep verifications: KIND_REPLY_PASTE in ref_chat.py (≥4 hits);
  reply_paste/reply_classification in refChat.ts (≥3); parse_reply
  defined in ref_ai.py; ContactReply model exists; STATES.REPLIED in
  ContactPopup (≥2 hits).

Manual (deferred to reviewer):
1. Open a fresh `sent` contact → composer renders with "Paste their
   reply here…" placeholder.
2. Paste a `send_resume`-style reply ("Sure, send your CV") → user
   bubble renders as quoted italic "Their reply" style; classification
   chip appears ("Classified as: They want your resume (high
   confidence)"); Ref text + `[📊 Record outcome]` + `[↩ Undo replied]`
   render; lifecycle moves to `replied`.
3. `yes_to_coffee_chat` path: paste "Sure, happy to chat. How about
   Thursday 2pm?" → primary button is `[☕ Schedule coffee chat]`;
   click → popup body swaps to PostReplyView with the date picker
   pre-opened to coffee-chat mode.
4. Click `[↩ Undo replied]` → lifecycle reverts to `sent`. ContactReply
   row remains (audit trail).
5. Ambiguous reply ("k") → classifier returns `uncategorized` /
   `low` → chip + generic buttons.
6. Legacy contact (`replied_at` set, no ContactReply row): popup opens
   to the active-paste prompt + composer.
7. Same paste flow in `fu1_sent` and `fu2_sent`.
8. AI failure path: parse_reply's try/except (`ref_ai.py:251-263`)
   catches any exception and returns the uncategorized-low fallback;
   the chat continues normally with the generic message.

## Decisions

1. **DQ-1 → Option (ii) new `contact_replies` table.** Multi-reply by
   design. Holds reply text + classification metadata + raw AI
   response (for offline evaluation).

2. **DQ-2 → bridge to PostReplyView for `yes_to_coffee_chat`.** Reuses
   the existing date picker. Same precedent as REF-22's DD-A
   considered. The bridge unwinds when REF-31 chat-natives the
   scheduling.

3. **DQ-3 → always show classification chip.** Low-emphasis center
   chip. Lets the user verify the AI's call without making it the
   focal point. Critical for trust building during early product use.

4. **DQ-4 → no re-classify affordance in v1.** Undo + repaste is
   enough. Adds re-classify in a future ticket if real users hit it.

5. **DQ-5 → SKIPPED (per-category placeholder drafts are REF-31).**
   REF-30 buttons are generic.

6. **DQ-6 → composer in SENT_STATES is reply-paste only.** No free-text
   chat with Ref in those states. Constrains UX legibility per state.

7. **DQ-7 → active "paste your reply" prompt for legacy `replied`.**
   Gets us classification metadata on legacy contacts.

8. **DQ-8 → new `intent_taxonomy.py` module.** Both `ref_ai.py` and
   `ref_chat.py` import the canonical category list + label map from
   here. Avoids cross-import.

9. **DQ-9 → PostReplyView refactored to controllable `mode` +
   `onModeChange`.** Cleaner interface for REF-31+. The chat's
   forcedView state in ContactPopup drives the prop; PostReplyView's
   internal state notifies parent via `onModeChange` so the forced
   state clears when the user dismisses.

10. **DQ-10 → UndoReplied activated.** REF-22 reserved the descriptor
    with a defensive `raise 500`. REF-30 implements it (clears
    `replied_at`, cascade reverts to sent state). Inline comment
    flags REF-30 activation.

11. **DQ-11 → ship as L.** No scope cut. Honest sizing flagged here.

12. **Temperature 0.2 for classification** (vs 0.7 for
    `generate_initial_draft` / `revise_draft`). Classification wants
    determinism. New `_call_ai_foundry_with_temp` helper keeps the
    existing `_call_ai_foundry` contract unchanged (no behavior
    shift for the existing generation calls).

13. **parse_reply has its own try/except fallback** returning the
    uncategorized-low classification on ANY exception (AI down,
    timeout, invalid JSON, missing keys, unknown intent value). The
    handler still saves the reply text + sets `replied_at` so the
    user can proceed manually.

14. **`raw_ai_response` preserved in `contact_replies`** for offline
    evaluation. Lets us re-classify against improved prompts later
    without losing the original AI output.

## Plug-in points

`TODO(REF-31)` markers and follow-up work:

- **`backend/app/api/v1/ref_chat.py:_generate_reply_capture_response`** —
  per-category specialization (Ref text variants, per-category
  placeholder drafts, apply-and-confirm flow). Currently generic.
- **`backend/app/api/v1/ref_chat.py` init_chat REPLIED branch** —
  the action_buttons for the legacy reconstruction case (b) duplicate
  the live response's logic. REF-31 should factor both into a shared
  helper.
- **The `[☕ Schedule coffee chat]` bridge** to PostReplyView is a
  temporary seam. REF-31 will replace with a chat-native scheduling
  card.
- **`parse_reply` returns `chat_message` and `reasoning` keys** that
  REF-30 doesn't surface to the user — only stored in `raw_ai_response`.
  REF-31 may use `chat_message` as a per-category Ref text override
  for higher-touch UX.
- **`PostReplyView` mode/onModeChange refactor (DQ-9)** is a stepping
  stone toward fully extracting its scheduling/outcome UI into chat
  cards. REF-31 / REF-32 will benefit.
