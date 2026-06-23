from fastapi import APIRouter

from app.api.v1.ai import router as ai_router
from app.api.v1.covers import router as covers_router
from app.api.v1.images import router as images_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.providers import router as providers_router

api_router = APIRouter()
api_router.include_router(jobs_router)
api_router.include_router(ai_router)
api_router.include_router(images_router)
api_router.include_router(covers_router)
api_router.include_router(providers_router)
