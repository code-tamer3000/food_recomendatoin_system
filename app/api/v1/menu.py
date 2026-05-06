from fastapi import APIRouter, Query
from typing import Optional

from app.schemas.menu import MenuResponse, MenuProductOut
from app.services.menu_service import get_full_menu, get_product, search_products

router = APIRouter(prefix="/menu", tags=["Menu"])


@router.get("", response_model=MenuResponse)
async def menu(category: Optional[str] = Query(None, description="Filter by category_slug")):
    return await get_full_menu(category_slug=category)


@router.get("/search", response_model=list[MenuProductOut])
async def search(q: str = Query(..., min_length=1), limit: int = Query(20, le=100)):
    return await search_products(q, limit)


@router.get("/{product_id}", response_model=MenuProductOut)
async def product(product_id: str):
    p = await get_product(product_id)
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")
    return p