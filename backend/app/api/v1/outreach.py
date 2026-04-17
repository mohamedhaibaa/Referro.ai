import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, status, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.job import Contact, OutreachMessage
from app.db.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


VALID_TYPES = {"initial", "followup_1", "followup_2"}
NOT_CONTACTED = "not_contacted"


def _outreach_to_dict(m: OutreachMessage) -> dict:
    return {
        "id": str(m.id),
        "jobId": str(m.job_id),
        "contactId": str(m.contact_id),
        "type": m.type,
        "message": m.message,
        "isAiGenerated": m.is_ai_generated,
        "sentAt": m.sent_at.isoformat() if m.sent_at else None,
        "createdAt": m.created_at.isoformat(),
    }


def _derive_lifecycle_status(contact: Contact, messages: list[OutreachMessage]) -> str:
    """Source of truth for state. Called by every endpoint that mutates
    messages or replied_at. Server owns this — client reads only."""
    if contact.replied_at is not None:
        return "replied"

    # Order messages by creation time; newest-first for "is there a draft?" check
    ordered = sorted(messages, key=lambda m: m.created_at)
    by_type = {m.type: m for m in ordered}

    if "followup_2" in by_type:
        return "followup_2_sent" if by_type["followup_2"].sent_at else "followup_2_drafted"
    if "followup_1" in by_type:
        return "followup_1_sent" if by_type["followup_1"].sent_at else "followup_1_drafted"
    if "initial" in by_type:
        return "sent" if by_type["initial"].sent_at else "drafted"

    return NOT_CONTACTED


def _recompute_and_persist(contact: Contact, db: Session) -> None:
    messages = db.query(OutreachMessage).filter(
        OutreachMessage.contact_id == contact.id,
        OutreachMessage.user_id == contact.user_id,
    ).all()
    contact.lifecycle_status = _derive_lifecycle_status(contact, messages)


def _load_contact(job_id: str, contact_id: str, current_user: User, db: Session) -> Contact:
    contact = (
        db.query(Contact)
        .filter(
            Contact.id == uuid.UUID(contact_id),
            Contact.job_id == uuid.UUID(job_id),
            Contact.user_id == current_user.id,
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


def _load_outreach(job_id: str, outreach_id: str, current_user: User, db: Session) -> OutreachMessage:
    m = (
        db.query(OutreachMessage)
        .filter(
            OutreachMessage.id == uuid.UUID(outreach_id),
            OutreachMessage.job_id == uuid.UUID(job_id),
            OutreachMessage.user_id == current_user.id,
        )
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Outreach message not found")
    return m


class CreateOutreachRequest(BaseModel):
    type: str
    message: str
    is_ai_generated: bool = False


class UpdateOutreachRequest(BaseModel):
    message: Optional[str] = None
    sent_at: Optional[str] = None  # ISO timestamp or explicit None to unsend


@router.get("/{job_id}/contacts/{contact_id}/outreach")
def list_contact_outreach(
    job_id: str,
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _load_contact(job_id, contact_id, current_user, db)
    messages = (
        db.query(OutreachMessage)
        .filter(
            OutreachMessage.contact_id == uuid.UUID(contact_id),
            OutreachMessage.user_id == current_user.id,
        )
        .order_by(OutreachMessage.created_at.asc())
        .all()
    )
    return {
        "data": [_outreach_to_dict(m) for m in messages],
        "meta": {"count": len(messages)},
        "error": None,
    }


@router.post("/{job_id}/contacts/{contact_id}/outreach", status_code=status.HTTP_201_CREATED)
def create_outreach(
    job_id: str,
    contact_id: str,
    body: CreateOutreachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {sorted(VALID_TYPES)}")
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    contact = _load_contact(job_id, contact_id, current_user, db)

    # Only one row per (contact, type). If a draft already exists for this type,
    # return it instead of creating a duplicate (makes the auto-save endpoint idempotent).
    existing = (
        db.query(OutreachMessage)
        .filter(
            OutreachMessage.contact_id == contact.id,
            OutreachMessage.user_id == current_user.id,
            OutreachMessage.type == body.type,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An outreach of type '{body.type}' already exists for this contact",
        )

    m = OutreachMessage(
        job_id=uuid.UUID(job_id),
        contact_id=contact.id,
        user_id=current_user.id,
        message=body.message,
        type=body.type,
        is_ai_generated=body.is_ai_generated,
    )
    db.add(m)
    db.flush()

    _recompute_and_persist(contact, db)
    db.commit()
    db.refresh(m)
    return {"data": _outreach_to_dict(m), "meta": {}, "error": None}


@router.patch("/{job_id}/outreach/{outreach_id}")
def update_outreach(
    job_id: str,
    outreach_id: str,
    body: UpdateOutreachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = _load_outreach(job_id, outreach_id, current_user, db)

    if body.message is not None:
        if not body.message.strip():
            raise HTTPException(status_code=400, detail="message cannot be empty")
        m.message = body.message

    # sent_at: explicit None clears (un-send); a string sets; absent key leaves alone.
    fields = body.model_dump(exclude_unset=True)
    if "sent_at" in fields:
        if body.sent_at is None:
            m.sent_at = None
        else:
            try:
                m.sent_at = datetime.fromisoformat(body.sent_at.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="sent_at must be ISO-8601")

    contact = (
        db.query(Contact)
        .filter(Contact.id == m.contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if contact:
        _recompute_and_persist(contact, db)

    db.commit()
    db.refresh(m)
    return {"data": _outreach_to_dict(m), "meta": {}, "error": None}


@router.delete("/{job_id}/outreach/{outreach_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outreach(
    job_id: str,
    outreach_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = _load_outreach(job_id, outreach_id, current_user, db)
    contact_id = m.contact_id
    db.delete(m)
    db.flush()

    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if contact:
        _recompute_and_persist(contact, db)

    db.commit()
    return


# ---- Legacy job-level list endpoint (kept for compatibility; returns []) ----

@router.get("/{job_id}/outreach")
def list_outreach(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(OutreachMessage)
        .filter(
            OutreachMessage.job_id == uuid.UUID(job_id),
            OutreachMessage.user_id == current_user.id,
        )
        .order_by(OutreachMessage.created_at.asc())
        .all()
    )
    return {
        "data": [_outreach_to_dict(m) for m in messages],
        "meta": {"count": len(messages)},
        "error": None,
    }
