from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings

settings = get_settings()
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URL)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.DATABASE_NAME]


def users_col():
    return get_db()["users"]

def menu_col():
    return get_db()["menu"]

def orders_col():
    return get_db()["orders"]


async def create_indexes():
    db = get_db()
    await db["users"].create_index("email", unique=True)
    await db["users"].create_index("username", unique=True)
    await db["menu"].create_index("id", unique=True)
    await db["menu"].create_index("category_slug")
    await db["orders"].create_index("user_id")