from fastapi import APIRouter

router = APIRouter()


@router.get("")
def get_dashboard():
    # TODO: compute real metrics from DB for current user
    return {"data": None, "meta": {}, "error": None}
