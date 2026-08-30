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
This module closes that gap the same way it closes the length gap, for two
separate signals: an invented number (fact_guard.unverified_numbers()) and a
content word that's neither grounded in the article nor a real published
word (fact_guard.nonsense_words() -- catches generation noise like a garbled
verb ending without false-flagging genuine rare entity names, which stay
grounded in the article even when the shared lexicon has never seen them).
Each gets one corrective retry round naming the specific problem, not a
generic nudge, since the model needs to know what was wrong to fix it. Unlike
length, a candidate that still fails either check after its retry doesn't
just get reranked to the bottom: it's held back from the response entirely,
unconditionally -- the same guarantee strip_headline_artifacts() gives
scraper tags ("no tag reaches a caller, full stop") extended to invented
numbers and nonsense words, and, deliberately, extended further than the
scraper-tag case: a flagged headline is never an acceptable substitute, so
if every candidate in a batch still fails, the batch legitimately comes back
empty and generate_headlines() raises HeadlineQualityExhausted rather than
falling back to showing the least-bad option (see
app/api/v1/headline.py's handler for how the API surfaces that). Word-level
(name/place) drift -- fact_guard.unverified_words(), a strictly looser check
than nonsense_words() -- is surfaced in the response for the frontend to
show, but never drives a retry or a hold-back on its own; see that
function's docstring for why that signal is too heuristic to act on
automatically.

All of the above are one-directional: they detect and repair a headline that
says something *wrong*. That left the opposite failure with no handling at
all -- a headline that reports none of the article's numbers. Nothing
penalised it (fact_guard.unverified_numbers() is empty for a headline with
no number to get wrong, so numbers_verified is True and the reranker saw a
figureless candidate as tied with a correctly-numbered one), while every
mechanism above penalises *attempting* a number, so the selection pressure
across a fan-out ran the wrong way: play it safe, omit the figure. For a
casualty or amount story that hollows the headline out -- reported case: an
article stating 734 dead in Nepal's floods produced a top pick that
mentioned the floods and the deaths but no count at all. The counterweight
is fact_guard's key-number check, wired in here in the same three places the
other signals are: the fan-out hint names the article's own digits, a
missing-number round retries a figureless candidate once, and the rerank
prefers a candidate that carries the figure. Deliberately *not* wired into
the hold-back: a figureless headline is weaker, not wrong, and an empty
response is worse than a headline without a number.
"""

import asyncio
import logging
from typing import TYPE_CHECKING

from app.core import fact_guard
from app.core.model_gateway import add_tokens, model_generate
from app.core.prompts import (
    HEADLINE_LENGTHS,
    HEADLINE_VARIATION_HINTS,
    MAX_ARTICLE_CHARS,
    resolve_headline_length,
)
from app.core.text_cleaning import strip_article_media_tags, strip_headline_artifacts
from app.repositories.base import persist_if_owned
from app.repositories.headline_repository import save_generation
from app.schemas.headline import HeadlineFactCheck, HeadlineLengthInfo, HeadlineResponse

if TYPE_CHECKING:
    from app.core.research import Actor

logger = logging.getLogger(__name__)


class HeadlineQualityExhausted(RuntimeError):
    """Every candidate this request generated still failed fact-checking
    (invented number or nonsense word) even after its corrective retry.
    Distinct from a plain generation failure so the API layer can return a
    specific, clean error instead of an unhandled 500 -- see
    app/api/v1/headline.py's handler."""


# Since a flagged candidate is now held back unconditionally (never shown,
# not even as a last resort), a request that only generates exactly `count`
# candidates has exactly `count` independent chances to avoid
# HeadlineQualityExhausted. A dense, numbers-heavy article can fail every one
# of those chances at once -- reported case: a "long" (8-10 word) request on
# an article with 4 numbers and several foreign names, 5 requested, all 5
# still flagged after their retry. Generating a few more candidates than
# requested (capped at the hints available) gives more independent attempts
# to draw a clean one from before the final [:count] trim, which also
# incidentally makes hitting the full requested count more likely whenever
# a few candidates fail. This is a probability lever, not a guarantee -- a
# systematic model behavior (same wrong rounding every time) can still fail
# every candidate in a large batch, which is what HeadlineQualityExhausted
# is for.
_FACT_CHECK_HEADROOM = 3


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

# Same single-round reasoning as MAX_FACT_RETRY_ROUNDS. The hint here is
# already maximally concrete (it names the article's own digits), so a model
# that ignores it once has nothing more specific to be told on a second try.
MAX_NUMBER_RETRY_ROUNDS = 1


def _key_number_hint(numbers: list[str]) -> str:
    """The fan-out hint that asks for the article's figure by name.

    Naming the actual digits is the point: "include the key number" is a
    category the model can silently decide doesn't apply, while
    "include 734" is a copy instruction -- and because the digits come
    straight from the article, a headline that follows it passes
    unverified_numbers() by construction."""
    numbers_text = ", ".join(numbers)
    return (
        f"ලිපියේ වාර්තා වන ප්‍රධාන සංඛ්‍යා ({numbers_text}) අතරින් වඩාත් වැදගත් එක "
        "ලිපියේ ඇති අයුරින්ම ශීර්ෂ පාඨයට ඇතුළත් කරන්න."
    )


def _missing_number_hint(numbers: list[str]) -> str:
    """Retry wording for a candidate that came back with no figure at all.
    Distinct from _key_number_hint() on purpose: that one is already merged
    into this slot's hint, so repeating it verbatim would just restate an
    instruction this candidate has demonstrably ignored once. This one names
    the omission itself as the error, the way _fact_corrective_hint() names
    the bad number."""
    numbers_text = ", ".join(numbers)
    return (
        "ශීර්ෂ පාඨයේ සංඛ්‍යාවක් නොමැති නිසා එය අසම්පූර්ණය. "
        f"ලිපියේ ඇති සංඛ්‍යාවක් ({numbers_text}) ලිපියේ ඇති අයුරින්ම ඇතුළත් කරන්න."
    )


def _fact_corrective_hint(bad_numbers: list[str]) -> str:
    """Names the exact invented number(s) so the retry has something concrete
    to correct, instead of a generic 'don't invent numbers' nudge that gives
    the model no signal about what specifically was wrong."""
    numbers = ", ".join(bad_numbers)
    return (
        f"'{numbers}' යන සංඛ්‍යාව ලිපියේ නොමැත, එය වැරදිය. "
        "ලිපියේ ඇති නිවැරදි සංඛ්‍යාව පමණක් භාවිතා කරන්න."
    )


def _nonsense_corrective_hint(bad_words: list[str]) -> str:
    """Same approach as _fact_corrective_hint, for a headline word that's
    neither a real published word nor something the article said (see
    fact_guard.nonsense_words())."""
    words = ", ".join(bad_words)
    return (
        f"'{words}' යන වචනය වැරදි හෝ අර්ථවත් නොවේ. "
        "ලිපියේ අර්ථය නිවැරදිව විස්තර කරන සාමාන්‍ය සිංහල වචන පමණක් භාවිතා කරන්න."
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
    fanout = min(count + _FACT_CHECK_HEADROOM, len(HEADLINE_VARIATION_HINTS))
    hints = HEADLINE_VARIATION_HINTS[:fanout]

    # The figure this story is about, read from exactly the view of the
    # article the model is given -- prompt_headline() strips media tags then
    # truncates to MAX_ARTICLE_CHARS, so taking the numbers from the raw text
    # instead could name a figure that never reached the prompt.
    #
    # Merged into every slot rather than left to the one number-angle
    # variation hint: the base prompt's rules line offers a number as one of
    # four things a headline *may* capture, which the model satisfies with
    # person + event every time, and the canonical slot 0 -- the one that
    # usually wins the rerank -- carries no variation hint at all. Empty for
    # an article whose lead reports no figure, in which case nothing here
    # changes and no number gets pushed into a story that has none.
    key_numbers = fact_guard.salient_numbers(
        strip_article_media_tags(text)[:MAX_ARTICLE_CHARS]
    )
    if key_numbers:
        hints = [
            _merge_hints(hint or None, _key_number_hint(key_numbers)) for hint in hints
        ]

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

    # Mirror of the invented-number round below: that one repairs a headline
    # whose figure is wrong, this one repairs a headline that has no figure at
    # all. Runs first so that anything it adds is still subject to the
    # invented-number check afterwards -- a retry that hallucinates its way to
    # a number must not skip verification by arriving late.
    for _ in range(MAX_NUMBER_RETRY_ROUNDS if key_numbers else 0):
        retry_slots = [
            i
            for i, candidate in enumerate(candidates)
            if candidate and not fact_guard.includes_article_number(text, candidate)
        ]
        if not retry_slots:
            break

        retries = await asyncio.gather(
            *[
                generate_one(
                    _merge_hints(
                        hints[i] or None, _missing_number_hint(key_numbers)
                    )
                )
                for i in retry_slots
            ],
            return_exceptions=True,
        )

        for slot, outcome in zip(retry_slots, retries):
            if isinstance(outcome, BaseException):
                # Keep the figureless candidate; a failed retry isn't a reason
                # to lose a headline that is merely weaker, not wrong.
                logger.warning("Headline key-number retry failed: %s", outcome)
                continue
            total_latency += outcome.latency_ms
            input_tokens = add_tokens(input_tokens, outcome.meta.get("input_tokens"))
            output_tokens = add_tokens(output_tokens, outcome.meta.get("output_tokens"))
            retried_text = strip_headline_artifacts(outcome.text)
            # Two conditions, both required. The retry has to actually carry
            # an article number -- otherwise it's not an improvement on the
            # candidate it would replace -- and it must not have bought that
            # number by drifting further out of the length band, since
            # _trim_to_band() clips from the end and would happily cut off
            # the very figure this round exists to add.
            if fact_guard.includes_article_number(
                text, retried_text
            ) and _band_distance(retried_text, band) <= _band_distance(
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
                generate_one(
                    _merge_hints(
                        hints[i] or None,
                        _fact_corrective_hint(
                            fact_guard.unverified_numbers(text, candidates[i])
                        ),
                    )
                )
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

    for _ in range(MAX_FACT_RETRY_ROUNDS):
        retry_slots = [
            i
            for i, candidate in enumerate(candidates)
            if candidate and fact_guard.nonsense_words(text, candidate)
        ]
        if not retry_slots:
            break

        retries = await asyncio.gather(
            *[
                generate_one(
                    _merge_hints(
                        hints[i] or None,
                        _nonsense_corrective_hint(
                            fact_guard.nonsense_words(text, candidates[i])
                        ),
                    )
                )
                for i in retry_slots
            ],
            return_exceptions=True,
        )

        for slot, outcome in zip(retry_slots, retries):
            if isinstance(outcome, BaseException):
                logger.warning("Headline nonsense-word retry failed: %s", outcome)
                continue
            total_latency += outcome.latency_ms
            input_tokens = add_tokens(input_tokens, outcome.meta.get("input_tokens"))
            output_tokens = add_tokens(output_tokens, outcome.meta.get("output_tokens"))
            retried_text = strip_headline_artifacts(outcome.text)
            if len(fact_guard.nonsense_words(text, retried_text)) < len(
                fact_guard.nonsense_words(text, candidates[slot])
            ):
                candidates[slot] = retried_text

    # A candidate whose numbers or content words still don't check out after
    # the retries never reaches the caller — the same "full stop" guarantee
    # strip_headline_artifacts() gives scraper tags, extended to invented
    # numbers and nonsense words. Unconditional: a flagged headline is never
    # an acceptable substitute, even when it's the only candidate left, so
    # this can legitimately empty the batch — see the check below.
    def _is_clean(candidate: str) -> bool:
        return not fact_guard.unverified_numbers(
            text, candidate
        ) and not fact_guard.nonsense_words(text, candidate)

    generated_any_candidate = any(candidates)
    candidates = [c if c and _is_clean(c) else None for c in candidates]

    headlines = _dedupe([_trim_to_band(c, band) for c in candidates if c])[:count]
    if not headlines:
        if not generated_any_candidate:
            # Every model call itself failed — surface the first error.
            first_error = next((r for r in results if isinstance(r, BaseException)), None)
            raise first_error or RuntimeError("Headline generation produced no output")
        # Generation succeeded, but every candidate still had an invented
        # number or a nonsense word even after its retry — distinct from the
        # case above, and worth a distinct, catchable exception so the API
        # layer can give the caller a clean, specific error instead of an
        # unhandled 500.
        raise HeadlineQualityExhausted(
            "Every generated candidate failed fact-checking (invented number "
            "or nonsense word) even after a corrective retry."
        )

    fact_checks = [fact_guard.check_headline(text, headline) for headline in headlines]
    # Prefer number-verified candidates for the top spot, then among those
    # tied prefer one that actually reports the article's figure, and only
    # then fewer ungrounded content words.
    #
    # The middle key is what stops the first one from being vacuous. Every
    # candidate that reaches here is number-verified (the hold-back above
    # guarantees it), and a headline with no number at all is number-verified
    # too -- so on the first key alone a headline that correctly reports 734
    # dead ties with one that reports the deaths and drops the count, and the
    # stable sort hands the top spot to whichever the fan-out happened to
    # order first. key_number_included breaks that tie toward the headline
    # that carries the story. It is True whenever the article had no figure
    # to report, so this key is inert on non-numeric articles.
    #
    # unverified_words() is too heuristic to
    # block on -- Sinhala inflection produces false positives, see its
    # docstring -- but it's a real signal for *ordering*: a candidate using
    # a word nowhere in the article (e.g. reporting a "train" collision for
    # an article that's entirely about a bus) is a topic/entity drift the
    # number check can't see at all, since it never touches a number. A
    # stable sort keeps everything else about the fan-out's ordering
    # untouched among full ties, so this only reshuffles when there's an
    # actual fact or grounding issue to route around.
    order = sorted(
        range(len(headlines)),
        key=lambda i: (
            not fact_checks[i].numbers_verified,
            not fact_checks[i].key_number_included,
            len(fact_checks[i].unverified_words),
        ),
    )
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
                key_number_included=fc.key_number_included,
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
