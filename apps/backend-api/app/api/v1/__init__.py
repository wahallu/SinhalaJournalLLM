"""
API v1 router — aggregates all feature routers under /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.grammar import router as grammar_router

router = APIRouter(prefix="/api/v1")

router.include_router(grammar_router)
