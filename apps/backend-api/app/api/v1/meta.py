"""
Capability discovery and unified activity history.

GET /meta    — tasks, styles, lengths, provider status (clients build their
               pickers from this so options never drift from the model)
GET /history — newest activity across all four tools
GET /history/stats — exact run counts (not derived from a page of history)
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core import runtime_settings
from app.core.deps import require_user
from app.core.features import all_flags
from app.core.model_gateway import TASKS, gateway_status
from app.core.prompts import (
    DEFAULT_HEADLINE_LENGTH,
    DEFAULT_LENGTH,
    DEFAULT_STYLE,
    HEADLINE_LENGTHS,
    STYLE_LABELS,
    SUMMARY_LENGTHS,
)
from app.repositories.history_repository import get_run, list_recent, usage_stats
from app.schemas.auth import AuthUser
from app.schemas.meta import (
    HeadlineLengthOption,
    HistoryItem,
    HistoryRun,
    LengthOption,
    MetaResponse,
    StyleOption,
    UnifiedHistoryResponse,
    UsageStatsResponse,
)

router = APIRouter(tags=["Meta"])


@router.get("/meta", response_model=MetaResponse)
async def meta_endpoint():
    """Describe what this API instance supports."""
    return MetaResponse(
        tasks=list(TASKS),
        styles=[
            StyleOption(id=style, label_en=labels["en"], label_si=labels["si"])
            for style, labels in STYLE_LABELS.items()
        ],
        default_style=DEFAULT_STYLE,
        lengths=[
            LengthOption(id=length, label_en=cfg["label_en"], label_si=cfg["label_si"])
            for length, cfg in SUMMARY_LENGTHS.items()
        ],
        default_length=DEFAULT_LENGTH,
        headline_counts=[3, 5, 7],
        headline_lengths=[
            HeadlineLengthOption(
                id=length,
                label_en=cfg["label_en"],
                label_si=cfg["label_si"],
                min_words=cfg["min_words"],
                max_words=cfg["max_words"],
            )
            for length, cfg in HEADLINE_LENGTHS.items()
        ],
        default_headline_length=DEFAULT_HEADLINE_LENGTH,
        model=await gateway_status(),
        features=await all_flags(),
        defaults={
            "tone": await runtime_settings.get("defaults.tone"),
            "length": await runtime_settings.get("defaults.length"),
            "headline_count": await runtime_settings.get("defaults.headline_count"),
        },
    )


@router.get("/history", response_model=UnifiedHistoryResponse)
async def unified_history_endpoint(
    limit: int = Query(50, ge=1, le=100),
    user: AuthUser = Depends(require_user),
):
    """Newest activity for the caller across grammar, headlines, rewriter, and summarizer."""
    items = await list_recent(limit, user_id=user.id)
    return UnifiedHistoryResponse(items=[HistoryItem(**item) for item in items])


@router.get("/history/{tool}/{record_id}", response_model=HistoryRun)
async def history_run_endpoint(
    tool: str,
    record_id: str,
    user: AuthUser = Depends(require_user),
):
    """Complete saved input/output state for History → Reopen."""
    run = await get_run(tool, record_id, user_id=user.id)
    if run is None:
        raise HTTPException(status_code=404, detail="History entry not found.")
    return HistoryRun(**run)


@router.get("/history/stats", response_model=UsageStatsResponse)
async def usage_stats_endpoint(user: AuthUser = Depends(require_user)):
    """
    Exact run counts for the caller.

    The dashboard cannot compute these from /history: that returns at most
    `limit` rows, so every tile derived from it saturated at the page size.
    """
    return UsageStatsResponse(**await usage_stats(user_id=user.id))
