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

    cart_ids = {str(item["product_id"]) for item in user.get("cart", [])}

    user_id = str(user.get("user_id") or user["_id"])
    raw_recs, is_cold = model.recommend(cart_product_ids=cart_ids, topn=top_n + len(cart_ids))

    items = []
    for pid, score in raw_recs:
        pid_str = str(pid)

        if pid_str in cart_ids:
            continue

        query = [{"id": pid}, {"id": pid_str}, {"_id": pid_str}]
        if pid_str.isdigit():
            query.insert(0, {"id": int(pid_str)})

        doc = await menu_col().find_one(
            {"$or": query},
            {"name": 1, "price": 1, "category_slug": 1, "slug": 1},
        )

        name = doc.get("name", f"Product {pid_str}") if doc else f"Product {pid_str}"

        items.append(
            RecommendationItem(
                product_id=pid_str,
                name=name,
                score=round(score, 4),
                price=doc.get("price") if doc else None,
                category_slug=doc.get("category_slug") if doc else None,
            )
        )

        if len(items) >= top_n:
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