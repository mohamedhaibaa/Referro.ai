from fastapi import APIRouter

router = APIRouter()


@router.get("/actions")
def list_inbox_actions():
    # TODO: compute action items from jobs/outreach/follow-up state
    return {"data": [], "meta": {}, "error": None}


@router.patch("/{action_id}/complete")
def complete_action(action_id: str):
    return {"data": None, "meta": {}, "error": None}


@router.patch("/{action_id}/snooze")
def snooze_action(action_id: str):
    return {"data": None, "meta": {}, "error": None}
