from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from app.api.deps import get_current_user, get_current_admin
from app.ml.recommender import RecSysModel
from app.db.mongodb import menu_col
from app.schemas.menu import RecommendationsResponse, RecommendationItem

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/me", response_model=RecommendationsResponse)
async def my_recommendations(
    top_n: int = 10,
    user: dict = Depends(get_current_user),
):
    """
    Персональные рекомендации на основе SVD-модели.
    При холодном старте возвращает популярные товары.
    Также учитывает товары в текущей корзине пользователя.
    """
    model = RecSysModel.get()
    if not model.ready:
        raise HTTPException(
            status_code=503,
            detail="Recommendation model not loaded. Call POST /recommendations/train first.",
        )

    # Учитываем корзину: добавляем product_id из корзины в already_bought
    cart_ids = {item["product_id"] for item in user.get("cart", [])}

    user_id = str(user.get("user_id") or user["_id"])
    raw_recs, is_cold = model.recommend(user_id, top_n=top_n + len(cart_ids))

    # Enrich with menu data
    items = []
    for pid, score in raw_recs:
        if pid in cart_ids:
            continue   # не рекомендуем то, что уже в корзине
        doc = await menu_col().find_one(
            {"$or": [{"id": int(pid) if pid.isdigit() else pid}, {"_id": pid}]},
            {"name": 1, "price": 1, "category_slug": 1, "slug": 1},
        )
        name = doc.get("name", f"Product {pid}") if doc else f"Product {pid}"
        items.append(RecommendationItem(
            product_id=pid,
            name=name,
            score=round(score, 4),
            price=doc.get("price") if doc else None,
            category_slug=doc.get("category_slug") if doc else None,
        ))
        if len(items) == top_n:
            break

    return RecommendationsResponse(
        user_id=user_id,
        recommendations=items,
        is_cold_start=is_cold,
    )


@router.post("/train", dependencies=[Depends(get_current_admin)])
async def train_model(background_tasks: BackgroundTasks):
    """
    Admin only. Запускает обучение SVD-модели в фоне.
    """
    background_tasks.add_task(_do_train)
    return {"message": "Training started in background"}


async def _do_train():
    model = RecSysModel.get()
    await model.train_from_db()