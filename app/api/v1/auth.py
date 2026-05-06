from fastapi import APIRouter, HTTPException, status

from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.schemas.user import UserPublic
from app.services.auth_service import register_user, login_user, refresh_tokens
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Auth"])


class AuthResponse(BaseModel):
    tokens: TokenResponse
    user: UserPublic


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest):
    try:
        result = await register_user(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AuthResponse(**result)


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    try:
        result = await login_user(data)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return AuthResponse(**result)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest):
    try:
        return await refresh_tokens(data.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))