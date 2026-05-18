# REF-31 — Per-category intelligence in the chat reply flow

**Branch:** `feat/REF-31-per-category-intelligence`
**Status:** ready for review
**Merged:** commit `<merge-sha>`, PR #N
**Size:** **M** (~+312 net code lines). Within M ceiling.

## Scope

**Changed.** REF-30 emitted generic content for every classified reply: same
Ref text, same `[📊 Record outcome]` + `[↩ Undo replied]` button pair
regardless of intent. REF-31 specializes per intent so the chat actually
reflects the play Ref recommends.

Three layers of specialization:

1. **Per-category Ref text.** `INTENT_TO_REF_TEXT` (10 entries) replaces
   the REF-30 generic "Saved their reply. Classified as: ..." text. The
   classification chip still emits above as the AI's call; Ref's text
   below is the recommendation. Different signals (DQ-E).
2. **Per-category action buttons.** Nine intents (everything except
   `yes_to_coffee_chat`) now expose a `[✏️ Draft <pattern>]` primary
   button. `yes_to_coffee_chat` keeps its `[☕ Schedule coffee chat]`
   bridge to PostReplyView (unchanged from REF-30).
   `apply_through_portal` also gets a leading `[🔗 Open LinkedIn]`
   button because applying via the portal happens first.
3. **Per-category draft templates.** Clicking `[✏️ Draft …]` dispatches
   `draft_reply_<suffix>` to the server. A new state-machine branch in
   `_generate_ref_response` fills `INTENT_TO_DRAFT_TEMPLATE[intent]`
   via `fill_template(template, contact, user, extracted_data)` and
   emits a `draft_card` + action_buttons (Copy / Open LinkedIn /
   Record outcome / Undo replied). Chat-only — **no lifecycle
   mutation, no `OutreachMessage` row** (Plan §L decision (L-i)).

Both the live reply-capture path (`_generate_reply_capture_response`)
and the legacy reconstruction path (`init_chat` case (b)) delegate to a
single new helper `_replied_state_response_for_category(contact,
intent, confidence, extracted_data) -> (text, actions)`. Parity is
guaranteed by construction — there's one source of truth for the
post-reply view.

**Not changed.** Lifecycle cascade in `_derive_lifecycle_status`
untouched. AI services (`generate_initial_draft`, `revise_draft`,
`parse_reply`) untouched. `ContactReply` schema untouched (REF-31 reads
the existing `extracted_data` jsonb field that `parse_reply` already
populates). REF-30's `CaptureReply` side effect and `UndoReplied`
descriptor unchanged. PostReplyView's `mode` / `onModeChange` props
unchanged.

## Files

| Path | Action | Lines |
|---|---|---|
| `backend/app/prompts/intent_taxonomy.py` | +INTENT_TO_REF_TEXT, +INTENT_TO_DRAFT_TEMPLATE, +DRAFT_ACTION_SUFFIX_TO_INTENT, +fill_template | +105 |
| `backend/app/api/v1/ref_chat.py` | +imports, +_action_buttons_for_replied_category, +_replied_state_response_for_category, refactor _generate_reply_capture_response (delegate), refactor init_chat case (b) (delegate), +extracted_data param on _generate_ref_response, +draft_reply_* state-machine branch, widen VALID_USER_ACTIONS, +state-mismatch validation, +extracted_data preload, +call-site pass-through | +193 / −24 |
| **Backend subtotal** | | **+274 / −24** |
| `frontend/src/types/refChat.ts` | +9 RefChatActionKind, +9 RefChatUserActionContent.action union | +26 / −2 |
| `frontend/src/components/room/RefChatPanel.tsx` | +9 OR clauses in handleAction server-bound branch, +9 ACTION_LABELS entries (past tense per DQ-I) | +25 / −1 |
| **Frontend subtotal** | | **+51 / −3** |
| `docs/modifications/REF-31.md` | new | this file |
| `docs/ROADMAP.md` | Issue 6 sub-issue → Shipped + Updates + Changelog | +5 |

Net code change: **+343 / −31 = +312 net.** Comfortably M. Plan
estimate was +290; the overshoot is in `ref_chat.py` (more inline
context for the per-category branch + dual delegation comments).

## Test plan

Programmatic (run by agent):
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean (only
  the 3 pre-existing `data/jobs.ts` errors per CLAUDE.md §9).
- Python AST parse on `intent_taxonomy.py` + `ref_chat.py`: OK.
- Grep verifications (Plan §9):
  - `draft_reply_` count in `ref_chat.py` ≥10 (got 17).
  - `draft_reply_` count in `refChat.ts` ≥9 (got 18 — 9 in each union).
  - `draft_reply_` count in `RefChatPanel.tsx` ≥18 (9 OR clauses + 9
    labels; got 18).
  - `fill_template` defined in `intent_taxonomy.py`: line 125.
  - `extracted_data=extracted_data_for_handler` at call site: line 1340.
  - 3 references to `action.startswith("draft_reply_")` across
    state-machine branch, validation, and preload: confirmed.

Manual (deferred to reviewer):
1. **`send_resume` happy path.** Paste "Sure, send your CV" on a `sent`
   contact → classification chip "They want your resume (high)" → Ref's
   per-category text "Nice — they want the resume. Send it AND anchor
   a meeting in the same message, so it doesn't disappear into the
   void." → primary button `[✏️ Draft send-and-anchor]` →
   click → chat row appended: Ref text "Here's the play — copy it,
   send on LinkedIn, then come back." + draft_card with template text +
   `[📋 Copy] [🔗 Open LinkedIn] [📊 Record outcome] [↩ Undo replied]`.
   Lifecycle stays at `replied` (verify in dev tools — no
   `OutreachMessage` row created).
2. **`yes_to_coffee_chat` path.** Paste "Sure, happy to chat. How about
   Thursday 2pm?" → no draft button; only `[☕ Schedule coffee chat]`
   (primary) bridges to PostReplyView (unchanged from REF-30).
3. **`not_right_person` template fill.** Paste "Actually you want to
   talk to Sarah on the data team" → if `parse_reply` extracted
   `redirect_target_name: "Sarah"`, the draft template renders
   "Appreciate the redirect to Sarah." If extraction missed it, the
   fallback "the person you mentioned" renders. Either way, no crash.
4. **`apply_through_portal` ordering.** Paste "Please apply via the
   careers portal" → primary button is `[🔗 Open LinkedIn]` FIRST,
   then `[✏️ Draft 'confirmed applied']` second. Click the open-LinkedIn
   button → new tab opens to contact's profile URL (existing behavior).
   Click the draft button → fills the "Just submitted via the portal —
   req [###]" template.
5. **Legacy reconstruction parity.** Force-wipe `ref_chat_messages` for
   a `replied` contact that has a `ContactReply` row. Reopen popup →
   `init_chat` case (b) reconstructs with byte-identical per-category
   text + buttons as the live path. (Parity guaranteed by the shared
   helper.)
6. **`uncategorized` fallback.** Paste "k" → classification chip
   "Couldn't classify confidently (low)" → Ref text "Saved their
   reply. The classifier wasn't confident — pick what fits." → primary
   button `[✏️ Draft follow-up]` → fills the
   `"Hey {first}, following up on my note — let me know what works for
   you."` template.
7. **State-mismatch.** Click a `draft_reply_*` button after the
   contact's lifecycle moved away from `replied` (e.g. user scheduled
   a coffee chat) → server 400 with `_validation_error` shape →
   `useRefChat onError` shows the "stale button" toast.
8. **Edits-left.** The draft_card emitted by REF-31 has
   `edits_left: 0` + `show_counter: false`. Composer should not allow
   text edits (Plan §K — chat-only, no draft revision path in v1).

## Decisions

1. **DQ-A → per-category content path: helper + delegation.**
   Both the live capture handler and the init_chat reconstruction
   handler delegate to `_replied_state_response_for_category`. Parity
   by construction. Avoids the REF-30 footgun where two branches
   independently encoded "the post-reply view."

2. **DQ-B → 9 categories get draft buttons, 1 bridges.**
   `yes_to_coffee_chat` keeps the REF-30 bridge to PostReplyView's
   scheduling picker (chat-native scheduling = REF-32). Drafting a
   "yes" reply is not the play — locking the time is.

3. **DQ-C → chat-only drafts, no `OutreachMessage` row.**
   Adding an `OutreachMessage(type="followup_*")` to a contact already
   at `replied` does NOT advance lifecycle — the cascade short-circuits
   at `replied_at` (priority cascade in
   `_derive_lifecycle_status`). Plan §L explored options (L-i)
   chat-only, (L-ii) extend cascade, (L-iii) new lifecycle state.
   Picked (L-i): smallest blast radius, lets users iterate on follow-up
   wording before they decide to commit; "Record outcome" / "Undo
   replied" remain the only paths out of `replied`.

4. **DQ-D → fill_template uses `getattr`, not model imports.**
   Keeps `intent_taxonomy.py` free of SQLAlchemy dependencies (it's
   imported by both `ref_chat.py` route and `ref_ai.py` service —
   layering hygiene). Side benefit: testable with plain mock objects.

5. **DQ-E → classification chip + Ref text are different signals.**
   Chip = AI's call ("They want your resume — high"). Text = Ref's
   recommendation ("Send it AND anchor a meeting…"). REF-30 collapsed
   both into "Saved their reply. Classified as: …". REF-31 separates
   them so trust failures (AI was wrong) and play disagreements (AI
   was right but the user prefers a different angle) read as different
   things to the user.

6. **DQ-F → no per-confidence text variation in v1.**
   Same Ref text for low/med/high. Confidence already shows in the
   chip. Avoid combinatorial explosion until we have real reply data
   to know if low-confidence text needs to be softer.

7. **DQ-G → two-step draft flow: Ref text + draft_card.**
   Emit "Here's the play — copy it, send on LinkedIn, then come back."
   as a bubble FIRST, then the draft_card. Matches the
   `she_accepted → drafted` flow's pacing (intro text → draft). Single
   draft_card emission feels abrupt without the Ref voice ahead of it.

8. **DQ-H → new `extracted_data` parameter on `_generate_ref_response`.**
   Do NOT reuse `ai_result`. `ai_result` is the result of THIS POST's AI
   call (parse_reply / generate_initial_draft / revise_draft). For
   `draft_reply_*` actions there is no AI call — we read the
   PREVIOUSLY-stored `extracted_data` from the latest `ContactReply`.
   Same param name would lie about provenance. (Rejected option H-i:
   "repurpose ai_result for whatever the handler needs.")

9. **DQ-I → action chip labels are past tense.**
   By the time the chip renders, the click has already resolved and
   the draft has appeared. Present-progressive ("Drafting…") suggests
   asynchrony that isn't there.

10. **DQ-J → no per-category icons on the draft buttons.**
    All 9 use ✏️. Icon variety inside a vertical button stack reads as
    noise; the label carries the meaning. (Open to revisit if user
    research surfaces button-discovery issues.)

11. **DQ-K → no migration needed for chat-history schema.**
    `ref_chat_messages` already accepts `kind="draft_card"` rows; REF-13
    schema. REF-31's draft_card emissions in REPLIED look identical to
    DRAFTED-era draft_cards from the storage layer's POV. No schema
    changes; existing rows from prior tickets unaffected.

## Plug-in points

`TODO(REF-32)` markers (none added yet — listed here for the next ticket):

- **Chat-native scheduling.** Replace the `[☕ Schedule coffee chat]`
  bridge to PostReplyView with an in-chat date/time picker. REF-30's
  PostReplyView refactor (mode/onModeChange) is the prep work; REF-32
  is the extraction.
- **Per-template AI generation.** Right now templates are literal
  strings with `{placeholder}` interpolation. REF-32 / REF-33 could
  pipe the template + contact/job context through `_call_ai_foundry`
  for personalized variants. Keeps the same handler shape; just
  swap `fill_template(...)` for an AI call.
- **parse_reply's `chat_message` + `reasoning` keys.** REF-30 stores
  these in `raw_ai_response` but doesn't surface. REF-31 uses
  `INTENT_TO_REF_TEXT` instead (deterministic, no extra AI cost).
  REF-33 could swap to the AI-generated `chat_message` for higher-touch
  variants per reply.
