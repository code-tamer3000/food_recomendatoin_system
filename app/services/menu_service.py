from app.db.mongodb import menu_col
from app.schemas.menu import MenuResponse, MenuCategoryOut, MenuProductOut


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def get_full_menu(category_slug: str | None = None) -> MenuResponse:
    query = {}
    if category_slug:
        query["category_slug"] = category_slug

    cursor = menu_col().find(query)
    by_section: dict[str, dict] = {}
    total = 0

    async for doc in cursor:
        doc = _clean(doc)
        slug = doc.get("section_slug") or doc.get("category_slug", "other")
        name = doc.get("section_name") or slug
        if slug not in by_section:
            by_section[slug] = {"name": name, "products": []}
        by_section[slug]["products"].append(MenuProductOut(**doc))
        total += 1

    categories = [
        MenuCategoryOut(slug=slug, name=v["name"], products=v["products"])
        for slug, v in by_section.items()
    ]
    return MenuResponse(categories=categories, total_products=total)


async def get_product(product_id: str) -> MenuProductOut | None:
    doc = await menu_col().find_one({"id": int(product_id)})
    if not doc:
        doc = await menu_col().find_one({"id": product_id})
    if not doc:
        return None
    return MenuProductOut(**_clean(doc))


async def search_products(q: str, limit: int = 20) -> list[MenuProductOut]:
    cursor = menu_col().find(
        {"$text": {"$search": q}},
        limit=limit
    )
    results = []
    async for doc in cursor:
        results.append(MenuProductOut(**_clean(doc)))
    # fallback: regex search if text index not built
    if not results:
        cursor = menu_col().find(
            {"name": {"$regex": q, "$options": "i"}},
            limit=limit
        )
        async for doc in cursor:
            results.append(MenuProductOut(**_clean(doc)))
    return results