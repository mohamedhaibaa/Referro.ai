from fastapi import APIRouter, status, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.job import Job, JobMilestone, Contact
from app.db.models.user import User
from app.api.deps import get_current_user
from app.services import queue

router = APIRouter()


class CreateJobRequest(BaseModel):
    url: str
    title: str = ""
    company: str = ""


class PatchJobRequest(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    due_date: Optional[str] = None
    progress: Optional[int] = None
    fit_score: Optional[str] = None
    work_mode: Optional[str] = None
    role_family: Optional[str] = None


class PatchMilestonesRequest(BaseModel):
    resume_tailored: Optional[bool] = None
    contact_selected: Optional[bool] = None
    outreach_sent: Optional[bool] = None
    follow_up_sent: Optional[bool] = None
    reply_received: Optional[bool] = None
    interview_scheduled: Optional[bool] = None
    interview_prep_1: Optional[bool] = None
    interview_prep_2: Optional[bool] = None
    interview_prep_3: Optional[bool] = None
    outcome_recorded: Optional[bool] = None


def _job_to_dict(job: Job, contact_statuses: list[str] | None = None) -> dict:
    return {
        "id": str(job.id),
        "title": job.title,
        "company": job.company,
        "companyLogoUrl": job.company_logo_url,
        "url": job.url,
        "description": job.description,
        "status": job.status,
        "fitScore": job.fit_score,
        "workMode": job.work_mode,
        "roleFamily": job.role_family,
        "dueDate": job.due_date.isoformat() if job.due_date else None,
        "progress": job.progress,
        "contactStatuses": contact_statuses or [],
        "createdAt": job.created_at.isoformat(),
        "updatedAt": job.updated_at.isoformat(),
    }


def _contact_statuses_for_job(job_id, user_id, db: Session) -> list[str]:
    rows = db.query(Contact.lifecycle_status).filter(
        Contact.job_id == job_id,
        Contact.user_id == user_id,
        Contact.is_selected == True,  # noqa: E712
    ).all()
    return [r[0] for r in rows if r[0]]


def _milestone_to_dict(m: JobMilestone) -> dict:
    return {
        "resumeTailored": m.resume_tailored,
        "contactSelected": m.contact_selected,
        "outreachSent": m.outreach_sent,
        "followUpSent": m.follow_up_sent,
        "replyReceived": m.reply_received,
        "interviewScheduled": m.interview_scheduled,
        "interviewPrep1": m.interview_prep_1,
        "interviewPrep2": m.interview_prep_2,
        "interviewPrep3": m.interview_prep_3,
        "outcomeRecorded": m.outcome_recorded,
    }


@router.get("")
def list_jobs(
    archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(Job)
        .filter(Job.user_id == current_user.id, Job.is_deleted == archived)
        .order_by(Job.created_at.desc())
        .all()
    )

    # Bulk-load selected contacts' statuses grouped by job
    rows = db.query(Contact.job_id, Contact.lifecycle_status).filter(
        Contact.user_id == current_user.id,
        Contact.is_selected == True,  # noqa: E712
    ).all()
    by_job: dict = {}
    for jid, status_str in rows:
        if not status_str:
            continue
        by_job.setdefault(jid, []).append(status_str)

    return {
        "data": [_job_to_dict(j, by_job.get(j.id, [])) for j in jobs],
        "meta": {"total": len(jobs)},
        "error": None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_job(
    body: CreateJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = Job(
        user_id=current_user.id,
        url=body.url,
        title=body.title,
        company=body.company,
        status="Interested",
        progress=0,
    )
    db.add(job)
    db.flush()

    milestone = JobMilestone(job_id=job.id, user_id=current_user.id)
    db.add(milestone)
    db.flush()

    db.commit()

    # Publish to job-parsing queue
    run = queue.publish_job_parsing(db, current_user.id, job.id, body.url)

    db.refresh(job)
    return {
        "data": {**_job_to_dict(job), "workflowRunId": str(run.id)},
        "error": None,
    }


@router.get("/{job_id}")
def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
        Job.is_deleted == False,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"data": _job_to_dict(job, _contact_statuses_for_job(job.id, current_user.id, db)), "error": None}


@router.patch("/{job_id}")
def update_job(
    job_id: str,
    body: PatchJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
        Job.is_deleted == False,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "due_date" and value:
            from datetime import date
            job.due_date = date.fromisoformat(value)
        else:
            setattr(job, field, value)

    if body.status in ("Interviewing", "Closed"):
        db.query(Contact).filter(
            Contact.job_id == job.id,
            Contact.user_id == current_user.id,
            Contact.profile_data.isnot(None),
        ).update({"profile_data": None}, synchronize_session=False)

    db.commit()
    db.refresh(job)
    return {"data": _job_to_dict(job, _contact_statuses_for_job(job.id, current_user.id, db)), "error": None}


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
        Job.is_deleted == False,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.is_deleted = True
    db.commit()
    return


@router.post("/{job_id}/restore")
def restore_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.is_deleted:
        raise HTTPException(status_code=400, detail="Job is not archived")

    job.is_deleted = False
    db.commit()
    db.refresh(job)
    return {
        "data": _job_to_dict(job, _contact_statuses_for_job(job.id, current_user.id, db)),
        "error": None,
    }


@router.get("/{job_id}/milestones")
def get_milestones(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    milestone = db.query(JobMilestone).filter(
        JobMilestone.job_id == job_id,
        JobMilestone.user_id == current_user.id,
    ).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestones not found")
    return {"data": _milestone_to_dict(milestone), "error": None}


@router.patch("/{job_id}/milestones")
def update_milestones(
    job_id: str,
    body: PatchMilestonesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    milestone = db.query(JobMilestone).filter(
        JobMilestone.job_id == job_id,
        JobMilestone.user_id == current_user.id,
    ).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestones not found")

    if body.contact_selected is True:
        selected_count = db.query(func.count(Contact.id)).filter(
            Contact.job_id == job_id,
            Contact.user_id == current_user.id,
            Contact.is_selected == True,  # noqa: E712
        ).scalar() or 0
        if selected_count < 1:
            raise HTTPException(
                status_code=400,
                detail="Select at least one contact before confirming.",
            )

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(milestone, field, value)

    db.commit()
    db.refresh(milestone)
    return {"data": _milestone_to_dict(milestone), "error": None}
