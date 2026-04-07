import uuid
from fastapi import APIRouter, status, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.job import Job, Contact
from app.db.models.user import User
from app.api.deps import get_current_user
from app.services import queue

router = APIRouter()


def _infer_relationship(title: str | None) -> str:
    t = (title or "").lower()
    if any(w in t for w in ("recruit", "talent", "hr ", "human resource")):
        return "Recruiter"
    if any(w in t for w in ("hiring manager",)):
        return "Hiring Manager"
    if any(w in t for w in ("manager", "lead", "head of", "director", "vp ", "vice president")):
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
        "createdAt": c.created_at.isoformat(),
    }


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
        .order_by(Contact.relevance_score.desc())
        .all()
    )

    return {
        "data": [_contact_to_dict(c) for c in contacts],
        "meta": {"count": len(contacts)},
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


@router.post("/{job_id}/contacts/discover", status_code=status.HTTP_202_ACCEPTED)
def discover_contacts(
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

    wf = queue.publish_contact_discovery(db, current_user.id, job.id)

    return {
        "data": {"workflowRunId": str(wf.id)},
        "meta": {},
        "error": None,
    }
