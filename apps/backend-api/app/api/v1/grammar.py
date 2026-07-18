"""
Grammar Checker API endpoints.

POST /check   — Check text for grammar errors
GET  /history — Paginated correction history
GET  /{id}    — Single correction detail
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.repositories.grammar_repository import (
    get_correction_by_id,
    get_corrections,
)
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
async def grammar_check_endpoint(payload: GrammarCheckRequest):
    """
    Check Sinhala text for grammatical errors.

    Runs the text through the model gateway and persists the result.
    Returns the corrected text along with a list of individual corrections.
    """
    return await check_grammar(payload.text)


@router.get("/history", response_model=GrammarHistoryResponse)
async def grammar_history_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    Retrieve paginated grammar correction history, newest first.
    """
    records, total = await get_corrections(page=page, page_size=page_size)
    return GrammarHistoryResponse(
        items=[_record_to_response(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{correction_id}", response_model=GrammarCheckResponse)
async def grammar_detail_endpoint(correction_id: UUID):
    """
    Retrieve a single grammar correction by ID.
    """
    record = await get_correction_by_id(correction_id)
    if not record:
        raise HTTPException(status_code=404, detail="Correction not found")
    return _record_to_response(record)
