"""
News Summarizer API endpoints.
"""

from fastapi import APIRouter

from app.schemas.summarizer import SummarizerRequest, SummarizerResponse
from app.services.summarizer.summarizer_service import summarize_text

router = APIRouter(tags=["Summarizer"])


@router.post("/summarize", response_model=SummarizerResponse)
async def summarize_news_endpoint(payload: SummarizerRequest):
    """
    Summarize long-form Sinhala articles/texts.
    """
    summary = summarize_text(payload.text, payload.length)
    return SummarizerResponse(
        original=payload.text,
        summary=summary,
        length=payload.length,
    )
