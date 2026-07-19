"""
Headline Generator API endpoints.

POST /headlines/generate        — Generate N distinct headline candidates
POST /headlines/visual-prompt   — Generate a detailed image prompt from article + headline
POST /headlines/generate-image  — Generate an image from a visual prompt (Gemini)
GET  /headlines/history         — Paginated generation history
"""

from fastapi import APIRouter, HTTPException, Query

from app.repositories.headline_repository import get_generations
from app.schemas.headline import (
    HeadlineHistoryItem,
    HeadlineHistoryResponse,
    HeadlineRequest,
    HeadlineResponse,
    ImageGenerateRequest,
    ImageGenerateResponse,
    VisualPromptRequest,
    VisualPromptResponse,
)
from app.services.headline.headline_service import generate_headlines
from app.services.headline.image_generation_service import (
    ImageGenerationError,
    generate_image_from_prompt,
)
from app.services.headline.visual_prompt_service import generate_visual_prompt
from app.core.groq_client import GroqUnavailable

router = APIRouter(prefix="/headlines", tags=["Headline"])


@router.post("/generate", response_model=HeadlineResponse)
async def generate_headlines_endpoint(payload: HeadlineRequest):
    """
    Generate multiple headline variants from the input Sinhala text.
    """
    return await generate_headlines(payload.text, payload.count)


@router.post("/visual-prompt", response_model=VisualPromptResponse)
async def visual_prompt_endpoint(payload: VisualPromptRequest):
    """
    Generate a detailed English image-generation prompt from a Sinhala article.
    Uses Groq (LLaMA 3.3) to understand the article and craft a photorealistic prompt.
    """
    try:
        prompt = await generate_visual_prompt(payload.article_text, payload.headline)
    except GroqUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Visual prompt generation unavailable: {exc}",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return VisualPromptResponse(visual_prompt=prompt)


@router.post("/generate-image", response_model=ImageGenerateResponse)
async def generate_image_endpoint(payload: ImageGenerateRequest):
    """
    Generate an image from an English visual prompt using Gemini image generation.

    Returns a base64-encoded PNG image that the client can display directly.
    """
    try:
        result = await generate_image_from_prompt(payload.visual_prompt)
    except ImageGenerationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Image generation unavailable: {exc}",
        ) from exc

    return ImageGenerateResponse(
        image_data=result["image_data"],
        mime_type=result.get("mime_type", "image/png"),
    )


@router.get("/history", response_model=HeadlineHistoryResponse)
async def headline_history_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Retrieve paginated headline generation history, newest first.
    """
    records, total = await get_generations(page=page, page_size=page_size)
    items = [
        HeadlineHistoryItem(
            id=str(r["id"]),
            article_text=r.get("article_text", ""),
            headlines=r.get("headlines") or [],
            count=r.get("count", 0),
            model_provider=r.get("model_provider"),
            created_at=r.get("created_at"),
        )
        for r in records
    ]
    return HeadlineHistoryResponse(items=items, total=total, page=page, page_size=page_size)
