from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.job import Job, JobMilestone
from app.db.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = db.query(Job).filter(Job.user_id == current_user.id, Job.is_deleted == False).all()

    total = len(jobs)
    by_status: dict = {}
    for job in jobs:
        by_status[job.status] = by_status.get(job.status, 0) + 1

    outreach_sent = by_status.get("Outreach Sent", 0) + by_status.get("Replied", 0)
    meetings = by_status.get("Meeting Booked", 0) + by_status.get("Interviewing", 0)
    offers = by_status.get("Offer", 0)

    return {
        "data": {
            "totalJobs": total,
            "byStatus": by_status,
            "outreachSent": outreach_sent,
            "meetings": meetings,
            "offers": offers,
            "user": {"id": str(current_user.id), "email": current_user.email, "name": current_user.name},
        },
        "error": None,
    }
