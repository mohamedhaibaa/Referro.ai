import json
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, status, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.job import Job, Contact
from app.db.models.user import User
from app.db.models.credit import CreditTransaction, CAMPAIGN, REVISIT
from app.api.deps import get_current_user
from app.services import queue

SELECTION_CAP = 3
_PHOTO_KEYS = (
    "photo", "photoUrl", "profilePictureUrl", "pictureUrl",
    "avatarUrl", "picture", "profilePicture", "profile_picture_url",
)


def _extract_photo_url(profile_data: str | None) -> str | None:
    """Pull a photo URL out of the stored Apify profile blob. Defensive:
    returns None on any parse failure or missing/empty field."""
    if not profile_data:
        return None
    try:
        blob = json.loads(profile_data)
    except (ValueError, TypeError):
        return None
    if not isinstance(blob, dict):
        return None
    for key in _PHOTO_KEYS:
        val = blob.get(key)
        if isinstance(val, str) and val.strip():
            return val
    return None

router = APIRouter()


class DiscoverRequest(BaseModel):
    batch_number: int = 1
    round_number: int = 1


def _infer_relationship(title: str | None) -> str:
    t = (title or "").lower()
    if any(w in t for w in ("recruit", "talent", "hr ", "human resource")):
        return "Recruiter"
    if any(w in t for w in ("hiring manager",)):
        return "Hiring Manager"
    # "Account Manager", "Project Manager", "Product Manager" are individual contributor
    # roles, not team leads. Only match management titles that imply people leadership.
    if any(w in t for w in ("engineering manager", "development manager", "team lead",
                             "head of", "director", "vp ", "vice president")):
        return "Team Lead"
    if any(w in t for w in ("manager",)) and not any(
        w in t for w in ("account", "project", "product", "case", "client",
                          "relationship", "community", "social media", "content",
                          "brand", "campaign", "event", "office")
    ):
        return "Team Lead"
    return "Employee"


def _infer_confidence(score: int | None) -> str:
    if score is None:
        return "Low"
    if score >= 60:
        return "High"
    if score >= 35:
        return "Medium"
    return "Low"


def _contact_to_dict(c: Contact) -> dict:
    return {
        "id": str(c.id),
        "fullName": c.full_name,
        "title": c.title,
        "company": c.company,
        "location": c.location,
        "linkedinUrl": c.linkedin_url,
        "photoUrl": _extract_photo_url(c.profile_data),
        "university": c.university,
        "tenureMonths": c.tenure_months,
        "relevanceScore": c.relevance_score,
        "confidence": _infer_confidence(c.relevance_score),
        "relationship": _infer_relationship(c.title),
        "source": "LinkedIn",
        "batchNumber": c.batch_number,
        "roundNumber": c.round_number,
        "isSelected": c.is_selected,
        "lifecycleStatus": c.lifecycle_status,
        "repliedAt": c.replied_at.isoformat() if c.replied_at else None,
        "coffeeChatScheduledAt": c.coffee_chat_scheduled_at.isoformat() if c.coffee_chat_scheduled_at else None,
        "coffeeChatCompletedAt": c.coffee_chat_completed_at.isoformat() if c.coffee_chat_completed_at else None,
        "interviewScheduledAt": c.interview_scheduled_at.isoformat() if c.interview_scheduled_at else None,
        "interviewCompletedAt": c.interview_completed_at.isoformat() if c.interview_completed_at else None,
        "outcome": c.outcome,
        "outcomeRecordedAt": c.outcome_recorded_at.isoformat() if c.outcome_recorded_at else None,
        "createdAt": c.created_at.isoformat(),
    }


def _deduct_credits(user: User, amount: Decimal, transaction_type: str, job_id: uuid.UUID, db: Session):
    if user.credits_remaining < amount:
        raise HTTPException(status_code=402, detail="Insufficient credits")
    user.credits_remaining -= amount
    db.add(CreditTransaction(
        user_id=user.id,
        job_id=job_id,
        amount=-amount,
        transaction_type=transaction_type,
    ))


@router.get("/{job_id}/contacts")
def list_contacts(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = (
        db.query(Job)
        .filter(Job.id == uuid.UUID(job_id), Job.user_id == current_user.id, Job.is_deleted == False)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    contacts = (
        db.query(Contact)
        .filter(Contact.job_id == uuid.UUID(job_id), Contact.user_id == current_user.id)
        .order_by(Contact.round_number, Contact.batch_number, Contact.relevance_score.desc())
        .all()
    )

    return {
        "data": [_contact_to_dict(c) for c in contacts],
        "meta": {"count": len(contacts)},
        "error": None,
    }


@router.post("/{job_id}/contacts/discover")
def discover_contacts(
    job_id: str,
    body: DiscoverRequest = DiscoverRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job_uuid = uuid.UUID(job_id)
    job = (
        db.query(Job)
        .filter(Job.id == job_uuid, Job.user_id == current_user.id, Job.is_deleted == False)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Every batch triggers a new Apify call via the worker
    # Credit deduction disabled until results validated
    # if body.batch_number == 1:
    #     _deduct_credits(current_user, Decimal("1.0"), CAMPAIGN, job_uuid, db)
    wf = queue.publish_contact_discovery(
        db, current_user.id, job_uuid,
        batch_number=body.batch_number,
        round_number=body.round_number,
    )
    db.commit()

    return {
        "data": {
            "workflowRunId": str(wf.id),
            "batchNumber": body.batch_number,
            "hasMore": body.batch_number < 3,
        },
        "meta": {},
        "error": None,
    }


@router.post("/{job_id}/contacts/revisit", status_code=status.HTTP_202_ACCEPTED)
def revisit_contacts(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job_uuid = uuid.UUID(job_id)
    job = (
        db.query(Job)
        .filter(Job.id == job_uuid, Job.user_id == current_user.id, Job.is_deleted == False)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Determine the next round number
    max_round = db.query(func.max(Contact.round_number)).filter(
        Contact.job_id == job_uuid,
        Contact.user_id == current_user.id,
    ).scalar() or 0
    new_round = max_round + 1

    # _deduct_credits(current_user, Decimal("0.5"), REVISIT, job_uuid, db)
    wf = queue.publish_contact_discovery(
        db, current_user.id, job_uuid,
        batch_number=1,
        round_number=new_round,
    )
    db.commit()

    return {
        "data": {
            "workflowRunId": str(wf.id),
            "roundNumber": new_round,
            "batchNumber": 1,
            "hasMore": True,
        },
        "meta": {},
        "error": None,
    }


class PatchContactRequest(BaseModel):
    is_selected: Optional[bool] = None
    replied_at: Optional[str] = None
    coffee_chat_scheduled_at: Optional[str] = None
    coffee_chat_completed_at: Optional[str] = None
    interview_scheduled_at: Optional[str] = None
    interview_completed_at: Optional[str] = None
    outcome: Optional[str] = None
    outcome_recorded_at: Optional[str] = None


_TIMESTAMP_FIELDS = (
    "replied_at",
    "coffee_chat_scheduled_at",
    "coffee_chat_completed_at",
    "interview_scheduled_at",
    "interview_completed_at",
    "outcome_recorded_at",
)

_ACTIVITY_LABELS = {
    "replied_at":                "They replied",
    "coffee_chat_scheduled_at":  "Coffee chat scheduled",
    "coffee_chat_completed_at":  "Coffee chat completed",
    "interview_scheduled_at":    "Interview scheduled",
    "interview_completed_at":    "Interview completed",
}

_OUTCOME_LABELS = {
    "offer":              "Recorded outcome: got the offer",
    "rejected":           "Recorded outcome: rejected",
    "withdrew":           "Recorded outcome: withdrew",
    "not_right_person":   "Recorded outcome: not the right person",
    "not_a_fit":          "Recorded outcome: not a fit",
    "lost_touch":         "Recorded outcome: lost touch",
    "cancelled":          "Recorded outcome: cancelled",
    "company_cancelled":  "Recorded outcome: company cancelled",
}


def _parse_iso(value: str, field: str):
    from datetime import datetime
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be ISO-8601")


def _log_contact_milestone(db: Session, contact: Contact, description: str) -> None:
    from datetime import datetime, timezone
    from app.db.models.job import ActivityLog
    db.add(ActivityLog(
        job_id=contact.job_id,
        user_id=contact.user_id,
        contact_id=contact.id,
        type="contact_milestone",
        action=description,
        created_at=datetime.now(timezone.utc),
    ))


@router.patch("/{job_id}/contacts/{contact_id}")
def update_contact(
    job_id: str,
    contact_id: str,
    body: PatchContactRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone
    from app.api.v1.outreach import _recompute_and_persist, VALID_OUTCOMES

    job_uuid = uuid.UUID(job_id)
    contact = (
        db.query(Contact)
        .filter(
            Contact.id == uuid.UUID(contact_id),
            Contact.job_id == job_uuid,
            Contact.user_id == current_user.id,
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if body.is_selected is True and not contact.is_selected:
        selected_count = db.query(func.count(Contact.id)).filter(
            Contact.job_id == job_uuid,
            Contact.user_id == current_user.id,
            Contact.is_selected == True,  # noqa: E712
        ).scalar() or 0
        if selected_count >= SELECTION_CAP:
            raise HTTPException(
                status_code=400,
                detail=f"Selection cap of {SELECTION_CAP} contacts reached",
            )

    if body.is_selected is not None:
        contact.is_selected = body.is_selected

    fields = body.model_dump(exclude_unset=True)
    contact_name = contact.full_name or "contact"
    lifecycle_touched = False

    for field in _TIMESTAMP_FIELDS:
        if field not in fields:
            continue
        value = getattr(body, field)
        previous = getattr(contact, field)
        if value is None:
            setattr(contact, field, None)
        else:
            setattr(contact, field, _parse_iso(value, field))
        lifecycle_touched = True
        # Log setting transitions (not clears) for the 5 labeled fields
        if value is not None and previous is None and field in _ACTIVITY_LABELS:
            _log_contact_milestone(db, contact, f"{_ACTIVITY_LABELS[field]} for {contact_name}")

    if "outcome" in fields:
        if body.outcome is None:
            contact.outcome = None
            # Clearing outcome also clears recorded_at so it doesn't orphan
            contact.outcome_recorded_at = None
        else:
            if body.outcome not in VALID_OUTCOMES:
                raise HTTPException(
                    status_code=400,
                    detail=f"outcome must be one of {sorted(VALID_OUTCOMES)}",
                )
            previous_outcome = contact.outcome
            contact.outcome = body.outcome
            if "outcome_recorded_at" not in fields:
                contact.outcome_recorded_at = datetime.now(timezone.utc)
            if previous_outcome != body.outcome:
                _log_contact_milestone(
                    db, contact, f"{_OUTCOME_LABELS[body.outcome]} for {contact_name}",
                )
        lifecycle_touched = True

    if lifecycle_touched:
        _recompute_and_persist(contact, db)

    db.commit()
    db.refresh(contact)
    return {"data": _contact_to_dict(contact), "meta": {}, "error": None}


@router.delete("/{job_id}/contacts", status_code=status.HTTP_204_NO_CONTENT)
def delete_contacts(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = (
        db.query(Job)
        .filter(Job.id == uuid.UUID(job_id), Job.user_id == current_user.id, Job.is_deleted == False)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.query(Contact).filter(Contact.job_id == uuid.UUID(job_id), Contact.user_id == current_user.id).delete()
    db.commit()
