"""
Style Rewriter API endpoints.
"""

from fastapi import APIRouter

from app.schemas.style import StyleRewriteRequest, StyleRewriteResponse
from app.services.style.style_service import rewrite_style

router = APIRouter(tags=["Style"])


@router.post("/rewrite", response_model=StyleRewriteResponse)
async def rewrite_style_endpoint(payload: StyleRewriteRequest):
    """
    Rewrite selected Sinhala text in a different style/tone.
    """
    rewritten = rewrite_style(payload.text, payload.tone)
    return StyleRewriteResponse(
        original=payload.text,
        rewritten=rewritten,
        tone=payload.tone,
    )
