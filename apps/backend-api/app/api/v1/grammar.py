"""
Grammar Checker API endpoints.

POST /check   — Check text for grammar errors
GET  /history — Paginated correction history
GET  /{id}    — Single correction detail
"""

import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.features import require_tool_enabled
from app.core.deps import optional_user, require_user
from app.core.rate_limit import client_ip, enforce_anonymous_limit, hash_ip
from app.core.research import actor_from
from app.repositories.grammar_repository import (
    get_correction_by_id,
    get_corrections,
)
from app.repositories.telemetry_repository import record_request
from app.schemas.auth import AuthUser
from app.schemas.grammar import (
    CorrectionDetail,
    GrammarCheckRequest,
    GrammarCheckResponse,
    GrammarHistoryResponse,
)
from app.services.grammar.grammar_service import check_grammar

router = APIRouter(prefix="/grammar", tags=["Grammar"])


def _record_to_response(record: dict) -> GrammarCheckResponse:
    return GrammarCheckResponse(
        id=str(record["id"]),
        corrected=record.get("corrected_text", ""),
        corrections=[CorrectionDetail(**c) for c in record.get("corrections") or []],
        correction_count=record.get("correction_count", 0),
        created_at=record.get("created_at"),
        model_used=record.get("model_provider"),
    )


@router.post("/check", response_model=GrammarCheckResponse)
async def grammar_check_endpoint(
    request: Request,
    payload: GrammarCheckRequest,
    user: AuthUser | None = Depends(optional_user),
    _enabled: None = require_tool_enabled("grammar"),
):
    """
    Check Sinhala text for grammatical errors.

    Runs the text through the model gateway and persists the result for a
    signed-in caller. Usable anonymously; anonymous results are not saved.
    Returns the corrected text along with a list of individual corrections.
    """
    await enforce_anonymous_limit(request, user)

    actor = actor_from(request, user)

    started = time.perf_counter()
    result = await check_grammar(
        payload.text, user_id=user.id if user else None, actor=actor
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    await record_request(
        user_id=user.id if user else None,
        anon_id=actor.anon_id,
        session_id=actor.session_id,
        endpoint="/api/v1/grammar/check",
        method="POST",
        tool="grammar",
        status_code=200,
        latency_ms=latency_ms,
        provider=result.model_used,
        # Admin-diagnostics only, from the private attribute
        # grammar_service.check_grammar() set on the response — never a field
        # of GrammarCheckResponse, so it cannot appear in the JSON this
        # endpoint returns to the caller.
        adapter=result._adapter,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        ip_hash=hash_ip(client_ip(request)),
    )
    return result


@router.get("/history", response_model=GrammarHistoryResponse)
async def grammar_history_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: AuthUser = Depends(require_user),
):
    """
    Retrieve the caller's paginated grammar correction history, newest first.
    """
    records, total = await get_corrections(page=page, page_size=page_size, user_id=user.id)
    return GrammarHistoryResponse(
        items=[_record_to_response(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{correction_id}", response_model=GrammarCheckResponse)
async def grammar_detail_endpoint(
    correction_id: UUID,
    user: AuthUser = Depends(require_user),
):
    """
    Retrieve one of the caller's own grammar corrections by ID.

    Scoped to the caller: another user's record is reported as not found
    rather than forbidden, so the response does not confirm that the id
    exists.
    """
    record = await get_correction_by_id(
        correction_id, user_id=user.id
    )
    if not record:
        raise HTTPException(status_code=404, detail="Correction not found")
    return _record_to_response(record)
