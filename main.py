from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.mongodb import create_indexes
from app.ml.recommender import RecSysModel
from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_indexes()
    # Load recommender model (non-blocking)
    asyncio.get_event_loop().run_in_executor(None, RecSysModel.load)
    yield
    # Shutdown — nothing to clean up


app = FastAPI(
    title="Food Delivery API",
    version="1.0.0",
    description="REST API для сервиса доставки еды с рекомендательной системой",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # в prod заменить на конкретные origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}