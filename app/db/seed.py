"""
Запуск: python -m app.db.seed
Загружает cleaned_menu.json и synthetic_orders-2.json в MongoDB.
"""
import asyncio, json
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

settings = get_settings()
DATA_DIR = Path(__file__).parent.parent.parent / "data"


async def seed():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    # --- menu ---
    menu_path = DATA_DIR / "cleaned_menu.json"
    if menu_path.exists():
        raw: dict = json.loads(menu_path.read_text(encoding="utf-8"))
        docs = []
        for section_slug, section_data in raw.items():
            info = section_data.get("info", {})
            section_name = info.get("name", section_slug) if isinstance(info, dict) else section_slug
            for p in section_data.get("products", []):
                p["_id"] = str(p["id"])
                p["section_slug"] = section_slug
                p["section_name"] = section_name
                p["category_slug"] = p.get("categorySlug", section_slug)
                docs.append(p)
        for doc in docs:
            await db["menu"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
        print(f"[seed] menu: {len(docs)} products")
    else:
        print(f"[seed] SKIP menu: {menu_path} not found")

    # --- orders ---
    for fname in ("synthetic_orders.json", "synthetic_orders-2.json"):
        op = DATA_DIR / fname
        if op.exists():
            orders = json.loads(op.read_text(encoding="utf-8"))
            for o in orders:
                o["_id"] = str(o["order_id"])
                o["user_id"] = str(o["user_id"])
                await db["orders"].replace_one({"_id": o["_id"]}, o, upsert=True)
            print(f"[seed] orders: {len(orders)} orders from {fname}")
            break
    else:
        print("[seed] SKIP orders: file not found")

    client.close()
    print("[seed] done")


if __name__ == "__main__":
    asyncio.run(seed())