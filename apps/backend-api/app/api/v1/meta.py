"""
Capability discovery and unified activity history.

GET /meta    — tasks, styles, lengths, provider status (clients build their
               pickers from this so options never drift from the model)
GET /history — newest activity across all four tools
"""

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_user
from app.core.model_gateway import TASKS, gateway_status
from app.core.prompts import (
    DEFAULT_LENGTH,
    DEFAULT_STYLE,
    STYLE_LABELS,
    SUMMARY_LENGTHS,
)
from app.repositories.history_repository import list_recent
from app.schemas.auth import AuthUser
from app.schemas.meta import (
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
        model=await gateway_status(),
    )


@router.get("/history", response_model=UnifiedHistoryResponse)
async def unified_history_endpoint(
    limit: int = Query(50, ge=1, le=100),
    user: AuthUser = Depends(require_user),
):
    """Newest activity for the caller across grammar, headlines, rewriter, and summarizer."""
    items = await list_recent(limit, user_id=user.id, user_token=user.token)
    return UnifiedHistoryResponse(items=[HistoryItem(**item) for item in items])
