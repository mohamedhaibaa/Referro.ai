from fastapi import APIRouter, status

router = APIRouter()


@router.get("/{job_id}/flash-cards")
def list_flash_cards(job_id: str):
    return {"data": [], "meta": {}, "error": None}


@router.post("/{job_id}/flash-cards/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_flash_cards(job_id: str):
    # TODO: publish to flash-card-generation queue
    return {"data": None, "meta": {}, "error": None}
