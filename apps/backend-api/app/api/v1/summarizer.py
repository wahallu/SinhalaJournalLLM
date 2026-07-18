"""
News Summarizer API endpoints.

POST /summarize         — Summarize an article at a target length
GET  /summarize/history — Paginated summary history
"""

from fastapi import APIRouter, Query

from app.repositories.summarizer_repository import get_summaries
from app.schemas.summarizer import (
    SummarizerRequest,
    SummarizerResponse,
    SummaryHistoryItem,
    SummaryHistoryResponse,
)
from app.services.summarizer.summarizer_service import summarize_text

router = APIRouter(tags=["Summarizer"])


@router.post("/summarize", response_model=SummarizerResponse)
async def summarize_news_endpoint(payload: SummarizerRequest):
    """
    Summarize long-form Sinhala articles/texts.
    """
    return await summarize_text(payload.text, payload.length)


@router.get("/summarize/history", response_model=SummaryHistoryResponse)
async def summary_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Retrieve paginated summary history, newest first.
    """
    records, total = await get_summaries(page=page, page_size=page_size)
    items = [
        SummaryHistoryItem(
            id=str(r["id"]),
            original_text=r.get("original_text", ""),
            summary_text=r.get("summary_text", ""),
            length=r.get("length", "medium"),
            model_provider=r.get("model_provider"),
            created_at=r.get("created_at"),
        )
        for r in records
    ]
    return SummaryHistoryResponse(items=items, total=total, page=page, page_size=page_size)
