from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()


class GenerateFollowUpRequest(BaseModel):
    outreach_message_id: str


@router.get("/{job_id}/follow-up")
def list_follow_ups(job_id: str):
    return {"data": [], "meta": {}, "error": None}


@router.post("/{job_id}/follow-up/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_follow_up(job_id: str, body: GenerateFollowUpRequest):
    # TODO: publish to follow-up-generation queue
    return {"data": None, "meta": {}, "error": None}


@router.patch("/{job_id}/follow-up/{follow_up_id}")
def update_follow_up(job_id: str, follow_up_id: str):
    return {"data": None, "meta": {}, "error": None}
