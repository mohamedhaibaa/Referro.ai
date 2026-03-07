from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()


class GenerateOutreachRequest(BaseModel):
    contact_id: str


@router.get("/{job_id}/outreach")
def list_outreach(job_id: str):
    return {"data": [], "meta": {}, "error": None}


@router.post("/{job_id}/outreach/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_outreach(job_id: str, body: GenerateOutreachRequest):
    # TODO: publish to outreach-generation queue
    return {"data": None, "meta": {}, "error": None}


@router.patch("/{job_id}/outreach/{outreach_id}")
def update_outreach(job_id: str, outreach_id: str):
    # TODO: mark sent, update message
    return {"data": None, "meta": {}, "error": None}
