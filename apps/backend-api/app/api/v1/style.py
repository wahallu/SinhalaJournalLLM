"""
Style Rewriter API endpoints.

POST /rewrite         — Rewrite text into a target newspaper style
GET  /rewrite/history — Paginated rewrite history
"""

import time

from fastapi import APIRouter, Depends, Query, Request

from app.core.features import require_tool_enabled
from app.core.deps import optional_user, require_user
from app.core.rate_limit import client_ip, enforce_anonymous_limit, hash_ip
from app.repositories.style_repository import get_rewrites
from app.repositories.telemetry_repository import record_request
from app.schemas.auth import AuthUser
from app.schemas.style import (
    StyleHistoryItem,
    StyleHistoryResponse,
    StyleRewriteRequest,
    StyleRewriteResponse,
)
from app.services.style.style_service import rewrite_style

router = APIRouter(tags=["Style"])


@router.post("/rewrite", response_model=StyleRewriteResponse)
async def rewrite_style_endpoint(
    request: Request,
    payload: StyleRewriteRequest,
    user: AuthUser | None = Depends(optional_user),
    _enabled: None = require_tool_enabled("rewriter"),
):
    """
    Rewrite Sinhala text in a different newspaper style.
    """
    await enforce_anonymous_limit(request, user)

    started = time.perf_counter()
    result = await rewrite_style(payload.text, payload.tone, user_id=user.id if user else None)
    latency_ms = int((time.perf_counter() - started) * 1000)

    await record_request(
        user_id=user.id if user else None,
        endpoint="/api/v1/rewrite",
        method="POST",
        tool="style",
        status_code=200,
        latency_ms=latency_ms,
        provider=result.model_used,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        ip_hash=hash_ip(client_ip(request)),
    )
    return result


@router.get("/rewrite/history", response_model=StyleHistoryResponse)
async def style_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthUser = Depends(require_user),
):
    """
    Retrieve the caller's paginated style rewrite history, newest first.
    """
    records, total = await get_rewrites(page=page, page_size=page_size, user_id=user.id, user_token=user.token)
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
