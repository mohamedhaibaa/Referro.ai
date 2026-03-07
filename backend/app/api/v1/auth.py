from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    # TODO: hash password, insert user into DB, return user
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/login")
def login(body: LoginRequest):
    # TODO: verify credentials, return JWT
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    # TODO: invalidate token / clear session
    return
