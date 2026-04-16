from decimal import Decimal
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.user import User
from app.db.models.credit import CreditTransaction, PLAN_GRANT
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    db.flush()  # get user.id before commit

    user.credits_remaining = Decimal("3.0")
    user.credits_total = Decimal("3.0")
    user.plan_tier = "trial"
    db.add(CreditTransaction(
        user_id=user.id,
        job_id=None,
        amount=Decimal("3.0"),
        transaction_type=PLAN_GRANT,
    ))
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return {
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "creditsRemaining": float(user.credits_remaining),
                "planTier": user.plan_tier,
            },
        },
        "error": None,
    }


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    return {
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "creditsRemaining": float(user.credits_remaining),
                "planTier": user.plan_tier,
            },
        },
        "error": None,
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    # JWT is stateless — client drops the token
    return
