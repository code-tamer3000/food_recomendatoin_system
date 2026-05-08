from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class Address(BaseModel):
    street: str
    city: str
    zip_code: Optional[str] = None
    notes: Optional[str] = None


class CartItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int = 1
    modification_id: Optional[str] = None
    modification_name: Optional[str] = None


class UserInDB(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    username: str
    email: EmailStr
    hashed_password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    addresses: list[Address] = []
    cart: list[CartItem] = []
    persona: Optional[str] = None   # pizzalover / sushilover / balanced / partymaker
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}