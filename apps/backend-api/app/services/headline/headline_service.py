"""
Headline generation service.

The headline adapter produces one headline per prompt (greedy decoding), so
N distinct candidates come from N prompt variations — each variation appends
one extra constraint line while staying inside the training format.
"""

import asyncio
import logging
import re
import time

from app.core.config import get_settings
from app.core.groq_client import groq_chat
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


async def generate_headlines(text: str, count: int = 5, style: str = "formal") -> HeadlineResponse:
    """
    Generate up to `count` distinct headline candidates and persist them.
    """
    settings = get_settings()

    if settings.GROQ_STYLE_API_KEY:
        try:
            tone_map = {
                "formal": "Formal",
                "breaking_news": "Breaking News",
                "youth": "Youth Casual",
                "editorial": "Editorial",
            }
            tone = tone_map.get(style.lower(), "Formal")

            system_prompt = """
    You are a text rewriting assistant. Your sole job is to rewrite the user's input text based on two strict variables: "tone" and "candidates".

    Tone Mapping:
    - Formal: Authoritative broadsheet tone.
    - Breaking News: Urgent, attention-grabbing.
    - Youth Casual: Social-media friendly.
    - Editorial: Analytical, thought-provoking.

    Output Constraints:
    1. Generate exactly the number of variations requested by the "candidates" variable.
    2. Separate each version clearly with a number (e.g., 1., 2., 3.).
    3. Do not include any conversational preamble or explanations. Output ONLY the requested variations.
    """
            user_prompt = f"""
    Input Text: "{text}"
    Requested Tone: {tone}
    Number of Candidates: {count}
    """
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            started = time.perf_counter()
            response_text = await groq_chat(
                messages,
                temperature=0.7,
                use_style_creds=True
            )
            latency_ms = int((time.perf_counter() - started) * 1000)

            # Parse lines to find candidates
            lines = response_text.strip().split("\n")
            headlines: list[str] = []
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                match = re.match(r"^\d+[\.\)\s-]+\s*(.*)$", line)
                if match:
                    cand = match.group(1).strip().strip(' "\'')
                    if cand:
                        headlines.append(cand)
                else:
                    cleaned = re.sub(r"^\d+\s*", "", line).strip().strip(' "\'')
                    if cleaned:
                        headlines.append(cleaned)

            headlines = _dedupe(headlines)[:count]

            if headlines:
                saved = await save_generation({
                    "article_text": text,
                    "headlines": headlines,
                    "count": len(headlines),
                    "model_provider": settings.GROQ_STYLE_MODEL or "groq",
                    "latency_ms": latency_ms,
                })

                return HeadlineResponse(
                    id=str(saved["id"]),
                    headlines=headlines,
                    model_used=settings.GROQ_STYLE_MODEL or "groq",
                    created_at=saved.get("created_at"),
                )
        except Exception as exc:
            logger.warning("Groq style rewriter failed: %s — falling back to model_generate", exc)

    # Fallback/Legacy flow: N variations using different hints
    hints = HEADLINE_VARIATION_HINTS[:count]

    results = await asyncio.gather(
        *[
            model_generate("headline", text, variation_hint=hint or None)
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
