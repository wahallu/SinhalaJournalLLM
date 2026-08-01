"""
Headline generation service.

The headline adapter produces one headline per prompt (greedy decoding), so
N distinct candidates come from N prompt variations — each variation appends
one extra constraint line while staying inside the training format.
"""

import asyncio
import logging

from app.core.model_gateway import model_generate
from app.core.prompts import HEADLINE_VARIATION_HINTS
from app.repositories.headline_repository import save_generation
from app.schemas.headline import HeadlineResponse

logger = logging.getLogger(__name__)


def _dedupe(headlines: list[str]) -> list[str]:
    """Drop duplicates and empties, preserving order."""
    seen: set[str] = set()
    unique: list[str] = []
    for headline in headlines:
        cleaned = " ".join(headline.split()).strip(' "\'')
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            unique.append(cleaned)
    return unique


async def generate_headlines(
    text: str,
    count: int = 5,
    category: str = "General",
    length: str | int | None = "medium",
) -> HeadlineResponse:
    """
    Generate up to `count` distinct headline candidates and persist them.
    """
    hints = HEADLINE_VARIATION_HINTS[:count]

    results = await asyncio.gather(
        *[
            model_generate(
                "headline",
                text,
                category=category,
                length=length,
                variation_hint=hint or None,
            )
            for hint in hints
        ],
        return_exceptions=True,
    )


    headlines: list[str] = []
    provider = None
    total_latency = 0
    for outcome in results:
        if isinstance(outcome, BaseException):
            logger.warning("Headline candidate failed: %s", outcome)
            continue
        headlines.append(outcome.text)
        provider = provider or outcome.provider
        total_latency += outcome.latency_ms

    headlines = _dedupe(headlines)[:count]
    if not headlines:
        # Every candidate failed — surface the first error.
        first_error = next((r for r in results if isinstance(r, BaseException)), None)
        raise first_error or RuntimeError("Headline generation produced no output")

    saved = await save_generation({
        "article_text": text,
        "headlines": headlines,
        "count": len(headlines),
        "model_provider": provider,
        "latency_ms": total_latency,
    })

    return HeadlineResponse(
        id=str(saved["id"]),
        headlines=headlines,
        model_used=provider,
        created_at=saved.get("created_at"),
    )
