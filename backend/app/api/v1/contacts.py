import uuid
from decimal import Decimal
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
        "university": c.university,
        "tenureMonths": c.tenure_months,
        "relevanceScore": c.relevance_score,
        "confidence": _infer_confidence(c.relevance_score),
        "relationship": _infer_relationship(c.title),
        "source": "LinkedIn",
        "batchNumber": c.batch_number,
        "roundNumber": c.round_number,
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
