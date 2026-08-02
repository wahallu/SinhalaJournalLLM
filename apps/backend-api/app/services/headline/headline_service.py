"""
Headline generation service.

The headline adapter produces one headline per prompt, so N distinct
candidates come from N prompt variations — each variation appends one extra
constraint line while staying inside the training format.

Length control is a two-layer affair. The requested band (short 3-5, medium
6-7, long 8-10 words) goes into the prompt, but no headline adapter is
length-conditioned yet — v17 saw the same fixed "4 to 7 words" line on all
48K training examples — so the prompt alone lands in-band only some of the
time. This module is the layer that closes the gap: out-of-band candidates
are regenerated with an explicit corrective hint, and anything still over the
ceiling is trimmed to it. Under-length candidates can't be repaired that way,
so after the retries they're returned as-is rather than dropped — a slightly
short real headline beats an empty result.
"""

import asyncio
import logging

from app.core.model_gateway import model_generate
from app.core.prompts import (
    HEADLINE_LENGTHS,
    HEADLINE_VARIATION_HINTS,
    resolve_headline_length,
)
from app.repositories.base import persist_if_owned
from app.repositories.headline_repository import save_generation
from app.schemas.headline import HeadlineLengthInfo, HeadlineResponse

logger = logging.getLogger(__name__)

# Extra regeneration rounds for candidates that miss the band. Each round is
# one model call per still-failing candidate, and the inference server
# serializes generations, so this trades latency for in-band rate — the reason
# it's a small number and not a loop-until-perfect.
MAX_LENGTH_RETRY_ROUNDS = 2


def _word_count(headline: str) -> int:
    return len(headline.split())


def _band_distance(headline: str, band: dict) -> int:
    """How far outside the band this headline sits, in words. 0 means in-band.
    Directionless on purpose — it's the single comparison used to decide
    whether a regenerated candidate is an improvement, and a retry can miss on
    either side of the one it replaces."""
    words = _word_count(headline)
    if words < band["min_words"]:
        return band["min_words"] - words
    if words > band["max_words"]:
        return words - band["max_words"]
    return 0


def _corrective_hint(headline: str, band: dict) -> str | None:
    """The nudge to append when a candidate missed the band, or None when it
    didn't. Sinhala, to match the rest of the hint vocabulary the adapter saw."""
    words = _word_count(headline)
    if words > band["max_words"]:
        return f"ශීර්ෂ පාඨය වචන {band['max_words']}කට වඩා දිගු නොවිය යුතුය."
    if words < band["min_words"]:
        return f"ශීර්ෂ පාඨය අවම වශයෙන් වචන {band['min_words']}ක් තිබිය යුතුය."
    return None


def _merge_hints(base: str | None, corrective: str) -> str:
    """Variation hints render as a single '- {hint}' bullet, so a retry hint
    joins the existing one on the same line instead of adding a bullet the
    training format never had."""
    return f"{base} {corrective}" if base else corrective


def _trim_to_band(headline: str, band: dict) -> str:
    """Hard ceiling. Can clip mid-phrase, which is why it only runs after the
    retries have had their chance at a naturally short headline."""
    words = headline.split()
    if len(words) <= band["max_words"]:
        return headline
    return " ".join(words[: band["max_words"]])


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
    length: str | None = None,
    user_id: str | None = None,
) -> HeadlineResponse:
    """
    Generate up to `count` distinct headline candidates inside the requested
    word band and persist them for a known caller.
    """
    resolved_length = resolve_headline_length(length)
    band = HEADLINE_LENGTHS[resolved_length]
    hints = HEADLINE_VARIATION_HINTS[:count]

    async def generate_one(hint: str | None):
        return await model_generate(
            "headline",
            text,
            category=category,
            length=resolved_length,
            variation_hint=hint or None,
        )

    results = await asyncio.gather(
        *[generate_one(hint) for hint in hints],
        return_exceptions=True,
    )

    # Slot i stays paired with hints[i] through the retry rounds, so a
    # regenerated candidate keeps the angle its variation hint asked for.
    candidates: list[str | None] = []
    provider = None
    total_latency = 0
    for outcome in results:
        if isinstance(outcome, BaseException):
            logger.warning("Headline candidate failed: %s", outcome)
            candidates.append(None)
            continue
        candidates.append(outcome.text)
        provider = provider or outcome.provider
        total_latency += outcome.latency_ms

    for _ in range(MAX_LENGTH_RETRY_ROUNDS):
        retry_slots = [
            i
            for i, candidate in enumerate(candidates)
            if candidate and _band_distance(candidate, band) > 0
        ]
        if not retry_slots:
            break

        retries = await asyncio.gather(
            *[
                generate_one(
                    _merge_hints(
                        hints[i] or None, _corrective_hint(candidates[i], band)
                    )
                )
                for i in retry_slots
            ],
            return_exceptions=True,
        )

        for slot, outcome in zip(retry_slots, retries):
            if isinstance(outcome, BaseException):
                # Keep the out-of-band candidate we already have; a failed
                # retry is not a reason to lose it.
                logger.warning("Headline length retry failed: %s", outcome)
                continue
            total_latency += outcome.latency_ms
            # Sampling can hand back something worse than what it replaces,
            # so a retry only wins when it's actually closer to the band.
            if _band_distance(outcome.text, band) < _band_distance(
                candidates[slot], band
            ):
                candidates[slot] = outcome.text

    headlines = _dedupe([_trim_to_band(c, band) for c in candidates if c])[:count]
    if not headlines:
        # Every candidate failed — surface the first error.
        first_error = next((r for r in results if isinstance(r, BaseException)), None)
        raise first_error or RuntimeError("Headline generation produced no output")

    record = {
        "article_text": text,
        "headlines": headlines,
        "count": len(headlines),
        "model_provider": provider,
        "latency_ms": total_latency,
    }
    saved = await persist_if_owned(save_generation, record, user_id)

    return HeadlineResponse(
        id=str(saved["id"]),
        headlines=headlines,
        length=HeadlineLengthInfo(
            id=resolved_length,
            min_words=band["min_words"],
            max_words=band["max_words"],
        ),
        model_used=provider,
        created_at=saved.get("created_at"),
    )
