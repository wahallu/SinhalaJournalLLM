"""
Audit log and telemetry explorer. Behind require_admin.

Neither endpoint returns a raw client IP — only the salted hash that was
stored. The hash is enough to correlate abuse across requests without the
dashboard becoming a record of who read what.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_admin
from app.repositories import audit_repository, base, history_repository
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/activity", tags=["Admin"])

TELEMETRY = "request_telemetry"


async def _emails_by_id() -> dict[str, str]:
    """
    user_id → email for attributing runs.

    Fetches the profile list rather than filtering by the ids on the page:
    an admin console's user table is small, and one unfiltered read is
    cheaper than an `in_` filter that the repositories layer does not
    currently expose.
    """
    client = await base.get_supabase()
    response = await client.table("profiles").select("id,email").execute()
    return {row["id"]: row.get("email") for row in (response.data or [])}


def _total_tokens(item: dict[str, Any]) -> int | None:
    """Sum of both directions, or None when the provider reported neither."""
    parts = [item.get("input_tokens"), item.get("output_tokens")]
    if all(part is None for part in parts):
        return None
    return sum(part or 0 for part in parts)


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


@router.get("/chats")
async def chats(
    limit: int = Query(100, ge=1, le=500),
    _admin: AuthUser = Depends(require_admin),
) -> dict[str, Any]:
    """
    Every user's tool runs in one newest-first feed, with token usage.

    Reads the four history tables rather than request_telemetry: telemetry
    has the token columns but none of the text, and nothing joins a
    telemetry row to the run it describes. Tokens are written to both.

    Anonymous runs are never persisted (see persist_if_owned), so this is
    only ever signed-in activity.
    """
    items = await history_repository.list_all_recent(limit)
    emails = await _emails_by_id()

    for item in items:
        item["user_email"] = emails.get(item.get("user_id"))
        item["total_tokens"] = _total_tokens(item)

    reported = [item["total_tokens"] for item in items if item["total_tokens"] is not None]
    return {
        "items": items,
        "total": len(items),
        # None when nothing on this page reported usage at all, so the UI can
        # say "not reported" instead of showing a confident zero.
        "total_tokens": sum(reported) if reported else None,
    }
