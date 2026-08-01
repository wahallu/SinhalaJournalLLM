"""
Audit log and telemetry explorer. Behind require_admin.

Neither endpoint returns a raw client IP — only the salted hash that was
stored. The hash is enough to correlate abuse across requests without the
dashboard becoming a record of who read what.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_admin
from app.repositories import audit_repository, base
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/activity", tags=["Admin"])

TELEMETRY = "request_telemetry"


@router.get("/audit")
async def audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin),
) -> dict[str, Any]:
    """Newest-first page of privileged actions with before/after values."""
    items, total = await audit_repository.list_entries(page=page, page_size=page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/telemetry")
async def telemetry(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tool: str | None = None,
    _admin: AuthUser = Depends(require_admin),
) -> dict[str, Any]:
    """Newest-first page of individual requests, optionally filtered by tool."""
    client = await base.get_supabase()
    query = client.table(TELEMETRY).select("*", count="exact")
    if tool:
        query = query.eq("tool", tool)

    offset = (page - 1) * page_size
    response = await (
        query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    )
    return {
        "items": response.data or [],
        "total": response.count or 0,
        "page": page,
        "page_size": page_size,
    }
