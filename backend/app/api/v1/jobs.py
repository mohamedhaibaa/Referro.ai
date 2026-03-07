from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class CreateJobRequest(BaseModel):
    source_url: str


class PatchJobRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None


@router.get("")
def list_jobs():
    # TODO: return current user's jobs with pagination
    return {"data": [], "meta": {"page": 1, "page_size": 20, "total": 0}, "error": None}


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_job(body: CreateJobRequest):
    # TODO: create job row, publish to job-parsing queue, return workflow_run_id
    return {"data": None, "meta": {}, "error": None}


@router.get("/{job_id}")
def get_job(job_id: str):
    # TODO: return full job detail
    return {"data": None, "meta": {}, "error": None}


@router.patch("/{job_id}")
def update_job(job_id: str, body: PatchJobRequest):
    # TODO: update job fields
    return {"data": None, "meta": {}, "error": None}


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: str):
    # TODO: soft delete job
    return
