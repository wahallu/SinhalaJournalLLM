"""
Unified activity history across all four tools.

Merges the newest rows of each tool table into one reverse-chronological
feed for the web app's History page and the extension dashboard.
"""

import asyncio
import logging
from typing import Any

from app.repositories import (
    grammar_repository,
    headline_repository,
    style_repository,
    summarizer_repository,
)
from app.repositories.base import fetch_recent

logger = logging.getLogger(__name__)

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
