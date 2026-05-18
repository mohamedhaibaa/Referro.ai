"""REF-13 + REF-17: chat-driven outreach with AI-generated drafts.

The pure state machine (`_generate_ref_response`) returns messages + side-effect
descriptors. AI draft generation and revision happen in the handler (via
`app.services.ref_ai`), keeping the state machine testable.

Lifecycle invariant: this router does NOT directly mutate `lifecycle_status` or
`outreach_messages.sent_at`. Instead:
  - For drafting an initial message (the `she_accepted` action), we INSERT an
    OutreachMessage and call `_recompute_and_persist` (the same path the
    outreach router uses).
  - For marking sent, we return `requires_followup="mark_sent"` and the
    frontend calls the existing `useUpdateOutreach` to PATCH `sent_at`.
"""
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.v1.outreach import CONNECTED, NOT_CONTACTED, _recompute_and_persist
from app.db.models.job import Contact, ContactReply, Job, OutreachMessage, RefChatMessage
from app.db.models.user import User
from app.db.session import get_db
from app.prompts.intent_taxonomy import (
    DRAFT_ACTION_SUFFIX_TO_INTENT,
    INTENT_CATEGORIES,
    INTENT_TO_DRAFT_TEMPLATE,
    INTENT_TO_LABEL,
    INTENT_TO_REF_TEXT,
    fill_template,
)
from app.prompts.user_context import UserContext, build_user_context
from app.services.ref_ai import (
    generate_followup,
    generate_initial_draft,
    parse_reply,
    revise_draft,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Constants ---

ROLE_REF = "ref"
ROLE_USER = "user"
DRAFT_EDITS_INITIAL = 2

# Reserved kind enum (not all are produced this stage; named here so future
# additions don't require a migration).
KIND_TEXT = "text"
KIND_INTEL = "intel_card"
KIND_DRAFT = "draft_card"
KIND_ACTIONS = "action_buttons"
KIND_USER_ACTION = "action"  # user-side echo of a button press
KIND_REPLY_PASTE = "reply_paste"               # REF-30 (user-role): pasted contact reply
KIND_REPLY_CLASSIFICATION = "reply_classification"  # REF-30 (ref-role): classification chip

ACTION_SENT_CONNECTION = "sent_connection_request"
ACTION_SHE_ACCEPTED = "she_accepted"
ACTION_APPROVE_DRAFT = "approve_draft"
ACTION_MARK_SENT = "mark_sent"
ACTION_THEY_REPLIED = "they_replied"
ACTION_DRAFT_FOLLOWUP_1 = "draft_followup_1"
ACTION_DRAFT_FOLLOWUP_2 = "draft_followup_2"
ACTION_UNDO = "undo"
VALID_USER_ACTIONS = {
    ACTION_SENT_CONNECTION,
    ACTION_SHE_ACCEPTED,
    ACTION_APPROVE_DRAFT,
    ACTION_MARK_SENT,
    ACTION_THEY_REPLIED,
    ACTION_DRAFT_FOLLOWUP_1,
    ACTION_DRAFT_FOLLOWUP_2,
    ACTION_UNDO,
} | {
    # REF-31: per-category draft_reply_<suffix> actions emitted from REPLIED.
    # One per non-coffee_chat intent (9 total). The handler fills a template
    # from INTENT_TO_DRAFT_TEMPLATE; no lifecycle mutation.
    f"draft_reply_{suffix}" for suffix in DRAFT_ACTION_SUFFIX_TO_INTENT
}

# Lifecycle state literals (mirrored from outreach._derive_lifecycle_status).
DRAFTED = "drafted"
SENT = "sent"
FU1_DRAFTED = "followup_1_drafted"
FU1_SENT = "followup_1_sent"
FU2_DRAFTED = "followup_2_drafted"
FU2_SENT = "followup_2_sent"
REPLIED = "replied"  # REF-30: chat-owned post-reply state

DRAFT_STATES = {DRAFTED, FU1_DRAFTED, FU2_DRAFTED}
SENT_STATES = {SENT, FU1_SENT, FU2_SENT}

# Map from a *_drafted lifecycle state to the OutreachMessage.type the user is
# editing in that state. Used by _current_draft_message_for_contact and the
# generalized UpdateCurrentDraft/DeleteCurrentDraft/UndoSent side effects.
_DRAFT_STATE_TO_TYPE = {
    DRAFTED: "initial",
    FU1_DRAFTED: "followup_1",
    FU2_DRAFTED: "followup_2",
}
_SENT_STATE_TO_TYPE = {
    SENT: "initial",
    FU1_SENT: "followup_1",
    FU2_SENT: "followup_2",
}


def _validation_error(action: str, state: str) -> HTTPException:
    """Consistent 400-detail template — frontend's useRefChat onError parses
    this prefix to distinguish stale-state errors from generic 400s."""
    return HTTPException(
        status_code=400,
        detail=f"Action {action!r} is not valid in state {state!r}",
    )


# --- Request body ---

class RefChatPostRequest(BaseModel):
    kind: Literal["text", "action", "reply_paste"]  # REF-30: + reply_paste
    content: dict
    edits_left: Optional[int] = None  # client hint, server re-derives


# --- Side-effect descriptors (resolved by handler, not by the pure function) ---

@dataclass
class CreateOutreach:
    """Insert a new OutreachMessage of the given type.
    Used for: she_accepted (type="initial"), draft_followup_1 (type="followup_1"),
    draft_followup_2 (type="followup_2")."""
    type: str
    text: str


@dataclass
class UpdateCurrentDraft:
    """Update the body of the OutreachMessage matching the contact's current
    drafted state. Type inferred from contact.lifecycle_status via
    _current_draft_message_for_contact."""
    text: str


@dataclass
class DeleteCurrentDraft:
    """Delete the OutreachMessage matching the contact's current drafted state.
    Used by undo from fu1_drafted (deletes fu1) and fu2_drafted (deletes fu2)."""
    pass


@dataclass
class UndoSent:
    """Clear sent_at on the OutreachMessage matching the contact's current
    sent state. Used by undo from sent / fu1_sent / fu2_sent."""
    pass


@dataclass
class UndoReplied:
    """Clear replied_at on the contact. Used by undo from replied state.
    NOTE: replied is out of REF-22 scope; this descriptor is reserved for
    a future ticket that brings replied into chat. Kept here so the
    SideEffect union stays exhaustive but no code path produces it yet."""
    pass


@dataclass
class CaptureReply:
    """REF-30: persist a ContactReply row + set replied_at on the contact.

    `parsed` carries the parse_reply output (intent_category, confidence,
    extracted_data, chat_message, reasoning). The reply_text is the raw
    pasted text; persisted separately on the row AND as a user-role
    KIND_REPLY_PASTE chat message via the standard _persist_user_message
    path.
    """
    reply_text: str
    parsed: dict


@dataclass
class MarkConnected:
    """REF-28: PATCH contact.connected_at = now() and recompute.
    Triggers lifecycle transition not_contacted -> connected when the user
    clicks the connection-request button. Frontend separately opens the
    contact's LinkedIn profile in a new tab."""
    pass


SideEffect = Union[
    CreateOutreach,
    UpdateCurrentDraft,
    DeleteCurrentDraft,
    UndoSent,
    UndoReplied,
    MarkConnected,
    CaptureReply,  # REF-30
]


@dataclass
class RefResponse:
    messages: list[dict] = field(default_factory=list)  # role/kind/content dicts
    side_effects: list[SideEffect] = field(default_factory=list)
    requires_followup: Optional[str] = None


# --- Serialization ---

def _msg_to_dict(m: RefChatMessage) -> dict:
    return {
        "id": str(m.id),
        "role": m.role,
        "kind": m.kind,
        "content": m.content,
        "createdAt": m.created_at.isoformat(),
    }


def _action(label: str, kind: str, primary: bool = False) -> dict:
    return {"label": label, "kind": kind, "primary": primary}


# --- Intel card ---
# _stub_draft removed in REF-17 — draft generation now handled by
# app.services.ref_ai.generate_initial_draft, called from the handler.


def _intel_card_content(contact: Contact) -> dict:
    """Build the intel card from whatever fields the contact still has.
    Defensive against NULL columns (profile_data is nullified after 30 days)."""
    items: list[dict] = []
    if contact.title:
        items.append({"icon": "💼", "text": contact.title})
    if contact.company:
        items.append({"icon": "🏢", "text": contact.company})
    if contact.location:
        items.append({"icon": "📍", "text": contact.location})
    if contact.tenure_months:
        years = contact.tenure_months // 12
        months = contact.tenure_months % 12
        if years and months:
            tenure_str = f"{years}y {months}mo at company"
        elif years:
            tenure_str = f"{years}y at company"
        else:
            tenure_str = f"{months}mo at company"
        items.append({"icon": "⏳", "text": tenure_str})
    if contact.university:
        items.append({"icon": "🎓", "text": contact.university})
    if not items:
        items.append({"icon": "👤", "text": "Limited profile info"})

    title = f"Intel on {contact.full_name or 'this contact'}"
    return {"title": title, "items": items}


# --- Action button presets (used by both _generate_ref_response and init_chat) ---

def _approve_buttons(include_undo: bool) -> dict:
    """Action buttons rendered alongside a draft_card (drafted / fu*_drafted)."""
    actions = [_action("Looks fire 🔥", ACTION_APPROVE_DRAFT, primary=True)]
    if include_undo:
        actions.append(_action("↩ Discard draft", ACTION_UNDO, primary=False))
    return {"actions": actions}


def _send_message_button() -> dict:
    """Single send-message button after the user clicks Looks fire (post-approve).
    REF-23: consolidated from 3 buttons (copy / open_linkedin / mark_sent) into
    one. The frontend's send_message handler orchestrates copy + window.open +
    visibilitychange wait + AlertDialog confirmation, then dispatches mark_sent
    on user confirmation."""
    return {"actions": [
        _action("📋 Copy & open LinkedIn", "send_message", primary=True),
    ]}


def _sent_state_buttons(state: str) -> dict:
    """Action buttons for SENT_STATES seeds.

    REF-31 addendum: dropped [📨 They replied], [🔗 Open LinkedIn], and
    [↩ Undo send] now that REF-30's paste-to-classify composer makes
    those redundant. The composer (widened for SENT_STATES in REF-30)
    IS the reply path; users who need LinkedIn can open from the
    pinned contact header. Only the draft-followup affordance remains.

    fu2_sent has no draft_followup_3 (terminal cadence) — returns an
    empty actions list rather than None so callsites stay uniform.
    """
    if state == SENT:
        return {"actions": [_action("📝 Draft follow-up", ACTION_DRAFT_FOLLOWUP_1, primary=False)]}
    if state == FU1_SENT:
        return {"actions": [_action("📝 Draft follow-up", ACTION_DRAFT_FOLLOWUP_2, primary=False)]}
    # FU2_SENT
    return {"actions": []}


def _sent_state_text(state: str, first: str) -> str:
    """REF-31 addendum: per-state Ref voice for SENT_STATES seeds.

    Used by BOTH the init_chat SENT_STATES branch AND the post-mark_sent
    response in `_generate_ref_response`. Single source of truth so the
    copy stays in sync across entry points (same pattern REF-31 used for
    `_replied_state_response_for_category`).

    Each variant explains both paths now available from the state:
    paste the reply (composer below) OR draft a bump (button above).
    """
    if state == SENT:
        return (
            f"Sent! 📤 Ball's in {first}'s court. When they reply, "
            "paste it below and I'll figure out the next move. Or if "
            "they go quiet, you can draft a bump."
        )
    if state == FU1_SENT:
        return (
            f"Follow-up sent. When {first} replies, paste it below "
            "and I'll read it. Or send one final bump if they're "
            "still quiet."
        )
    # FU2_SENT
    return (
        f"Final bump sent. When {first} replies, paste it below. If "
        "they don't, that's data — we pivot."
    )


def _followup_stub_text(contact: Contact, fu_number: int) -> str:
    """Static placeholder for follow-up draft body. Real AI follow-up generation
    is Issue 6d (a future ticket); per DD-B for REF-22 we hold the line on no
    new AI functions."""
    first = (contact.full_name or "there").split(" ")[0]
    if fu_number == 1:
        return (
            f"Hey {first}, bumping this in case it slipped. Worth 15 min "
            "to chat about the role and your team? Happy to send a hold "
            "for Tue 4 or Thu 2."
        )
    return (
        f"Hey {first}, last bump from me — totally get if the timing's "
        "off. If it opens up later, I'm here. Wishing the team a great "
        "quarter."
    )


# --- Pure state machine ---

def _generate_ref_response(
    contact: Contact,
    user_action: dict,
    current_state: str,
    edits_left_after: Optional[int],
    ai_result: Optional[dict] = None,
    user: Optional[User] = None,
    extracted_data: Optional[dict] = None,
    followup_ai_result: Optional[dict] = None,
) -> RefResponse:
    """Pure: (state, action) -> Ref's reply messages + side effects.
    The handler executes side effects + persists. No DB calls in this function.

    `edits_left_after` is "edits remaining AFTER this incoming user text edit",
    not before. The caller computes this by counting prior user text rows
    SINCE the current draft was created.

    `ai_result` is the parsed AI response dict (keys: chat, draft, play)
    pre-computed by the handler for branches that need AI generation.

    `user` is the current authenticated user; passed through from post_chat
    so Ref's chat copy can address the user by first name (REF-25). Optional
    only because that keeps the function signature backward-compatible for
    any future caller that doesn't have a User in scope.
    """
    first = (contact.full_name or "there").split(" ")[0]
    user_first = (user.name or "").split(" ")[0] if user else ""
    kind = user_action.get("kind")
    content = user_action.get("content") or {}
    action = content.get("action")

    # State: not_contacted ----------------------------------------------------

    if current_state == NOT_CONTACTED and kind == "action" and action == ACTION_SENT_CONNECTION:
        # REF-29: emit BOTH the MarkConnected side effect AND the connected-state
        # chat content. REF-28's side-effect-only approach (Option H-A) assumed
        # init_chat would re-fire on lifecycle update — that assumption was
        # wrong. init_chat is a first-load helper that only seeds when chat
        # history is empty. New chat content during a conversation comes from
        # the response messages here.
        #
        # The text + button below must stay byte-identical to init_chat's
        # CONNECTED branch (~line 751) so a user reaching this state via the
        # button click sees the same content as a user re-opening a CONNECTED
        # contact later. Frontend's handler also opens LinkedIn in a new tab.
        greeting = f"Nice work, {user_first}!" if user_first else "Nice work!"
        text = (
            f"{greeting} Connection request sent to {first}. "
            f"Come back when they accept and tap the button below "
            "to let me know."
        )
        return RefResponse(
            messages=[
                {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": text}},
                {
                    "role": ROLE_REF, "kind": KIND_ACTIONS,
                    "content": {"actions": [
                        _action(f"✅ {first} accepted", ACTION_SHE_ACCEPTED, primary=True),
                    ]},
                },
            ],
            side_effects=[MarkConnected()],
        )

    if current_state in (NOT_CONTACTED, CONNECTED) and kind == "action" and action == ACTION_SHE_ACCEPTED:
        # ai_result is pre-computed by the handler via generate_initial_draft.
        ai = ai_result or {}
        draft_text = ai.get("draft", "")
        chat_text = ai.get("chat", (
            "Let's go. Time to send the outreach. Here's what "
            "I'd open with, tell me what to tweak, or hit \"Looks "
            "fire\" if it's good."
        ))
        play = ai.get("play")
        if play:
            chat_text = f"Pattern: **{play}**. {chat_text}"
        return RefResponse(
            messages=[
                {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": chat_text}},
                {
                    "role": ROLE_REF, "kind": KIND_DRAFT,
                    "content": {
                        "text": draft_text,
                        "edits_left": DRAFT_EDITS_INITIAL,
                        "show_counter": True,
                    },
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _approve_buttons(include_undo=False)},
            ],
            side_effects=[CreateOutreach(type="initial", text=draft_text)],
        )

    # State: drafted / fu1_drafted / fu2_drafted (DRAFT_STATES) ---------------

    if current_state in DRAFT_STATES and kind == "text":
        # ai_result is pre-computed by the handler via revise_draft.
        ai = ai_result or {}
        revised = ai.get("draft", (content.get("text") or "").strip())
        chat_text = ai.get("chat", "Tightened it up.")

        left = max(0, edits_left_after or 0)
        if left > 0:
            chat_text += f" {left} edit{'s' if left != 1 else ''} left, or hit \"Looks fire\" when ready."
        else:
            chat_text += " No more edits, hit \"Looks fire\" when you're ready."

        include_undo = current_state in (FU1_DRAFTED, FU2_DRAFTED)
        return RefResponse(
            messages=[
                {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": chat_text}},
                {
                    "role": ROLE_REF, "kind": KIND_DRAFT,
                    "content": {
                        "text": revised,
                        "edits_left": left,
                        "show_counter": True,
                    },
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _approve_buttons(include_undo=include_undo)},
            ],
            side_effects=[UpdateCurrentDraft(text=revised)],
        )

    if current_state in DRAFT_STATES and kind == "action" and action == ACTION_APPROVE_DRAFT:
        if current_state == DRAFTED:
            text = "Let's go 🚀 Copy it, paste into LinkedIn, then come back and hit \"Mark sent.\""
        else:
            text = "Let's send the follow-up. Copy it, paste into LinkedIn, then come back and hit \"Mark sent.\""
        return RefResponse(messages=[
            {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": text}},
            {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _send_message_button()},
        ])

    if current_state in DRAFT_STATES and kind == "action" and action == ACTION_MARK_SENT:
        # After the frontend chains useUpdateOutreach to PATCH sent_at,
        # _recompute_and_persist advances lifecycle to the matching *_sent state.
        # We emit action_buttons matching the destination state here so they
        # render alongside the "Sent!" text without a second round-trip.
        dest_state = {
            DRAFTED: SENT,
            FU1_DRAFTED: FU1_SENT,
            FU2_DRAFTED: FU2_SENT,
        }[current_state]
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {"text": _sent_state_text(dest_state, first)},
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _sent_state_buttons(dest_state)},
            ],
            requires_followup="mark_sent",
        )

    # State: drafted undo (special — reverts to not_contacted) ----------------
    # Undo from the initial drafted state deletes the initial OutreachMessage,
    # which sends the contact back to not_contacted. Skipped in REF-22 because
    # it interacts with the missing "connected" lifecycle state (PD-1, Issue 1).
    # fu1_drafted / fu2_drafted DO support undo (delete the followup row,
    # revert to sent / fu1_sent respectively).

    if current_state in (FU1_DRAFTED, FU2_DRAFTED) and kind == "action" and action == ACTION_UNDO:
        revert_to = SENT if current_state == FU1_DRAFTED else FU1_SENT
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {"text": "Discarded that follow-up. Back where we were."},
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _sent_state_buttons(revert_to)},
            ],
            side_effects=[DeleteCurrentDraft()],
        )

    # State: sent / fu1_sent / fu2_sent (SENT_STATES) -------------------------

    if current_state in SENT_STATES and kind == "action" and action == ACTION_THEY_REPLIED:
        # Lifecycle moves to `replied` via the frontend's chained setContactRepliedAt.
        # Replied is OUT of REF-22 scope (DQ-1) — ContactPopup's conditional
        # routes `replied` to PostReplyView once the lifecycle transitions.
        # We emit the chat message acknowledging the reply; the view-swap is
        # automatic on the next render.
        return RefResponse(
            messages=[{
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        "Nice — they replied! Let's lock 15 min for a coffee chat. "
                        "That's the play."
                    ),
                },
            }],
            requires_followup="mark_replied",
        )

    if current_state == SENT and kind == "action" and action == ACTION_DRAFT_FOLLOWUP_1:
        stub = _followup_stub_text(contact, fu_number=1)
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {
                        "text": (
                            "Drafted a follow-up. Tweak it, or hit \"Looks fire\" "
                            "when ready."
                        ),
                    },
                },
                {
                    "role": ROLE_REF, "kind": KIND_DRAFT,
                    "content": {
                        "text": stub,
                        "edits_left": DRAFT_EDITS_INITIAL,
                        "show_counter": True,
                    },
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _approve_buttons(include_undo=True)},
            ],
            side_effects=[CreateOutreach(type="followup_1", text=stub)],
        )

    if current_state == FU1_SENT and kind == "action" and action == ACTION_DRAFT_FOLLOWUP_2:
        stub = _followup_stub_text(contact, fu_number=2)
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {
                        "text": (
                            "Drafted the final follow-up — the graceful close. "
                            "Tweak it, or hit \"Looks fire\" when ready."
                        ),
                    },
                },
                {
                    "role": ROLE_REF, "kind": KIND_DRAFT,
                    "content": {
                        "text": stub,
                        "edits_left": DRAFT_EDITS_INITIAL,
                        "show_counter": True,
                    },
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _approve_buttons(include_undo=True)},
            ],
            side_effects=[CreateOutreach(type="followup_2", text=stub)],
        )

    # State: replied (REF-30) ------------------------------------------------

    if current_state == REPLIED and kind == "action" and action == ACTION_UNDO:
        # Cleared replied_at → cascade reverts to whichever sent state the
        # OutreachMessage timestamps imply (sent / fu1_sent / fu2_sent).
        # No fresh action_buttons emitted; init_chat's SENT_STATES seed
        # covers the post-undo UI on next render.
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {"text": "Undone — back to waiting for their reply."},
                },
            ],
            side_effects=[UndoReplied()],
        )

    # REF-31: per-category draft emission. User clicked one of the
    # [📨 Draft '<pattern>' message] buttons in the replied state. Emits the
    # two-step flow (DQ-G):
    #   1. Ref text "Here's the play..." (static — DD-7)
    #   2. draft_card with the AI-generated text (REF-32) or REF-31 static
    #      template (fallback)
    #   3. action_buttons [📋 Copy] [🔗 Open LinkedIn] [📊 Record outcome] [↩ Undo replied]
    # NO side effects. NO lifecycle transition. The draft is a conversational
    # artifact only — chat-only drafts per DQ-C / (L-i). The user copies +
    # sends manually via existing client-only handlers.
    if (
        current_state == REPLIED
        and kind == "action"
        and isinstance(action, str)
        and action.startswith("draft_reply_")
    ):
        suffix = action[len("draft_reply_"):]
        intent = DRAFT_ACTION_SUFFIX_TO_INTENT.get(suffix)
        if intent is None:
            # Defensive — validation should have caught this already.
            return RefResponse()

        # REF-32: prefer AI-generated draft; fall back to REF-31 static
        # template if the AI call failed (or no ContactReply existed at
        # the preload site). Same parity-by-construction pattern as
        # REF-31's helper sharing — one branch, two sources.
        ai_meta: Optional[dict] = None
        if followup_ai_result is not None:
            draft_text = str(followup_ai_result.get("draft_text", "")).strip()
            ai_meta = {
                "play": followup_ai_result.get("play", ""),
                "reasoning": followup_ai_result.get("reasoning", ""),
                "model": "gpt-4o-mini",
                "intent_category": intent,
            }
        else:
            # REF-31 fallback (AI failed OR no ContactReply at preload).
            template = INTENT_TO_DRAFT_TEMPLATE.get(intent, "")
            draft_text = fill_template(template, contact, user, extracted_data)

        draft_content: dict = {
            "text": draft_text,
            # No edits_left / show_counter — chat-only drafts, not part of
            # the DRAFT_STATES edit-budget machinery.
            "edits_left": 0,
            "show_counter": False,
        }
        if ai_meta is not None:
            # DD-4: JSONB sidecar for offline prompt-quality eval. Frontend
            # ignores unknown keys; ai_meta?: Record<string, unknown> on
            # RefChatDraftContent permits it without rendering it.
            draft_content["ai_meta"] = ai_meta

        return RefResponse(messages=[
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {"text": "Here's the play — copy it, send on LinkedIn, then come back."},
            },
            {
                "role": ROLE_REF, "kind": KIND_DRAFT,
                "content": draft_content,
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": {"actions": [
                    _action("📋 Copy", "copy", primary=False),
                    _action("🔗 Open LinkedIn", "open_linkedin", primary=False),
                    _action("📊 Record outcome", "switch_to_record_outcome", primary=False),
                    _action("↩ Undo replied", ACTION_UNDO, primary=False),
                ]},
            },
        ])

    if current_state in SENT_STATES and kind == "action" and action == ACTION_UNDO:
        # Clears sent_at on the current sent-state OutreachMessage.
        # _recompute_and_persist will revert lifecycle to the matching
        # *_drafted state.
        revert_to = {SENT: DRAFTED, FU1_SENT: FU1_DRAFTED, FU2_SENT: FU2_DRAFTED}[current_state]
        include_undo = revert_to in (FU1_DRAFTED, FU2_DRAFTED)
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {"text": "Undone — back to draft mode. Tweak away."},
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": _approve_buttons(include_undo=include_undo)},
            ],
            side_effects=[UndoSent()],
        )

    # No-op fallthrough (shouldn't be reached given handler-side validation).
    return RefResponse()


def _action_buttons_for_replied_category(intent: str) -> list[dict]:
    """REF-31: per-category action_buttons list for replied-state UI.

    Every category gets [↩ Undo replied] as trailing secondary.
    yes_to_coffee_chat bridges to PostReplyView's scheduling picker.
    Categories with a draft button get [📨 Draft '<pattern>' message] (primary)
    + [📊 Record outcome]; the action_kind follows "draft_reply_<suffix>" where
    <suffix> matches DRAFT_ACTION_SUFFIX_TO_INTENT.
    apply_through_portal also gets a leading [🔗 Open LinkedIn] secondary
    so the user can actually go apply.
    """
    record_outcome = _action("📊 Record outcome", "switch_to_record_outcome", primary=False)
    undo_replied = _action("↩ Undo replied", ACTION_UNDO, primary=False)

    if intent == "yes_to_coffee_chat":
        return [
            _action("☕ Schedule coffee chat", "switch_to_schedule_coffee_chat", primary=True),
            record_outcome,
            undo_replied,
        ]

    draft_specs: dict[str, tuple[str, str]] = {
        "send_resume":          ("📨 Draft 'send-and-anchor' message",       "draft_reply_send_and_anchor"),
        "im_slammed":           ("📨 Draft 'send-a-hold' follow-up",         "draft_reply_send_a_hold"),
        "tell_me_more":         ("📨 Draft 'easier on a call' reply",        "draft_reply_easier_on_call"),
        "send_job_link":        ("📨 Draft link-plus-meeting reply",         "draft_reply_link_plus_meeting"),
        "apply_through_portal": ("📨 Draft 'confirmed applied' message",     "draft_reply_confirmed_applied"),
        "not_right_person":     ("📨 Draft warm-intro ask",                  "draft_reply_warm_intro"),
        "maybe_later":          ("📨 Draft 'specific future anchor' reply",  "draft_reply_specific_future_anchor"),
        "soft_no":              ("📨 Draft graceful close",                  "draft_reply_graceful_close"),
        "uncategorized":        ("📨 Draft a follow-up",                     "draft_reply_generic"),
    }

    if intent in draft_specs:
        label, kind = draft_specs[intent]
        actions: list[dict] = []
        if intent == "apply_through_portal":
            actions.append(_action("🔗 Open LinkedIn", "open_linkedin", primary=False))
        actions.append(_action(label, kind, primary=True))
        actions.append(record_outcome)
        actions.append(undo_replied)
        return actions

    # Defensive fallback (shouldn't reach here given INTENT_CATEGORIES coverage above).
    return [record_outcome, undo_replied]


def _replied_state_response_for_category(
    contact: Contact,
    intent: str,
    confidence: str,
    extracted_data: dict | None,
) -> tuple[str, list[dict]]:
    """REF-31: per-category Ref text + action_buttons for replied-state UI.

    Single source of truth called by BOTH:
      - _generate_reply_capture_response (live capture, after parse_reply)
      - init_chat case (b) (legacy reconstruction from saved ContactReply row)

    Returns (text, actions) — the caller wraps these in the standard message
    structure (classification chip + text + action_buttons row).

    `intent` MUST be one of INTENT_CATEGORIES (caller is responsible for
    coercing unknown values to "uncategorized" before invoking this).
    `extracted_data` is reserved for future categories that need extraction
    context in the text/button derivation; today's per-category text doesn't
    use it (templates do, at button-click time).
    """
    text = INTENT_TO_REF_TEXT.get(intent, INTENT_TO_REF_TEXT["uncategorized"])
    actions = _action_buttons_for_replied_category(intent)
    return text, actions


def _generate_reply_capture_response(
    contact: Contact,
    reply_text: str,
    parsed: dict,
) -> RefResponse:
    """REF-30: emits chat content for a captured reply.

    Generic across categories (REF-31 will specialize per category). Always
    emits:
      1. Classification chip (KIND_REPLY_CLASSIFICATION) — low-emphasis,
         shows label + confidence to the user
      2. Ref text (KIND_TEXT) — generic "Saved their reply. Classified as: …"
      3. Action buttons (KIND_ACTIONS) — special-cased for yes_to_coffee_chat
         (☕ Schedule coffee chat bridges to PostReplyView)

    The user's pasted reply text is persisted separately as a user-role
    KIND_REPLY_PASTE message via the standard _persist_user_message path
    in post_chat. We don't emit it from here.

    The CaptureReply side effect inserts the ContactReply row + sets
    replied_at + recomputes lifecycle (sent / fu*_sent → replied).
    """
    # REF-31: per-category dispatch via _replied_state_response_for_category.
    # init_chat case (b) calls the same helper — parity guaranteed.
    intent = parsed.get("intent_category", "uncategorized")
    if intent not in INTENT_CATEGORIES:
        intent = "uncategorized"
    confidence = parsed.get("confidence", "low")
    extracted_data = parsed.get("extracted_data") or {}
    label = INTENT_TO_LABEL.get(intent, INTENT_TO_LABEL["uncategorized"])
    text, actions = _replied_state_response_for_category(
        contact, intent, confidence, extracted_data,
    )

    return RefResponse(
        messages=[
            {
                "role": ROLE_REF, "kind": KIND_REPLY_CLASSIFICATION,
                "content": {
                    "label": label,
                    "intent": intent,
                    "confidence": confidence,
                },
            },
            {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": text}},
            {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": {"actions": actions}},
        ],
        side_effects=[CaptureReply(reply_text=reply_text, parsed=parsed)],
    )


# --- DB helpers ---

def _load_job_owned(job_id: str, user: User, db: Session) -> Job:
    job = (
        db.query(Job)
        .filter(Job.id == uuid.UUID(job_id), Job.user_id == user.id, Job.is_deleted == False)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _load_contact_owned(job_id: str, contact_id: str, user: User, db: Session) -> Contact:
    contact = (
        db.query(Contact)
        .filter(
            Contact.id == uuid.UUID(contact_id),
            Contact.job_id == uuid.UUID(job_id),
            Contact.user_id == user.id,
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


def _initial_message_for_contact(db: Session, contact: Contact) -> Optional[OutreachMessage]:
    return (
        db.query(OutreachMessage)
        .filter(
            OutreachMessage.contact_id == contact.id,
            OutreachMessage.user_id == contact.user_id,
            OutreachMessage.type == "initial",
        )
        .first()
    )


def _initial_outreach_text_for_contact(db: Session, contact: Contact) -> Optional[str]:
    """REF-32 (DD-9): return the initial outreach text or None.

    None for legacy contacts that reached `replied` without an
    OutreachMessage(type='initial') row. The FOLLOWUP_GENERATOR_SYSTEM_PROMPT
    handles None defensively ("write fresh without referencing prior").
    """
    msg = _initial_message_for_contact(db, contact)
    return msg.message if msg else None


def _outreach_message_of_type(
    db: Session, contact: Contact, msg_type: str,
) -> Optional[OutreachMessage]:
    return (
        db.query(OutreachMessage)
        .filter(
            OutreachMessage.contact_id == contact.id,
            OutreachMessage.user_id == contact.user_id,
            OutreachMessage.type == msg_type,
        )
        .first()
    )


def _current_draft_message_for_contact(
    db: Session, contact: Contact,
) -> Optional[OutreachMessage]:
    """Return the OutreachMessage the user is currently editing/viewing as a
    draft, based on lifecycle_status. None if the contact isn't in a drafted
    or sent state.

    drafted          -> initial
    sent             -> initial
    followup_1_*     -> followup_1
    followup_2_*     -> followup_2
    """
    state = contact.lifecycle_status or NOT_CONTACTED
    target_type = _DRAFT_STATE_TO_TYPE.get(state) or _SENT_STATE_TO_TYPE.get(state)
    if not target_type:
        return None
    return _outreach_message_of_type(db, contact, target_type)


def _count_user_text_messages_since_current_draft(
    db: Session, contact: Contact, user_id: uuid.UUID,
) -> int:
    """Count user text messages created after the current draft's
    OutreachMessage row. This gives a per-draft edit budget — the counter
    resets when a new OutreachMessage (followup_1, followup_2) is created.

    REF-22: replaces _count_user_text_messages which counted across all
    drafts. Without this fix, follow-up drafts would start with 0 edits
    remaining because the initial-draft edits already used the budget.
    """
    current_draft = _current_draft_message_for_contact(db, contact)
    if current_draft is None:
        return 0
    return db.query(func.count(RefChatMessage.id)).filter(
        RefChatMessage.contact_id == contact.id,
        RefChatMessage.user_id == user_id,
        RefChatMessage.role == ROLE_USER,
        RefChatMessage.kind == KIND_TEXT,
        RefChatMessage.created_at > current_draft.created_at,
    ).scalar() or 0


def _persist_ref_messages(db: Session, contact: Contact, messages: list[dict]) -> list[RefChatMessage]:
    rows: list[RefChatMessage] = []
    for m in messages:
        row = RefChatMessage(
            contact_id=contact.id,
            user_id=contact.user_id,
            role=m["role"],
            kind=m["kind"],
            content=m["content"],
        )
        db.add(row)
        rows.append(row)
    return rows


def _persist_user_message(db: Session, contact: Contact, body: RefChatPostRequest) -> RefChatMessage:
    row = RefChatMessage(
        contact_id=contact.id,
        user_id=contact.user_id,
        role=ROLE_USER,
        kind=body.kind,
        content=body.content,
    )
    db.add(row)
    return row


def _list_chat_dicts(db: Session, contact: Contact, user_id: uuid.UUID) -> list[dict]:
    msgs = (
        db.query(RefChatMessage)
        .filter(
            RefChatMessage.contact_id == contact.id,
            RefChatMessage.user_id == user_id,
        )
        .order_by(RefChatMessage.created_at.asc())
        .all()
    )
    return [_msg_to_dict(m) for m in msgs]


# --- Endpoints ---

@router.get("/{job_id}/contacts/{contact_id}/ref-chat")
def list_chat(
    job_id: str,
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = _load_contact_owned(job_id, contact_id, current_user, db)
    msgs = _list_chat_dicts(db, contact, current_user.id)
    return {"data": msgs, "meta": {"count": len(msgs)}, "error": None}


@router.post(
    "/{job_id}/contacts/{contact_id}/ref-chat/init",
    status_code=status.HTTP_201_CREATED,
)
def init_chat(
    job_id: str,
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Auto-seed the initial Ref intro for a contact whose chat is empty.

    Idempotent: if any chat messages already exist, returns them unchanged.
    Supports `not_contacted` (full intro) and `drafted` (re-display existing
    draft as a draft_card) — the latter ensures contacts that predate REF-13
    or had their chat history wiped still work.
    """
    contact = _load_contact_owned(job_id, contact_id, current_user, db)

    # Serialize concurrent inits via row lock on the contact.
    db.query(Contact).filter(Contact.id == contact.id).with_for_update().one()

    existing_count = db.query(func.count(RefChatMessage.id)).filter(
        RefChatMessage.contact_id == contact.id,
        RefChatMessage.user_id == current_user.id,
    ).scalar() or 0
    if existing_count > 0:
        msgs = _list_chat_dicts(db, contact, current_user.id)
        db.commit()
        return {"data": msgs, "meta": {"count": len(msgs)}, "error": None}

    state = contact.lifecycle_status or NOT_CONTACTED
    first = (contact.full_name or "there").split(" ")[0]
    # REF-28 + DQ-9: parity with _generate_ref_response's REF-25 user_first
    # greeting. NOT_CONTACTED and CONNECTED seeds both address the user by name.
    user_first = (current_user.name or "").split(" ")[0]

    intel = {
        "role": ROLE_REF, "kind": KIND_INTEL,
        "content": _intel_card_content(contact),
    }

    if state == NOT_CONTACTED:
        # REF-28: button now opens LinkedIn for the user; copy adjusted away
        # from "Drop a quick note like..." (irrelevant — they'll see LinkedIn's
        # default flow). DQ-9: first-name greeting parity.
        prefix = f"Hey {user_first}!" if user_first else "Alright,"
        seed = [
            intel,
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        f"{prefix} let's reach out to {first}. First step — "
                        "send a connection request on LinkedIn. Tap the button "
                        "below and I'll open the profile for you."
                    ),
                },
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": {"actions": [
                    _action(
                        "🔗 Send connection request",
                        ACTION_SENT_CONNECTION,
                        primary=True,
                    ),
                ]},
            },
        ]
    elif state == CONNECTED:
        # REF-28: post-click "waiting for acceptance" seed. Reuses REF-25's
        # user_first greeting that previously lived in _generate_ref_response's
        # NOT_CONTACTED + ACTION_SENT_CONNECTION handler.
        greeting = f"Nice work, {user_first}!" if user_first else "Nice work!"
        seed = [
            intel,
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        f"{greeting} Connection request sent to {first}. "
                        f"Come back when they accept and tap the button below "
                        "to let me know."
                    ),
                },
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": {"actions": [
                    _action(f"✅ {first} accepted", ACTION_SHE_ACCEPTED, primary=True),
                ]},
            },
        ]
    elif state in DRAFT_STATES:
        # drafted -> initial; fu1_drafted -> followup_1; fu2_drafted -> followup_2
        target_type = _DRAFT_STATE_TO_TYPE[state]
        existing_msg = _outreach_message_of_type(db, contact, target_type)
        if existing_msg is None:
            raise HTTPException(
                status_code=400,
                detail=f"{state} contact has no {target_type} message — inconsistent state",
            )
        if state == DRAFTED:
            intro = "Picking up where we left off — here's your current draft."
        else:
            fu_num = 1 if state == FU1_DRAFTED else 2
            intro = f"Picking up your follow-up {fu_num} draft."
        include_undo = state in (FU1_DRAFTED, FU2_DRAFTED)
        seed = [
            intel,
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {"text": intro},
            },
            {
                "role": ROLE_REF, "kind": KIND_DRAFT,
                "content": {
                    "text": existing_msg.message,
                    "edits_left": DRAFT_EDITS_INITIAL,
                    "show_counter": True,
                },
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": _approve_buttons(include_undo=include_undo),
            },
        ]
    elif state in SENT_STATES:
        # Legacy contact in a *_sent state with empty chat history.
        # REF-31 addendum: text + buttons come from shared helpers so the
        # copy matches the post-mark_sent response in `_generate_ref_response`
        # byte-for-byte. Same parity-by-construction pattern REF-31 used for
        # the REPLIED state.
        seed = [
            intel,
            {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": _sent_state_text(state, first)}},
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": _sent_state_buttons(state),
            },
        ]
    elif state == REPLIED:
        # REF-30: two cases for legacy contacts (no chat history yet):
        #   (a) No ContactReply row — show active-paste prompt + composer.
        #   (b) ContactReply exists (chat history wiped, but reply was captured
        #       previously) — reconstruct the post-reply view from saved data.
        last_reply = (
            db.query(ContactReply)
            .filter(ContactReply.contact_id == contact.id)
            .order_by(ContactReply.created_at.desc())
            .first()
        )
        if last_reply is None:
            # Case (a): active paste prompt
            seed = [
                intel,
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {
                        "text": (
                            f"Looks like {first} replied earlier — but I don't "
                            "have the text. Paste it below for me to classify, "
                            "or pick what fits."
                        ),
                    },
                },
                {
                    "role": ROLE_REF, "kind": KIND_ACTIONS,
                    "content": {"actions": [
                        _action("📊 Record outcome", "switch_to_record_outcome", primary=False),
                        _action("↩ Undo replied", ACTION_UNDO, primary=False),
                    ]},
                },
            ]
        else:
            # Case (b): reconstruct from saved classification.
            # REF-31: per-category content via _replied_state_response_for_category
            # — same source of truth as _generate_reply_capture_response (parity
            # guaranteed). The classification chip + reply paste bubble surround
            # the per-category text + buttons.
            intent = last_reply.classified_intent or "uncategorized"
            if intent not in INTENT_CATEGORIES:
                intent = "uncategorized"
            confidence = last_reply.classification_confidence or "low"
            extracted_data = last_reply.extracted_data or {}
            label = INTENT_TO_LABEL.get(intent, INTENT_TO_LABEL["uncategorized"])
            recon_text, recon_actions = _replied_state_response_for_category(
                contact, intent, confidence, extracted_data,
            )
            seed = [
                intel,
                {
                    "role": ROLE_USER, "kind": KIND_REPLY_PASTE,
                    "content": {"text": last_reply.reply_text},
                },
                {
                    "role": ROLE_REF, "kind": KIND_REPLY_CLASSIFICATION,
                    "content": {"label": label, "intent": intent, "confidence": confidence},
                },
                {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": recon_text}},
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": {"actions": recon_actions}},
            ]
    else:
        # coffee_chat_* / interview_* / outcome_* — still out of chat scope.
        # ContactPopup's conditional routes these to PostReplyView. init_chat
        # shouldn't be called for them, but stay defensive.
        raise HTTPException(
            status_code=400,
            detail=f"Chat init not supported for state {state!r}",
        )

    rows = _persist_ref_messages(db, contact, seed)
    db.commit()
    for r in rows:
        db.refresh(r)
    return {
        "data": [_msg_to_dict(r) for r in rows],
        "meta": {"count": len(rows)},
        "error": None,
    }


@router.post(
    "/{job_id}/contacts/{contact_id}/ref-chat",
    status_code=status.HTTP_201_CREATED,
)
def post_chat(
    job_id: str,
    contact_id: str,
    body: RefChatPostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = _load_contact_owned(job_id, contact_id, current_user, db)
    state = contact.lifecycle_status or NOT_CONTACTED
    kind = body.kind
    content = body.content or {}

    # --- Validate ---
    # All state-mismatch 400s use the same _validation_error template so the
    # frontend's useRefChat onError can detect "stale button" clicks reliably.
    if kind == "action":
        action = content.get("action")
        if action not in VALID_USER_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action!r}")

        if action == ACTION_SENT_CONNECTION and state != NOT_CONTACTED:
            raise _validation_error(action, state)
        if action == ACTION_SHE_ACCEPTED:
            # REF-28: valid from both NOT_CONTACTED (legacy) and CONNECTED.
            if state not in (NOT_CONTACTED, CONNECTED):
                raise _validation_error(action, state)
            if _initial_message_for_contact(db, contact) is not None:
                raise HTTPException(
                    status_code=409,
                    detail="An initial outreach message already exists for this contact",
                )
        if action == ACTION_APPROVE_DRAFT and state not in DRAFT_STATES:
            raise _validation_error(action, state)
        if action == ACTION_MARK_SENT and state not in DRAFT_STATES:
            raise _validation_error(action, state)
        if action == ACTION_THEY_REPLIED and state not in SENT_STATES:
            raise _validation_error(action, state)
        if action == ACTION_DRAFT_FOLLOWUP_1 and state != SENT:
            raise _validation_error(action, state)
        if action == ACTION_DRAFT_FOLLOWUP_2 and state != FU1_SENT:
            raise _validation_error(action, state)
        if action == ACTION_UNDO and state not in (SENT_STATES | {FU1_DRAFTED, FU2_DRAFTED} | {REPLIED}):
            # Undo from `drafted` is intentionally NOT supported in REF-22 —
            # it would revert to not_contacted and interact with the
            # `connected` lifecycle state (PD-1 / Issue 1). REF-30 widens
            # to accept REPLIED (clears replied_at).
            raise _validation_error(action, state)
        if (
            isinstance(action, str)
            and action.startswith("draft_reply_")
            and state != REPLIED
        ):
            # REF-31: per-category draft buttons are only valid from REPLIED.
            # Stale buttons clicked after lifecycle moved away (e.g. user
            # already scheduled a coffee chat) trip this.
            raise _validation_error(action, state)

    elif kind == "text":
        text_val = (content.get("text") or "").strip()
        if not text_val:
            raise HTTPException(status_code=400, detail="text content cannot be empty")
        if state not in DRAFT_STATES:
            raise _validation_error("text_edit", state)

    elif kind == "reply_paste":
        # REF-30: pasted contact reply, accepted in SENT_STATES only.
        text_val = (content.get("text") or "").strip()
        if not text_val:
            raise HTTPException(status_code=400, detail="reply text cannot be empty")
        if state not in SENT_STATES:
            raise _validation_error("reply_paste", state)

    else:
        # Pydantic Literal already enforces this; defensive only.
        raise HTTPException(status_code=400, detail=f"Unknown kind: {kind!r}")

    # Edits-left server-side check (counts user text messages persisted so far
    # SINCE the current draft was created — per-draft budget, not per-contact).
    edits_left_after: Optional[int] = None
    if kind == "text":
        prior_edits = _count_user_text_messages_since_current_draft(
            db, contact, current_user.id,
        )
        if prior_edits >= DRAFT_EDITS_INITIAL:
            raise HTTPException(status_code=400, detail="No edits remaining for this draft")
        edits_left_after = DRAFT_EDITS_INITIAL - prior_edits - 1
        # body.edits_left is a hint; if it disagrees we trust the server count.

    # --- AI generation (before persist, so we don't commit on AI failure) ---
    ai_result: Optional[dict] = None
    req_action = content.get("action") if kind == "action" else None

    if kind == "action" and req_action == ACTION_SHE_ACCEPTED:
        job = _load_job_owned(job_id, current_user, db)
        chat_history = (
            db.query(RefChatMessage)
            .filter(RefChatMessage.contact_id == contact.id, RefChatMessage.user_id == current_user.id)
            .order_by(RefChatMessage.created_at.asc())
            .all()
        )
        ai_result = generate_initial_draft(contact, job, current_user, chat_history)

    elif kind == "text" and state in DRAFT_STATES:
        # revise_draft works on any draft (initial / followup_1 / followup_2);
        # the AI doesn't care what type the OutreachMessage is, just the text.
        job = _load_job_owned(job_id, current_user, db)
        chat_history = (
            db.query(RefChatMessage)
            .filter(RefChatMessage.contact_id == contact.id, RefChatMessage.user_id == current_user.id)
            .order_by(RefChatMessage.created_at.asc())
            .all()
        )
        existing_msg = _current_draft_message_for_contact(db, contact)
        current_draft = existing_msg.message if existing_msg else ""
        user_instruction = (content.get("text") or "").strip()
        edit_number = DRAFT_EDITS_INITIAL - max(0, edits_left_after or 0)
        ai_result = revise_draft(
            contact, job, current_user, chat_history,
            current_draft, user_instruction, edit_number,
        )

    elif kind == "reply_paste":
        # REF-30: classify the pasted reply. parse_reply has its own try/except
        # fallback (returns uncategorized-low on failure) so the chat continues
        # even when AI is down.
        reply_text_val = (content.get("text") or "").strip()
        job = _load_job_owned(job_id, current_user, db)
        ai_result = parse_reply(contact, job, current_user, reply_text_val)

    # --- REF-31: extracted_data preload for draft_reply_* actions ---
    # REF-32 extension: also fire generate_followup for the AI draft. Both
    # results flow into _generate_ref_response as explicit kwargs (DQ-H
    # precedent: no repurposing of ai_result which is reserved for the
    # AI generations earlier in this function).
    extracted_data_for_handler: Optional[dict] = None
    followup_ai_result: Optional[dict] = None
    if (
        kind == "action"
        and isinstance(req_action, str)
        and req_action.startswith("draft_reply_")
        and state == REPLIED
    ):
        last_reply = (
            db.query(ContactReply)
            .filter(ContactReply.contact_id == contact.id)
            .order_by(ContactReply.created_at.desc())
            .first()
        )
        extracted_data_for_handler = (last_reply.extracted_data if last_reply else {}) or {}

        # REF-32: AI call for the actual draft. Gated on having a
        # ContactReply (no reply → no reply_text → can't generate). The
        # try/except IS the fallback chain: any exception → ai_result
        # stays None → state machine falls back to REF-31's static template.
        # User always gets *something* in the draft_card.
        suffix = req_action[len("draft_reply_"):]
        intent_for_followup = DRAFT_ACTION_SUFFIX_TO_INTENT.get(suffix)
        if last_reply is not None and intent_for_followup is not None:
            try:
                job_for_followup = _load_job_owned(job_id, current_user, db)
                user_ctx = build_user_context(current_user)
                initial_text = _initial_outreach_text_for_contact(db, contact)
                followup_ai_result = generate_followup(
                    contact=contact,
                    job=job_for_followup,
                    user_context=user_ctx,
                    recruiter_reply_text=last_reply.reply_text,
                    intent_category=intent_for_followup,
                    extracted_data=extracted_data_for_handler,
                    initial_outreach_text=initial_text,
                )
            except Exception:
                logger.exception(
                    "generate_followup failed for contact=%s intent=%s; "
                    "falling back to REF-31 static template",
                    contact.id, intent_for_followup,
                )
                # followup_ai_result stays None → state machine uses template

    # --- Persist user message ---
    user_row = _persist_user_message(db, contact, body)
    db.flush()

    # --- Generate Ref's response ---
    # REF-30: reply_paste skips the main pure state machine and uses its own
    # response generator (which always emits classification chip + generic
    # text + per-category action buttons).
    if kind == "reply_paste":
        response = _generate_reply_capture_response(
            contact=contact,
            reply_text=(content.get("text") or "").strip(),
            parsed=ai_result or {},
        )
    else:
        response = _generate_ref_response(
            contact=contact,
            user_action={"kind": kind, "content": content},
            current_state=state,
            edits_left_after=edits_left_after,
            ai_result=ai_result,
            user=current_user,
            extracted_data=extracted_data_for_handler,
            followup_ai_result=followup_ai_result,
        )

    # --- Apply side effects ---
    for se in response.side_effects:
        if isinstance(se, CreateOutreach):
            # Used by: she_accepted (type=initial), draft_followup_1, draft_followup_2.
            # is_ai_generated=True for initial (REF-17 AI draft); False for followup
            # stubs (DD-B: real AI follow-up generation is deferred to Issue 6d).
            new_msg = OutreachMessage(
                job_id=contact.job_id,
                contact_id=contact.id,
                user_id=contact.user_id,
                message=se.text,
                type=se.type,
                is_ai_generated=(se.type == "initial"),
            )
            db.add(new_msg)
            db.flush()
            _recompute_and_persist(contact, db)
            # not_contacted -> drafted (for initial)
            # sent -> fu1_drafted (for followup_1)
            # fu1_sent -> fu2_drafted (for followup_2)
        elif isinstance(se, UpdateCurrentDraft):
            existing = _current_draft_message_for_contact(db, contact)
            if existing is None:
                raise HTTPException(
                    status_code=500,
                    detail=f"Current draft missing during edit (state={contact.lifecycle_status!r})",
                )
            existing.message = se.text
            db.flush()
            _recompute_and_persist(contact, db)  # idempotent (no state change)
        elif isinstance(se, DeleteCurrentDraft):
            # Undo from fu1_drafted / fu2_drafted: delete the followup row.
            existing = _current_draft_message_for_contact(db, contact)
            if existing is None:
                raise HTTPException(
                    status_code=500,
                    detail=f"Current draft missing during undo (state={contact.lifecycle_status!r})",
                )
            db.delete(existing)
            db.flush()
            _recompute_and_persist(contact, db)
            # fu1_drafted -> sent (after deleting fu1)
            # fu2_drafted -> fu1_sent (after deleting fu2)
        elif isinstance(se, UndoSent):
            # Undo from sent / fu1_sent / fu2_sent: clear sent_at on the
            # matching OutreachMessage so lifecycle reverts to the *_drafted state.
            existing = _current_draft_message_for_contact(db, contact)
            if existing is None:
                raise HTTPException(
                    status_code=500,
                    detail=f"Current sent message missing during undo (state={contact.lifecycle_status!r})",
                )
            existing.sent_at = None
            db.flush()
            _recompute_and_persist(contact, db)
            # sent -> drafted; fu1_sent -> fu1_drafted; fu2_sent -> fu2_drafted
        elif isinstance(se, UndoReplied):
            # REF-22 reserved this descriptor; REF-30 activated it for the
            # undo path from REPLIED. Clears replied_at; cascade reverts
            # to whichever sent state the OutreachMessage timestamps imply.
            contact.replied_at = None
            db.flush()
            _recompute_and_persist(contact, db)
            # replied -> sent / fu1_sent / fu2_sent
        elif isinstance(se, MarkConnected):
            # REF-28: not_contacted -> connected. Datetime is the only state
            # the cascade reads for this transition; no OutreachMessage is created.
            contact.connected_at = datetime.now(timezone.utc)
            db.flush()
            _recompute_and_persist(contact, db)
        elif isinstance(se, CaptureReply):
            # REF-30: persist ContactReply row + set replied_at + recompute cascade.
            # parsed dict carries intent_category, confidence, extracted_data,
            # chat_message, reasoning. raw_ai_response is the full parsed dict
            # (preserves chat_message + reasoning for offline evaluation).
            reply_row = ContactReply(
                contact_id=contact.id,
                user_id=contact.user_id,
                reply_text=se.reply_text,
                classified_intent=se.parsed.get("intent_category", "uncategorized"),
                classification_confidence=se.parsed.get("confidence", "low"),
                extracted_data=se.parsed.get("extracted_data") or {},
                raw_ai_response=se.parsed,
            )
            db.add(reply_row)
            contact.replied_at = datetime.now(timezone.utc)
            db.flush()
            _recompute_and_persist(contact, db)
            # sent / fu1_sent / fu2_sent -> replied

    # --- Persist Ref's messages ---
    ref_rows = _persist_ref_messages(db, contact, response.messages)
    db.flush()

    # --- Single commit ---
    db.commit()
    db.refresh(user_row)
    for r in ref_rows:
        db.refresh(r)

    new_messages = [_msg_to_dict(user_row)] + [_msg_to_dict(r) for r in ref_rows]
    return {
        "data": {
            "newMessages": new_messages,
            "requiresFollowup": response.requires_followup,
        },
        "meta": {},
        "error": None,
    }
