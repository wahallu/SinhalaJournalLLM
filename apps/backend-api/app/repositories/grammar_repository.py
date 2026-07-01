"""
Data access layer for grammar correction records.
All database queries for the grammar feature go here.
"""

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.grammar import GrammarCorrection


async def save_correction(
    db: AsyncSession,
    correction: GrammarCorrection,
) -> GrammarCorrection:
    """Insert a new grammar correction record and return it with generated fields."""
    db.add(correction)
    await db.flush()
    await db.refresh(correction)
    return correction


async def get_correction_by_id(
    db: AsyncSession,
    correction_id: UUID,
) -> GrammarCorrection | None:
    """Fetch a single correction by its UUID."""
    stmt = select(GrammarCorrection).where(GrammarCorrection.id == correction_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_corrections(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[GrammarCorrection], int]:
    """
    Fetch paginated correction history, ordered by newest first.

    Returns:
        (list_of_records, total_count)
    """
    # Total count
    count_stmt = select(func.count()).select_from(GrammarCorrection)
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginated results
    offset = (page - 1) * page_size
    stmt = (
        select(GrammarCorrection)
        .order_by(GrammarCorrection.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    records = list(result.scalars().all())

    return records, total
