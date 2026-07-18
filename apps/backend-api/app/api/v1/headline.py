"""
Headline Generator API endpoints.

POST /headlines/generate — Generate N distinct headline candidates
GET  /headlines/history  — Paginated generation history
"""

from fastapi import APIRouter, Query

from app.repositories.headline_repository import get_generations
from app.schemas.headline import (
    HeadlineHistoryItem,
    HeadlineHistoryResponse,
    HeadlineRequest,
    HeadlineResponse,
)
from app.services.headline.headline_service import generate_headlines

router = APIRouter(prefix="/headlines", tags=["Headline"])


@router.post("/generate", response_model=HeadlineResponse)
async def generate_headlines_endpoint(payload: HeadlineRequest):
    """
    Generate multiple headline variants from the input Sinhala text.
    """
    return await generate_headlines(payload.text, payload.count)


@router.get("/history", response_model=HeadlineHistoryResponse)
async def headline_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Retrieve paginated headline generation history, newest first.
    """
    records, total = await get_generations(page=page, page_size=page_size)
    items = [
        HeadlineHistoryItem(
            id=str(r["id"]),
            article_text=r.get("article_text", ""),
            headlines=r.get("headlines") or [],
            count=r.get("count", 0),
            model_provider=r.get("model_provider"),
            created_at=r.get("created_at"),
        )
        for r in records
    ]
    return HeadlineHistoryResponse(items=items, total=total, page=page, page_size=page_size)
