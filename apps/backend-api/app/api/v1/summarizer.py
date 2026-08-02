"""
News Summarizer API endpoints.

POST /summarize         — Summarize an article at a target length
GET  /summarize/history — Paginated summary history
"""

import time

from fastapi import APIRouter, Depends, Query, Request

from app.core.features import require_tool_enabled
from app.core.deps import optional_user, require_user
from app.core.rate_limit import client_ip, enforce_anonymous_limit, hash_ip
from app.repositories.summarizer_repository import get_summaries
from app.repositories.telemetry_repository import record_request
from app.schemas.auth import AuthUser
from app.schemas.summarizer import (
    SummarizerRequest,
    SummarizerResponse,
    SummaryHistoryItem,
    SummaryHistoryResponse,
)
from app.services.summarizer.summarizer_service import summarize_text

router = APIRouter(tags=["Summarizer"])


@router.post("/summarize", response_model=SummarizerResponse)
async def summarize_news_endpoint(
    request: Request,
    payload: SummarizerRequest,
    user: AuthUser | None = Depends(optional_user),
    _enabled: None = require_tool_enabled("summarizer"),
):
    """
    Summarize long-form Sinhala articles/texts.

    Usable anonymously; results are only persisted for a signed-in caller.
    """
    await enforce_anonymous_limit(request, user)

    started = time.perf_counter()
    result = await summarize_text(payload.text, payload.length, user_id=user.id if user else None)
    latency_ms = int((time.perf_counter() - started) * 1000)

    await record_request(
        user_id=user.id if user else None,
        endpoint="/api/v1/summarize",
        method="POST",
        tool="summarizer",
        status_code=200,
        latency_ms=latency_ms,
        provider=result.model_used,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        ip_hash=hash_ip(client_ip(request)),
    )
    return result


@router.get("/summarize/history", response_model=SummaryHistoryResponse)
async def summary_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthUser = Depends(require_user),
):
    """
    Retrieve the caller's paginated summary history, newest first.
    """
    records, total = await get_summaries(page=page, page_size=page_size, user_id=user.id, user_token=user.token)
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
