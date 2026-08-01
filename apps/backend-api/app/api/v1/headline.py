"""
Headline Generator API endpoints.

POST /headlines/generate       — Generate N distinct headline candidates
POST /headlines/visual-prompt  — Generate a detailed image prompt from article + headline
GET  /headlines/history        — Paginated generation history
"""

import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.features import require_tool_enabled
from app.core.deps import optional_user, require_user
from app.core.rate_limit import client_ip, enforce_anonymous_limit, hash_ip
from app.repositories.headline_repository import get_generations
from app.repositories.telemetry_repository import record_request
from app.schemas.auth import AuthUser
from app.schemas.headline import (
    HeadlineHistoryItem,
    HeadlineHistoryResponse,
    HeadlineRequest,
    HeadlineResponse,
    VisualPromptRequest,
    VisualPromptResponse,
)
from app.services.headline.headline_service import generate_headlines
from app.services.headline.visual_prompt_service import generate_visual_prompt
from app.core.openrouter_client import OpenRouterUnavailable

router = APIRouter(prefix="/headlines", tags=["Headline"])


@router.post("/generate", response_model=HeadlineResponse)
async def generate_headlines_endpoint(
    request: Request,
    payload: HeadlineRequest,
    user: AuthUser | None = Depends(optional_user),
    _enabled: None = require_tool_enabled("headlines"),
):
    """
    Generate multiple headline variants from the input Sinhala text.
    """
    await enforce_anonymous_limit(request, user)

    started = time.perf_counter()
    result = await generate_headlines(
        payload.text, payload.count, category=payload.category,
        user_id=user.id if user else None,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    await record_request(
        user_id=user.id if user else None,
        endpoint="/api/v1/headlines/generate",
        method="POST",
        tool="headline",
        status_code=200,
        latency_ms=latency_ms,
        provider=result.model_used,
        ip_hash=hash_ip(client_ip(request)),
    )
    return result



@router.post("/visual-prompt", response_model=VisualPromptResponse)
async def visual_prompt_endpoint(
    request: Request,
    payload: VisualPromptRequest,
    user: AuthUser | None = Depends(optional_user),
):
    """
    Generate a detailed English image-generation prompt from a Sinhala article.
    Uses OpenRouter to understand the article and craft a photorealistic prompt.

    Rate-limited for anonymous callers like the four tools: this bills a
    hosted provider per call, so leaving it ungated made the cap on the other
    endpoints pointless.
    """
    await enforce_anonymous_limit(request, user)

    try:
        prompt = await generate_visual_prompt(payload.article_text, payload.headline)
    except OpenRouterUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Visual prompt generation unavailable: {exc}",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return VisualPromptResponse(visual_prompt=prompt)


@router.get("/history", response_model=HeadlineHistoryResponse)
async def headline_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthUser = Depends(require_user),
):
    """
    Retrieve the caller's paginated headline generation history, newest first.
    """
    records, total = await get_generations(page=page, page_size=page_size, user_id=user.id, user_token=user.token)
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

