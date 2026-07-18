"""
Style Rewriter API endpoints.

POST /rewrite         — Rewrite text into a target newspaper style
GET  /rewrite/history — Paginated rewrite history
"""

from fastapi import APIRouter, Query

from app.repositories.style_repository import get_rewrites
from app.schemas.style import (
    StyleHistoryItem,
    StyleHistoryResponse,
    StyleRewriteRequest,
    StyleRewriteResponse,
)
from app.services.style.style_service import rewrite_style

router = APIRouter(tags=["Style"])


@router.post("/rewrite", response_model=StyleRewriteResponse)
async def rewrite_style_endpoint(payload: StyleRewriteRequest):
    """
    Rewrite Sinhala text in a different newspaper style.
    """
    return await rewrite_style(payload.text, payload.tone)


@router.get("/rewrite/history", response_model=StyleHistoryResponse)
async def style_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Retrieve paginated style rewrite history, newest first.
    """
    records, total = await get_rewrites(page=page, page_size=page_size)
    items = [
        StyleHistoryItem(
            id=str(r["id"]),
            original_text=r.get("original_text", ""),
            rewritten_text=r.get("rewritten_text", ""),
            style=r.get("style", "formal"),
            model_provider=r.get("model_provider"),
            created_at=r.get("created_at"),
        )
        for r in records
    ]
    return StyleHistoryResponse(items=items, total=total, page=page, page_size=page_size)
