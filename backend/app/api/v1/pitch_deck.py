from fastapi import APIRouter, status

router = APIRouter()


@router.get("/{job_id}/pitch-deck")
def get_pitch_deck(job_id: str):
    return {"data": None, "meta": {}, "error": None}


@router.post("/{job_id}/pitch-deck/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_pitch_deck(job_id: str):
    # TODO: publish to pitch-deck-generation queue
    return {"data": None, "meta": {}, "error": None}
