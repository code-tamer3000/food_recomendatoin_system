from typing import Optional
from pydantic import BaseModel, Field


class OrderProduct(BaseModel):
    product_id: str
    quantity: int
    price: float


class Order(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    order_id: Optional[str] = None
    user_id: str
    user_persona: Optional[str] = None
    products: list[OrderProduct] = []
    total_price: float = 0.0
    created_at: Optional[str] = None

    model_config = {"populate_by_name": True, "extra": "allow"}