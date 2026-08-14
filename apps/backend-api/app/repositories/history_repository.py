"""
Unified activity history across all four tools.

Merges the newest rows of each tool table into one reverse-chronological
feed for the web app's History page and the extension dashboard.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.repositories import (
    grammar_repository,
    headline_repository,
    style_repository,
    summarizer_repository,
)
from app.repositories.base import count_rows, fetch_by_id, fetch_recent

logger = logging.getLogger(__name__)

# The newsroom this serves works to Colombo time, so "today" and "this week"
# are bounded there rather than in UTC or the server's local zone. Fixed
# +05:30 with no daylight saving, so a plain offset is exact and avoids a
# tzdata dependency at runtime.
_COLOMBO = timezone(timedelta(hours=5, minutes=30))

# tool key → (table, input column, output extractor)
_SOURCES: dict[str, tuple[str, str, Any]] = {
    "grammar": (
        grammar_repository.TABLE,
        "original_text",
        lambda r: r.get("corrected_text", ""),
    ),
    "headlines": (
        headline_repository.TABLE,
        "article_text",
        lambda r: " | ".join(r.get("headlines") or []),
    ),
    "rewriter": (
        style_repository.TABLE,
        "original_text",
        lambda r: r.get("rewritten_text", ""),
    ),
    "summarizer": (
        summarizer_repository.TABLE,
        "original_text",
        lambda r: r.get("summary_text", ""),
    ),
}

_PREVIEW_CHARS = 240


def _preview(value: str | None) -> str:
    value = (value or "").strip()
    return value[:_PREVIEW_CHARS]


async def get_run(
    tool: str,
    record_id: str,
    *,
    user_id: str,
) -> dict[str, Any] | None:
    """Return one complete, normalized workspace owned by ``user_id``."""
    source = _SOURCES.get(tool)
    if source is None:
        return None

    table, input_column, _ = source
    row = await fetch_by_id(table, record_id, user_id=user_id)
    if not row:
        return None

    created_at = row.get("created_at")
    common = {
        "id": str(row.get("id")),
        "tool": tool,
        "input": row.get(input_column) or "",
        "created_at": created_at,
    }

    if tool == "grammar":
        corrections = row.get("corrections") or []
        return {
            **common,
            "output": {
                "id": str(row.get("id")),
                "corrected": row.get("corrected_text") or "",
                "corrections": corrections,
                "correction_count": row.get("correction_count", len(corrections)),
                "suggestions": row.get("suggestions") or [],
                "created_at": created_at,
                "model_used": row.get("model_provider"),
            },
            "settings": {},
        }

    if tool == "headlines":
        length_id = row.get("length") or "medium"
        requested_count = row.get("requested_count") or row.get("count")
        headline_settings = {
            "category": row.get("category") or "General",
            "headlineLength": length_id,
        }
        if requested_count in (3, 5, 7):
            headline_settings["count"] = requested_count
        if row.get("adapter"):
            headline_settings["headlineModel"] = row["adapter"]
        # Older rows predate saved length metadata. The frontend has the exact
        # bands and safely falls back from this id when rebuilding candidates.
        return {
            **common,
            "output": {
                "id": str(row.get("id")),
                "headlines": row.get("headlines") or [],
                "length": {"id": length_id},
                "model_used": row.get("model_provider"),
                "adapter_used": row.get("adapter"),
                "created_at": created_at,
                "visual_prompt": row.get("visual_prompt") or "",
                "image_url": row.get("image_url") or "",
                "image_model": row.get("image_model"),
            },
            "settings": headline_settings,
        }

    if tool == "rewriter":
        style = row.get("style") or "formal"
        return {
            **common,
            "output": {
                "id": str(row.get("id")),
                "original": row.get("original_text") or "",
                "rewritten": row.get("rewritten_text") or "",
                "tone": style,
                "style": style,
                "model_used": row.get("model_provider"),
                "created_at": created_at,
            },
            "settings": {"tone": style},
        }

    length = row.get("length") or "medium"
    return {
        **common,
        "output": {
            "id": str(row.get("id")),
            "original": row.get("original_text") or "",
            "summary": row.get("summary_text") or "",
            "length": length,
            "model_used": row.get("model_provider"),
            "created_at": created_at,
        },
        "settings": {"length": length},
    }


async def get_run_for_admin(tool: str, record_id: str) -> dict[str, Any] | None:
    """Return any owner's complete run for a ``require_admin`` route only.

    Resolve the owner first, then reuse the same normalized workspace builder
    as History → Reopen. Keeping this separate prevents a future user-facing
    caller from accidentally omitting the ownership boundary.
    """
    source = _SOURCES.get(tool)
    if source is None:
        return None
    table, _, _ = source
    row = await fetch_by_id(table, record_id)
    if not row or not row.get("user_id"):
        return None
    return await get_run(tool, record_id, user_id=str(row["user_id"]))


async def list_recent(limit: int = 50, *, user_id: str | None = None) -> list[dict[str, Any]]:
    """
    Newest `limit` items across every tool, shaped as:
        {id, tool, input_preview, output_preview, detail, created_at}
    A tool whose table is missing (schema not migrated yet) is skipped.
    Scoped to `user_id` when given.
    """

    async def _load(tool: str) -> list[dict[str, Any]]:
        table, input_column, extract_output = _SOURCES[tool]
        try:
            rows = await fetch_recent(table, limit, user_id=user_id)
        except Exception:
            logger.exception("History: failed to read %s — skipping", table)
            return []
        items = []
        for row in rows:
            detail = {}
            if tool == "rewriter":
                detail["style"] = row.get("style")
            if tool == "summarizer":
                detail["length"] = row.get("length")
            if tool == "headlines":
                detail["count"] = row.get("count")
            if tool == "grammar":
                detail["correction_count"] = row.get("correction_count")
            items.append({
                "id": str(row.get("id")),
                "tool": tool,
                "input_preview": _preview(row.get(input_column)),
                "output_preview": _preview(extract_output(row)),
                "detail": detail,
                "model_provider": row.get("model_provider"),
                "created_at": row.get("created_at"),
            })
        return items

    per_tool = await asyncio.gather(*[_load(tool) for tool in _SOURCES])
    merged = [item for items in per_tool for item in items]
    merged.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return merged[:limit]


async def list_all_recent(limit: int = 100) -> list[dict[str, Any]]:
    """
    Every user's newest runs, merged newest-first, for the admin Chats view.

    Deliberately separate from list_recent rather than a flag on it: this
    shape carries `user_id` and token counts, and the user-facing /history
    response should not widen just because the admin console needs more.

    Anonymous runs are not stored at all (see persist_if_owned), so every
    row here has an owner.
    """

    async def _load(tool: str) -> list[dict[str, Any]]:
        table, input_column, extract_output = _SOURCES[tool]
        try:
            rows = await fetch_recent(table, limit)
        except Exception:
            logger.exception("Admin chats: failed to read %s — skipping", table)
            return []
        return [
            {
                "id": str(row.get("id")),
                "user_id": row.get("user_id"),
                "tool": tool,
                "input_preview": _preview(row.get(input_column)),
                "output_preview": _preview(extract_output(row)),
                "model_provider": row.get("model_provider"),
                # Grammar-only column (schema.sql) — every other table's rows
                # come back None here, same as a missing dict key would.
                # Admin-only surface: this is list_all_recent, not
                # list_recent, so it never reaches the user-facing /history
                # endpoint or its HistoryItem schema.
                "adapter": row.get("adapter"),
                "latency_ms": row.get("latency_ms"),
                # None when the provider reported nothing — only sinllama
                # does. The UI shows that as "—", not 0.
                "input_tokens": row.get("input_tokens"),
                "output_tokens": row.get("output_tokens"),
                "created_at": row.get("created_at"),
            }
            for row in rows
        ]

    per_tool = await asyncio.gather(*[_load(tool) for tool in _SOURCES])
    merged = [item for items in per_tool for item in items]
    merged.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return merged[:limit]


async def usage_stats(
    *, user_id: str | None = None
) -> dict[str, Any]:
    """
    Exact run counts for one caller: total, today, this week, and per tool.

    Counted in the database rather than derived from a page of history. The
    dashboard used to compute these from a 50-row fetch, which meant every
    tile silently capped at 50 — a user with 300 runs and one with exactly 50
    saw the same "Total runs", and "Most used" was decided by whichever tool
    happened to appear most in the newest 50 rows rather than overall.

    Day and week boundaries are Asia/Colombo, matching the dashboard greeting:
    "Today" has to mean today at the desk, not in UTC.

    A tool whose table is missing counts 0 rather than failing the whole
    payload — the same tolerance list_recent() has.
    """
    now = datetime.now(_COLOMBO)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = start_of_day - timedelta(days=7)

    async def _count(tool: str, since: str | None) -> int:
        table, _, _ = _SOURCES[tool]
        try:
            return await count_rows(
                table, user_id=user_id, since=since
            )
        except Exception:
            logger.exception("Stats: failed to count %s — reporting 0", table)
            return 0

    tools = list(_SOURCES)
    totals, today, week = await asyncio.gather(
        asyncio.gather(*[_count(t, None) for t in tools]),
        asyncio.gather(*[_count(t, start_of_day.isoformat()) for t in tools]),
        asyncio.gather(*[_count(t, start_of_week.isoformat()) for t in tools]),
    )

    per_tool = dict(zip(tools, totals))
    top_tool, top_count = max(per_tool.items(), key=lambda kv: kv[1], default=(None, 0))
    return {
        "total": sum(totals),
        "today": sum(today),
        "week": sum(week),
        "per_tool": per_tool,
        "top_tool": top_tool if top_count > 0 else None,
    }
