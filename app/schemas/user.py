from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import Address, CartItem


class UserPublic(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    addresses: list[Address] = []
    persona: Optional[str] = None
    cart_count: int = 0
    is_admin: bool = False


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    persona: Optional[str] = None


class AddressAddRequest(BaseModel):
    street: str
    city: str
    zip_code: Optional[str] = None
    notes: Optional[str] = None


class CartAddRequest(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int = 1
    modification_id: Optional[str] = None
    modification_name: Optional[str] = None


class CartUpdateRequest(BaseModel):
    product_id: str
    modification_id: Optional[str] = None
    quantity: int   # 0 = удалить


class CartResponse(BaseModel):
    items: list[CartItem]
    total: float
    count: int