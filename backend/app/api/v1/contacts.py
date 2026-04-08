from fastapi import APIRouter, status

router = APIRouter()


@router.get("/{job_id}/contacts")
def list_contacts(job_id: str):
    # TODO: return contacts for job
    return {"data": [], "meta": {}, "error": None}


@router.post("/{job_id}/contacts/discover", status_code=status.HTTP_202_ACCEPTED)
def discover_contacts(job_id: str):
    # TODO: publish to contact-discovery queue, return workflow_run_id
    return {"data": None, "meta": {}, "error": None}
