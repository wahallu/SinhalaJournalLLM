"""
Grammar Checker API endpoints.

POST /check  — Check text for grammar errors
GET  /history — Paginated correction history
GET  /{id}    — Single correction detail
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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


@router.post("/check", response_model=GrammarCheckResponse)
async def grammar_check_endpoint(
    payload: GrammarCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Check Sinhala text for grammatical errors.

    Applies grammar correction rules and persists the result.
    Returns the corrected text along with a list of individual corrections.
    """
    result = await check_grammar(payload.text, db)
    return result


@router.get("/history", response_model=GrammarHistoryResponse)
async def grammar_history_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve paginated grammar correction history, newest first.
    """
    records, total = await get_corrections(db, page=page, page_size=page_size)

    items = [
        GrammarCheckResponse(
            id=str(r.id),
            corrected=r.corrected_text,
            corrections=[CorrectionDetail(**c) for c in r.corrections],
            correction_count=r.correction_count,
            created_at=r.created_at,
        )
        for r in records
    ]

    return GrammarHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{correction_id}", response_model=GrammarCheckResponse)
async def grammar_detail_endpoint(
    correction_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a single grammar correction by ID.
    """
    record = await get_correction_by_id(db, correction_id)
    if not record:
        raise HTTPException(status_code=404, detail="Correction not found")

    return GrammarCheckResponse(
        id=str(record.id),
        corrected=record.corrected_text,
        corrections=[CorrectionDetail(**c) for c in record.corrections],
        correction_count=record.correction_count,
        created_at=record.created_at,
    )
