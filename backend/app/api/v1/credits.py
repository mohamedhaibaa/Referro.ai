from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/me")
def get_my_credits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        "data": {
            "creditsRemaining": float(current_user.credits_remaining),
            "creditsTotal": float(current_user.credits_total),
            "planTier": current_user.plan_tier,
        },
        "meta": {},
        "error": None,
    }
