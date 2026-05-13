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
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.v1.outreach import NOT_CONTACTED, _recompute_and_persist
from app.db.models.job import Contact, Job, OutreachMessage, RefChatMessage
from app.db.models.user import User
from app.db.session import get_db
from app.services.ref_ai import generate_initial_draft, revise_draft

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
}

# Lifecycle state literals (mirrored from outreach._derive_lifecycle_status).
DRAFTED = "drafted"
SENT = "sent"
FU1_DRAFTED = "followup_1_drafted"
FU1_SENT = "followup_1_sent"
FU2_DRAFTED = "followup_2_drafted"
FU2_SENT = "followup_2_sent"

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
    kind: Literal["text", "action"]
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


SideEffect = Union[
    CreateOutreach,
    UpdateCurrentDraft,
    DeleteCurrentDraft,
    UndoSent,
    UndoReplied,
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
        _action("📨 Send message", "send_message", primary=True),
    ]}


def _sent_state_buttons(state: str) -> dict:
    """Action buttons after mark_sent — depends on which *_sent state we land in.
    fu2_sent has no draft_followup_3 (terminal follow-up cadence)."""
    actions = [_action("📨 They replied", ACTION_THEY_REPLIED, primary=True)]
    if state == SENT:
        actions.append(_action("📝 Draft follow-up", ACTION_DRAFT_FOLLOWUP_1, primary=False))
    elif state == FU1_SENT:
        actions.append(_action("📝 Draft another follow-up", ACTION_DRAFT_FOLLOWUP_2, primary=False))
    # FU2_SENT: no further followup button
    actions.append(_action("🔗 Open LinkedIn", "open_linkedin", primary=False))
    actions.append(_action("↩ Undo send", ACTION_UNDO, primary=False))
    return {"actions": actions}


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
) -> RefResponse:
    """Pure: (state, action) -> Ref's reply messages + side effects.
    The handler executes side effects + persists. No DB calls in this function.

    `edits_left_after` is "edits remaining AFTER this incoming user text edit",
    not before. The caller computes this by counting prior user text rows
    SINCE the current draft was created.

    `ai_result` is the parsed AI response dict (keys: chat, draft, play)
    pre-computed by the handler for branches that need AI generation.
    """
    first = (contact.full_name or "there").split(" ")[0]
    kind = user_action.get("kind")
    content = user_action.get("content") or {}
    action = content.get("action")

    # State: not_contacted ----------------------------------------------------

    if current_state == NOT_CONTACTED and kind == "action" and action == ACTION_SENT_CONNECTION:
        return RefResponse(messages=[
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        f"Nice. Connection requests usually take a day or two — "
                        f"I'll let you know when {first} accepts. (For demo: tap "
                        "below to simulate acceptance.)"
                    ),
                },
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": {"actions": [
                    _action("🎉 They accepted! (simulate)", ACTION_SHE_ACCEPTED, primary=True),
                ]},
            },
        ])

    if current_state == NOT_CONTACTED and kind == "action" and action == ACTION_SHE_ACCEPTED:
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
                    "content": {
                        "text": (
                            f"Sent! 📤 Ball's in {first}'s court now. I'll check "
                            "back when they reply."
                        ),
                    },
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

    intel = {
        "role": ROLE_REF, "kind": KIND_INTEL,
        "content": _intel_card_content(contact),
    }

    if state == NOT_CONTACTED:
        seed = [
            intel,
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        f"Alright, let's reach out to {first}. First step — send "
                        "a connection request on LinkedIn. Drop a quick note like "
                        "\"Hey, would love to connect 👋\" or just send the default."
                    ),
                },
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": {"actions": [
                    _action(
                        "I sent the connection request ✅",
                        ACTION_SENT_CONNECTION,
                        primary=True,
                    ),
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
        if state == SENT:
            text = (
                f"Sent! Ball's in {first}'s court. I'll check back when "
                "they reply."
            )
        elif state == FU1_SENT:
            text = (
                "Follow-up 1 sent. Bumps shake replies loose more often "
                "than you'd think."
            )
        else:  # FU2_SENT
            text = (
                "Final follow-up sent. If no reply, that's data — we "
                "pivot next."
            )
        seed = [
            intel,
            {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": text}},
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": _sent_state_buttons(state),
            },
        ]
    else:
        # replied / coffee_chat_* / interview_* / outcome_* — out of REF-22 scope.
        # Per DD-A, these route to PostReplyView via ContactPopup's conditional.
        # init_chat shouldn't be called for them (the conditional excludes them),
        # but stay defensive: clear 400 with a state-specific message.
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
            if state != NOT_CONTACTED:
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
        if action == ACTION_UNDO and state not in (SENT_STATES | {FU1_DRAFTED, FU2_DRAFTED}):
            # Undo from `drafted` is intentionally NOT supported in REF-22 —
            # it would revert to not_contacted and interact with the missing
            # `connected` lifecycle state (PD-1 / Issue 1).
            raise _validation_error(action, state)

    elif kind == "text":
        text_val = (content.get("text") or "").strip()
        if not text_val:
            raise HTTPException(status_code=400, detail="text content cannot be empty")
        if state not in DRAFT_STATES:
            raise _validation_error("text_edit", state)

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

    # --- Persist user message ---
    user_row = _persist_user_message(db, contact, body)
    db.flush()

    # --- Generate Ref's response (pure) ---
    response = _generate_ref_response(
        contact=contact,
        user_action={"kind": kind, "content": content},
        current_state=state,
        edits_left_after=edits_left_after,
        ai_result=ai_result,
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
            # Reserved for a future ticket that brings replied into chat.
            # Defensive: should never be produced by REF-22 code paths.
            raise HTTPException(
                status_code=500,
                detail="UndoReplied is reserved — no REF-22 branch emits it",
            )

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
