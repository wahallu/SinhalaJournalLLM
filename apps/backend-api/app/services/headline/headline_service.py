"""
Headline generation service.

The headline adapter produces one headline per prompt, so N distinct
candidates come from N prompt variations — each variation appends one extra
constraint line while staying inside the training format.

Length control is a two-layer affair. The requested band (short 3-5, medium
6-7, long 8-10 words) goes into the prompt, but no headline adapter is fully
length-conditioned yet — v17 saw the same fixed "4 to 7 words" line on all
48K training examples, and even v19 (length-conditioned + artifact-cleaned,
see SinAI-Training/CLAUDE.md) lands in-band ~80% of the time, not 100% — so
the prompt alone isn't a contract. This module is the layer that closes the
gap: out-of-band candidates are regenerated with an explicit corrective hint,
and anything still over the ceiling is trimmed to it. Under-length candidates
can't be repaired that way, so after the retries they're returned as-is
rather than dropped — a slightly short real headline beats an empty result.

Every candidate also passes through strip_headline_artifacts() before any of
that length logic runs. Scraper tags ("(වීඩියෝ)", "[Video]") still show up
occasionally even from the cleaned adapter and even with the article-side
cleanup in prompts.py's prompt_headline() — training-data cleanliness and
input cleanliness both reduce the rate, neither is a hard guarantee, so this
is the actual guarantee: no tag reaches a caller, full stop.

Fact-checking is the same shape of problem as length: no headline adapter is
trained to be factually constrained, so the prompt's "capture the key ...
number" line is a nudge, not a contract (the v19-vs-Claude comparison in
SinAI-Training found 0/42 reference numbers preserved exactly, with several
outright invented -- see fact_guard.py's docstring for the detection logic).
This module closes that gap the same way it closes the length gap: one
corrective retry round for a candidate whose numbers don't check out against
the source article, then a final rerank that puts number-verified candidates
first among whatever's left. Word-level (name/place) drift is surfaced in the
response for the frontend to show, but never drives a retry or a rerank --
see fact_guard.unverified_words()'s docstring for why that signal is too
heuristic to act on automatically.
"""

import asyncio
import logging
from typing import TYPE_CHECKING

from app.core import fact_guard
from app.core.model_gateway import add_tokens, model_generate
from app.core.prompts import (
    HEADLINE_LENGTHS,
    HEADLINE_VARIATION_HINTS,
    resolve_headline_length,
)
from app.core.text_cleaning import strip_headline_artifacts
from app.repositories.base import persist_if_owned
from app.repositories.headline_repository import save_generation
from app.schemas.headline import HeadlineFactCheck, HeadlineLengthInfo, HeadlineResponse

if TYPE_CHECKING:
    from app.core.research import Actor

logger = logging.getLogger(__name__)

# Extra regeneration rounds for candidates that miss the band. Each round is
# one model call per still-failing candidate, and the inference server
# serializes generations, so this trades latency for in-band rate — the reason
# it's a small number and not a loop-until-perfect.
MAX_LENGTH_RETRY_ROUNDS = 2

# Same trade-off as MAX_LENGTH_RETRY_ROUNDS, kept to a single round: a
# generic "don't invent numbers" hint either gets the model to drop/correct
# the bad number on the first retry or it doesn't, and there's no
# candidate-specific correction to escalate to on a second attempt (the
# service doesn't know which article number the model *meant*, only that the
# one it produced doesn't match).
MAX_FACT_RETRY_ROUNDS = 1

_FACT_CORRECTIVE_HINT = (
    "ලිපියේ නොමැති සංඛ්‍යා නිර්මාණය නොකරන්න; ලිපියේ ඇති සංඛ්‍යා පමණක් නිවැරදිව භාවිතා කරන්න."
)


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
    adapter: str | None = None,
    actor: "Actor | None" = None,
) -> HeadlineResponse:
    """
    Generate up to `count` distinct headline candidates inside the requested
    word band and persist them for a known caller.

    `adapter` pins every call this request makes — the initial fan-out and
    any length retries — to one specific headline model version, so a
    candidate never mixes output from two adapters.
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
            adapter=adapter,
        )

    results = await asyncio.gather(
        *[generate_one(hint) for hint in hints],
        return_exceptions=True,
    )

    # Slot i stays paired with hints[i] through the retry rounds, so a
    # regenerated candidate keeps the angle its variation hint asked for.
    candidates: list[str | None] = []
    provider = None
    adapter_used = None
    total_latency = 0
    # Summed across every call this request makes — the initial fan-out plus
    # each retry round — the same way latency already is.
    input_tokens, output_tokens = None, None
    for outcome in results:
        if isinstance(outcome, BaseException):
            logger.warning("Headline candidate failed: %s", outcome)
            candidates.append(None)
            continue
        candidates.append(strip_headline_artifacts(outcome.text))
        provider = provider or outcome.provider
        adapter_used = adapter_used or outcome.meta.get("adapter")
        total_latency += outcome.latency_ms
        input_tokens = add_tokens(input_tokens, outcome.meta.get("input_tokens"))
        output_tokens = add_tokens(output_tokens, outcome.meta.get("output_tokens"))

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
            input_tokens = add_tokens(input_tokens, outcome.meta.get("input_tokens"))
            output_tokens = add_tokens(output_tokens, outcome.meta.get("output_tokens"))
            retried_text = strip_headline_artifacts(outcome.text)
            # Sampling can hand back something worse than what it replaces,
            # so a retry only wins when it's actually closer to the band.
            if _band_distance(retried_text, band) < _band_distance(
                candidates[slot], band
            ):
                candidates[slot] = retried_text

    for _ in range(MAX_FACT_RETRY_ROUNDS):
        retry_slots = [
            i
            for i, candidate in enumerate(candidates)
            if candidate and fact_guard.unverified_numbers(text, candidate)
        ]
        if not retry_slots:
            break

        retries = await asyncio.gather(
            *[
                generate_one(_merge_hints(hints[i] or None, _FACT_CORRECTIVE_HINT))
                for i in retry_slots
            ],
            return_exceptions=True,
        )

        for slot, outcome in zip(retry_slots, retries):
            if isinstance(outcome, BaseException):
                # Keep the candidate we already have; a failed retry isn't a
                # reason to lose it.
                logger.warning("Headline fact-check retry failed: %s", outcome)
                continue
            total_latency += outcome.latency_ms
            input_tokens = add_tokens(input_tokens, outcome.meta.get("input_tokens"))
            output_tokens = add_tokens(output_tokens, outcome.meta.get("output_tokens"))
            retried_text = strip_headline_artifacts(outcome.text)
            # Only replace when the retry is strictly better — fewer
            # unverified numbers than what it's replacing — so sampling
            # handing back something worse never discards a candidate that
            # was already at least as good.
            if len(fact_guard.unverified_numbers(text, retried_text)) < len(
                fact_guard.unverified_numbers(text, candidates[slot])
            ):
                candidates[slot] = retried_text

    headlines = _dedupe([_trim_to_band(c, band) for c in candidates if c])[:count]
    if not headlines:
        # Every candidate failed — surface the first error.
        first_error = next((r for r in results if isinstance(r, BaseException)), None)
        raise first_error or RuntimeError("Headline generation produced no output")

    fact_checks = [fact_guard.check_headline(text, headline) for headline in headlines]
    # Prefer number-verified candidates for the top spot. A stable sort keeps
    # everything else about the fan-out's ordering untouched among ties, so
    # this only reshuffles when there's an actual fact issue to route around.
    order = sorted(range(len(headlines)), key=lambda i: not fact_checks[i].numbers_verified)
    headlines = [headlines[i] for i in order]
    fact_checks = [fact_checks[i] for i in order]

    record = {
        "article_text": text,
        "headlines": headlines,
        "count": len(headlines),
        "requested_count": count,
        "category": category,
        "length": resolved_length,
        "adapter": adapter_used or adapter,
        "model_provider": provider,
        "latency_ms": total_latency,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
    saved = await persist_if_owned(save_generation, record, user_id, actor)

    return HeadlineResponse(
        id=str(saved["id"]),
        headlines=headlines,
        fact_checks=[
            HeadlineFactCheck(
                numbers_verified=fc.numbers_verified,
                unverified_numbers=fc.unverified_numbers,
                unverified_words=fc.unverified_words,
            )
            for fc in fact_checks
        ],
        length=HeadlineLengthInfo(
            id=resolved_length,
            min_words=band["min_words"],
            max_words=band["max_words"],
        ),
        model_used=provider,
        adapter_used=adapter_used,
        created_at=saved.get("created_at"),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
