from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.schemas.user import (
    UserPublic, UserUpdateRequest, AddressAddRequest,
    CartAddRequest, CartUpdateRequest, CartResponse,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return await user_service.get_profile(str(user["_id"]))


@router.patch("/me", response_model=UserPublic)
async def update_me(data: UserUpdateRequest, user: dict = Depends(get_current_user)):
    return await user_service.update_profile(str(user["_id"]), data)


# --- Addresses ---
@router.post("/me/addresses", response_model=UserPublic)
async def add_address(data: AddressAddRequest, user: dict = Depends(get_current_user)):
    return await user_service.add_address(str(user["_id"]), data)


@router.delete("/me/addresses/{index}", response_model=UserPublic)
async def delete_address(index: int, user: dict = Depends(get_current_user)):
    try:
        return await user_service.delete_address(str(user["_id"]), index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Cart CRUD ---
@router.get("/me/cart", response_model=CartResponse)
async def get_cart(user: dict = Depends(get_current_user)):
    return await user_service.get_cart(str(user["_id"]))


@router.post("/me/cart", response_model=CartResponse)
async def add_to_cart(req: CartAddRequest, user: dict = Depends(get_current_user)):
    return await user_service.add_to_cart(str(user["_id"]), req)


@router.put("/me/cart", response_model=CartResponse)
async def update_cart(req: CartUpdateRequest, user: dict = Depends(get_current_user)):
    return await user_service.update_cart_item(str(user["_id"]), req)


@router.delete("/me/cart", response_model=CartResponse)
async def clear_cart(user: dict = Depends(get_current_user)):
    return await user_service.clear_cart(str(user["_id"]))