from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class NotesBody(BaseModel):
    content: str


@router.get("/{job_id}/notes")
def get_notes(job_id: str):
    return {"data": [], "meta": {}, "error": None}


@router.patch("/{job_id}/notes")
def update_notes(job_id: str, body: NotesBody):
    return {"data": None, "meta": {}, "error": None}
