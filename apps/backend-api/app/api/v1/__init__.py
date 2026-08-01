"""
API v1 router — aggregates all feature routers under /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.grammar import router as grammar_router
from app.api.v1.headline import router as headline_router
from app.api.v1.image_generation import router as image_generation_router
from app.api.v1.meta import router as meta_router
from app.api.v1.sinllama import router as sinllama_router
from app.api.v1.style import router as style_router
from app.api.v1.summarizer import router as summarizer_router
from app.api.v1.comparison import router as comparison_router

router = APIRouter(prefix="/api/v1")

router.include_router(grammar_router)
router.include_router(headline_router)
router.include_router(image_generation_router)
router.include_router(style_router)
router.include_router(summarizer_router)
router.include_router(sinllama_router)
router.include_router(meta_router)
router.include_router(comparison_router)
router.include_router(admin_router)
