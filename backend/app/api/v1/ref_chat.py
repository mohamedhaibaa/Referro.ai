"""REF-13: chat-driven outreach for not_contacted and drafted lifecycle states.

Stub-driven for now. The pure state machine (`_generate_ref_response`) returns
canned messages + side-effect descriptors. The real Azure agent plugs in here
in REF-17 — see TODO(REF-17) markers.

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
from app.db.models.job import Contact, OutreachMessage, RefChatMessage
from app.db.models.user import User
from app.db.session import get_db

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
VALID_USER_ACTIONS = {
    ACTION_SENT_CONNECTION,
    ACTION_SHE_ACCEPTED,
    ACTION_APPROVE_DRAFT,
    ACTION_MARK_SENT,
}

DRAFTED = "drafted"


# --- Request body ---

class RefChatPostRequest(BaseModel):
    kind: Literal["text", "action"]
    content: dict
    edits_left: Optional[int] = None  # client hint, server re-derives


# --- Side-effect descriptors (resolved by handler, not by the pure function) ---

@dataclass
class CreateInitialOutreach:
    text: str


@dataclass
class UpdateInitialOutreach:
    text: str


SideEffect = Union[CreateInitialOutreach, UpdateInitialOutreach]


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


# --- Stub draft text + intel card ---

def _stub_draft(contact: Contact) -> str:
    """Placeholder until the real Azure agent drafts.
    TODO(REF-17): Replace with Azure agent draft-generation."""
    first = (contact.full_name or "there").split(" ")[0]
    company = contact.company or "the team"
    return (
        f"Hi {first},\n\n"
        f"Came across your work at {company} and noticed you've been there for a while. "
        "I'm exploring opportunities in a similar space and would love to hear how "
        "you got into the team.\n\n"
        "Would you be open to a quick 15-minute chat?\n\n"
        "Thanks!"
    )


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


# --- Pure state machine ---

def _generate_ref_response(
    contact: Contact,
    user_action: dict,
    current_state: str,
    edits_left_after: Optional[int],
) -> RefResponse:
    """Pure: (state, action) -> Ref's reply messages + side effects.
    The handler executes side effects + persists. No DB calls in this function.

    `edits_left_after` is "edits remaining AFTER this incoming user text edit",
    not before. The caller computes this by counting prior user text rows.
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
                    _action("🎉 She accepted! (simulate)", ACTION_SHE_ACCEPTED, primary=True),
                ]},
            },
        ])

    if current_state == NOT_CONTACTED and kind == "action" and action == ACTION_SHE_ACCEPTED:
        stub = _stub_draft(contact)
        # TODO(REF-17): Replace stub draft with Azure agent draft-generation.
        return RefResponse(
            messages=[
                {
                    "role": ROLE_REF, "kind": KIND_TEXT,
                    "content": {
                        "text": (
                            "Let's go. Time to send the actual outreach. Here's what "
                            "I'd open with — tell me what to tweak, or hit \"Looks "
                            "fire 🔥\" if it's good."
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
                {
                    "role": ROLE_REF, "kind": KIND_ACTIONS,
                    "content": {"actions": [
                        _action("📝 Edit", "edit_draft", primary=False),
                        _action("Looks fire 🔥", ACTION_APPROVE_DRAFT, primary=True),
                    ]},
                },
            ],
            side_effects=[CreateInitialOutreach(text=stub)],
        )

    # State: drafted ----------------------------------------------------------

    if current_state == DRAFTED and kind == "text":
        new_user_text = (content.get("text") or "").strip()
        # Stub revision — trivially derive a revised draft from the user's instruction.
        # Real agent will rewrite the existing draft per the instruction.
        # TODO(REF-17): Replace with Azure agent revision.
        version = (DRAFT_EDITS_INITIAL - max(0, edits_left_after or 0))
        revised = new_user_text + f"  [v{version}]"

        left = max(0, edits_left_after or 0)
        if left > 0:
            tip = (
                f"Tightened it up 🎯 {left} edit{'s' if left != 1 else ''} left "
                "— or hit \"Looks fire 🔥\" when ready."
            )
        else:
            tip = "Tightened it up 🎯 No more edits — \"Looks fire 🔥\" when you're ready."

        actions = [_action("Looks fire 🔥", ACTION_APPROVE_DRAFT, primary=True)]
        if left > 0:
            actions.insert(0, _action("📝 Edit", "edit_draft", primary=False))

        return RefResponse(
            messages=[
                {"role": ROLE_REF, "kind": KIND_TEXT, "content": {"text": tip}},
                {
                    "role": ROLE_REF, "kind": KIND_DRAFT,
                    "content": {
                        "text": revised,
                        "edits_left": left,
                        "show_counter": True,
                    },
                },
                {"role": ROLE_REF, "kind": KIND_ACTIONS, "content": {"actions": actions}},
            ],
            side_effects=[UpdateInitialOutreach(text=revised)],
        )

    if current_state == DRAFTED and kind == "action" and action == ACTION_APPROVE_DRAFT:
        return RefResponse(messages=[
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        "Let's go 🚀 Copy it, paste into LinkedIn, then come back "
                        "and hit \"Mark sent.\""
                    ),
                },
            },
            {
                "role": ROLE_REF, "kind": KIND_ACTIONS,
                "content": {"actions": [
                    _action("📋 Copy message", "copy", primary=False),
                    _action("🔗 Open LinkedIn", "open_linkedin", primary=False),
                    _action("✅ Mark sent", ACTION_MARK_SENT, primary=True),
                ]},
            },
        ])

    if current_state == DRAFTED and kind == "action" and action == ACTION_MARK_SENT:
        return RefResponse(
            messages=[{
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {
                    "text": (
                        f"Sent! 📤 The ball's in {first}'s court now. I'll check "
                        "back when she replies."
                    ),
                },
            }],
            requires_followup="mark_sent",
        )

    # No-op fallthrough (shouldn't be reached given handler-side validation).
    return RefResponse()


# --- DB helpers ---

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


def _count_user_text_messages(db: Session, contact: Contact, user_id: uuid.UUID) -> int:
    return db.query(func.count(RefChatMessage.id)).filter(
        RefChatMessage.contact_id == contact.id,
        RefChatMessage.user_id == user_id,
        RefChatMessage.role == ROLE_USER,
        RefChatMessage.kind == KIND_TEXT,
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

    if state == NOT_CONTACTED:
        seed = [
            {
                "role": ROLE_REF, "kind": KIND_INTEL,
                "content": _intel_card_content(contact),
            },
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
    elif state == DRAFTED:
        existing_msg = _initial_message_for_contact(db, contact)
        if existing_msg is None:
            raise HTTPException(
                status_code=400,
                detail="Drafted contact has no initial message — inconsistent state",
            )
        seed = [
            {
                "role": ROLE_REF, "kind": KIND_INTEL,
                "content": _intel_card_content(contact),
            },
            {
                "role": ROLE_REF, "kind": KIND_TEXT,
                "content": {"text": "Picking up where we left off — here's your current draft."},
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
                "content": {"actions": [
                    _action("📝 Edit", "edit_draft", primary=False),
                    _action("Looks fire 🔥", ACTION_APPROVE_DRAFT, primary=True),
                ]},
            },
        ]
    else:
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
    if kind == "action":
        action = content.get("action")
        if action not in VALID_USER_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action!r}")

        if action == ACTION_SENT_CONNECTION and state != NOT_CONTACTED:
            raise HTTPException(
                status_code=400,
                detail=f"'sent_connection_request' only valid in 'not_contacted' (current: {state!r})",
            )
        if action == ACTION_SHE_ACCEPTED:
            if state != NOT_CONTACTED:
                raise HTTPException(
                    status_code=400,
                    detail=f"'she_accepted' only valid in 'not_contacted' (current: {state!r})",
                )
            if _initial_message_for_contact(db, contact) is not None:
                raise HTTPException(
                    status_code=409,
                    detail="An initial outreach message already exists for this contact",
                )
        if action == ACTION_APPROVE_DRAFT and state != DRAFTED:
            raise HTTPException(
                status_code=400,
                detail=f"'approve_draft' only valid in 'drafted' (current: {state!r})",
            )
        if action == ACTION_MARK_SENT and state != DRAFTED:
            raise HTTPException(
                status_code=400,
                detail=f"'mark_sent' only valid in 'drafted' (current: {state!r})",
            )

    elif kind == "text":
        text_val = (content.get("text") or "").strip()
        if not text_val:
            raise HTTPException(status_code=400, detail="text content cannot be empty")
        if state != DRAFTED:
            raise HTTPException(
                status_code=400,
                detail=f"Free-text edits only accepted in 'drafted' (current: {state!r})",
            )

    else:
        # Pydantic Literal already enforces this; defensive only.
        raise HTTPException(status_code=400, detail=f"Unknown kind: {kind!r}")

    # Edits-left server-side check (counts user text messages persisted so far).
    edits_left_after: Optional[int] = None
    if kind == "text":
        prior_edits = _count_user_text_messages(db, contact, current_user.id)
        if prior_edits >= DRAFT_EDITS_INITIAL:
            raise HTTPException(status_code=400, detail="No edits remaining for this draft")
        edits_left_after = DRAFT_EDITS_INITIAL - prior_edits - 1
        # body.edits_left is a hint; if it disagrees we trust the server count.

    # --- Persist user message ---
    user_row = _persist_user_message(db, contact, body)
    db.flush()

    # --- Generate Ref's response (pure) ---
    response = _generate_ref_response(
        contact=contact,
        user_action={"kind": kind, "content": content},
        current_state=state,
        edits_left_after=edits_left_after,
    )

    # --- Apply side effects ---
    for se in response.side_effects:
        if isinstance(se, CreateInitialOutreach):
            new_msg = OutreachMessage(
                job_id=contact.job_id,
                contact_id=contact.id,
                user_id=contact.user_id,
                message=se.text,
                type="initial",
                is_ai_generated=False,
            )
            db.add(new_msg)
            db.flush()
            _recompute_and_persist(contact, db)  # NOT_CONTACTED -> drafted
        elif isinstance(se, UpdateInitialOutreach):
            existing = _initial_message_for_contact(db, contact)
            if existing is None:
                raise HTTPException(
                    status_code=500,
                    detail="Initial message missing during edit",
                )
            existing.message = se.text
            db.flush()
            _recompute_and_persist(contact, db)  # idempotent for drafted

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
