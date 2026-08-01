"""
Capability discovery and unified activity history.

GET /meta    — tasks, styles, lengths, provider status (clients build their
               pickers from this so options never drift from the model)
GET /history — newest activity across all four tools
"""

from fastapi import APIRouter, Query

from app.core.model_gateway import TASKS, gateway_status
from app.core.prompts import (
    DEFAULT_HEADLINE_LENGTH,
    DEFAULT_LENGTH,
    DEFAULT_STYLE,
    HEADLINE_LENGTHS,
    STYLE_LABELS,
    SUMMARY_LENGTHS,
)
from app.repositories.history_repository import list_recent
from app.schemas.meta import (
    HeadlineLengthOption,
    HistoryItem,
    LengthOption,
    MetaResponse,
    StyleOption,
    UnifiedHistoryResponse,
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
    )


@router.get("/history", response_model=UnifiedHistoryResponse)
async def unified_history_endpoint(
    limit: int = Query(50, ge=1, le=100),
):
    """Newest activity across grammar, headlines, rewriter, and summarizer."""
    items = await list_recent(limit)
    return UnifiedHistoryResponse(items=[HistoryItem(**item) for item in items])
