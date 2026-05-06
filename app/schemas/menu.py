from pydantic import BaseModel
from typing import Optional, Any


class MenuProductOut(BaseModel):
    id: Any
    name: Optional[str] = None
    slug: Optional[str] = None
    category_slug: Optional[str] = None
    section_name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    rating: Optional[float] = None
    modifications: Optional[list] = None
    nutrition: Optional[dict] = None
    main_tags: Optional[list] = None
    model_config = {"extra": "allow"}


class MenuCategoryOut(BaseModel):
    slug: str
    name: str
    products: list[MenuProductOut]


class MenuResponse(BaseModel):
    categories: list[MenuCategoryOut]
    total_products: int


class RecommendationItem(BaseModel):
    product_id: str
    name: str
    score: float
    price: Optional[float] = None
    category_slug: Optional[str] = None


class RecommendationsResponse(BaseModel):
    user_id: str
    recommendations: list[RecommendationItem]
    is_cold_start: bool = False