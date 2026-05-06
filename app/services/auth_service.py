from datetime import datetime
from typing import Optional
from bson import ObjectId

from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.db.mongodb import users_col
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.schemas.user import UserPublic


def _doc_to_public(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        username=doc["username"],
        email=doc["email"],
        full_name=doc.get("full_name"),
        phone=doc.get("phone"),
        avatar_url=doc.get("avatar_url"),
        addresses=doc.get("addresses", []),
        persona=doc.get("persona"),
        cart_count=len(doc.get("cart", [])),
        is_admin=doc.get("is_admin", False),
    )

# app/services/auth_service.py

async def register_user(data: RegisterRequest) -> dict:
    col = users_col()
    if await col.find_one({"email": data.email}):
        raise ValueError("Email already registered")
    if await col.find_one({"username": data.username}):
        raise ValueError("Username already taken")

    # Валидация длины пароля до хэширования
    if len(data.password.encode("utf-8")) > 72:
        raise ValueError("Password is too long (max 72 bytes)")
    if len(data.password) < 6:
        raise ValueError("Password must be at least 6 characters")

    try:
        hashed = hash_password(data.password)
    except Exception as e:
        raise ValueError(f"Password hashing failed: {e}")

    doc = {
        "username": data.username,
        "email": data.email,
        "hashed_password": hashed,
        "full_name": data.full_name,
        "phone": data.phone,
        "avatar_url": None,
        "addresses": [],
        "cart": [],
        "persona": None,
        "is_active": True,
        "is_admin": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id

    return {
        "tokens": TokenResponse(
            access_token=create_access_token(str(result.inserted_id)),
            refresh_token=create_refresh_token(str(result.inserted_id)),
        ),
        "user": _doc_to_public(doc),
    }


async def login_user(data: LoginRequest) -> dict:
    col = users_col()
    doc = await col.find_one(
        {"$or": [{"email": data.username}, {"username": data.username}]}
    )
    if not doc or not verify_password(data.password, doc["hashed_password"]):
        raise ValueError("Invalid credentials")
    if not doc.get("is_active", True):
        raise ValueError("Account disabled")

    return {
        "tokens": TokenResponse(
            access_token=create_access_token(str(doc["_id"])),
            refresh_token=create_refresh_token(str(doc["_id"])),
        ),
        "user": _doc_to_public(doc),
    }


async def refresh_tokens(refresh_token: str) -> TokenResponse:
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise ValueError("Not a refresh token")
    doc = await users_col().find_one({"_id": ObjectId(payload["sub"])})
    if not doc:
        raise ValueError("User not found")
    return TokenResponse(
        access_token=create_access_token(payload["sub"]),
        refresh_token=create_refresh_token(payload["sub"]),
    )


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await users_col().find_one({"_id": ObjectId(user_id)})