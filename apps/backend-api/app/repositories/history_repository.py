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
from app.repositories.base import count_rows, fetch_recent

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


async def list_recent(limit: int = 50, *, user_id: str | None = None, user_token: str | None = None) -> list[dict[str, Any]]:
    """
    Newest `limit` items across every tool, shaped as:
        {id, tool, input_preview, output_preview, detail, created_at}
    A tool whose table is missing (schema not migrated yet) is skipped.
    Scoped to `user_id` when given.
    """

    async def _load(tool: str) -> list[dict[str, Any]]:
        table, input_column, extract_output = _SOURCES[tool]
        try:
            rows = await fetch_recent(table, limit, user_id=user_id, user_token=user_token)
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
    *, user_id: str | None = None, user_token: str | None = None
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
                table, user_id=user_id, user_token=user_token, since=since
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
