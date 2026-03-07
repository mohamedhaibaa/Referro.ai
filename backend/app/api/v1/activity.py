from fastapi import APIRouter

router = APIRouter()


@router.get("/{job_id}/activity")
def list_activity(job_id: str):
    # TODO: return activity log for job, newest first
    return {"data": [], "meta": {}, "error": None}
