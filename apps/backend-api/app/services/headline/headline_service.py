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
import time
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


class HeadlineBudgetExhausted(RuntimeError):
    """No candidate came back before this request's wall-clock budget ran
    out. Distinct from a provider error (there was nothing wrong with the
    inference server, it was just too slow for the router in front of this
    app) and from HeadlineQualityExhausted (candidates arrived, they just
    didn't pass), so the API layer can tell the caller the one thing that is
    actually actionable: try a shorter article or a shorter length."""


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


# Regeneration rounds for candidates that still have something wrong with
# them. Each round is one model call per still-failing candidate and the
# inference server serialises generations, so this trades latency for
# quality — the reason it's a small number and not a loop-until-perfect.
# Every corrective a candidate needs travels in a single merged hint, so
# two rounds is two attempts at *all* of its problems, not two attempts at
# one of them.
MAX_REPAIR_ROUNDS = 2

# ── Wall-clock budget ──
# The deployment sits behind Heroku's router, which cuts off any request that
# hasn't produced a response byte within 30 seconds (H12) and answers with a
# 503 of its own. That 503 is generated upstream of this app, so it carries
# none of the CORS headers main.py installs -- the browser sees an opaque
# cross-origin failure, the frontend's fetch() rejects, and the UI can only
# say "Failed to fetch". The user never learns that anything timed out, and
# no amount of error handling on either side can tell them, because the
# response was never readable.
#
# The 30 seconds is a hard platform limit and not configurable, so the only
# real defence is not to exceed it. This budget is what the fan-out and the
# repair rounds run inside: when it's spent, generation stops and returns the
# best candidates it already has. A headline that missed its band, or a
# batch smaller than `count`, is worth far more than an H12 the frontend
# can't even describe.
#
# Set below 30s to leave room for the DB write and serialisation that follow.
HEADLINE_BUDGET_SECONDS = 22.0


def _expired(deadline: float) -> bool:
    return time.monotonic() >= deadline


async def _gather_within(coros: list, deadline: float) -> tuple[list, bool]:
    """Run `coros` concurrently but abandon whatever hasn't finished by
    `deadline`, cancelling it.

    Returns results positionally aligned with `coros` -- None for anything
    that didn't finish -- and whether the deadline cut the round short. This
    is what makes a slow inference server degrade into fewer headlines
    instead of into an H12: a request always has something to return."""
    tasks = [asyncio.ensure_future(c) for c in coros]
    remaining = max(0.0, deadline - time.monotonic())
    done, pending = await asyncio.wait(tasks, timeout=remaining)
    for task in pending:
        task.cancel()
    if pending:
        # Let the cancellations actually land before moving on, so no request
        # is left in flight against a serialised inference server, competing
        # with the next round for the GPU.
        await asyncio.gather(*pending, return_exceptions=True)
    results = []
    for task in tasks:
        if task in done:
            results.append(task.exception() or task.result())
        else:
            results.append(None)
    return results, bool(pending)


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


def _entity_corrective_hint(bad_entities: list[str]) -> str:
    """Names the drifted entity so the retry has something concrete to
    correct. The reported failure was a headline about නෙදර්ලන්තයේ (the
    Netherlands) for an article about නේපාලයේ (Nepal) -- a word the lexicon
    attests, so the nonsense-word guard could never see it, and one the
    verbatim grounding check buried among five inflection false positives."""
    entities = ", ".join(bad_entities)
    return (
        f"'{entities}' යන නම ලිපියේ නොමැත. ලිපියේ සඳහන් රට, ස්ථානය සහ "
        "පුද්ගලයන්ගේ නම් පමණක් භාවිතා කරන්න."
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


def _quality_score(
    text: str, candidate: str, band: dict, key_numbers: list[str]
) -> tuple[int, int, int, int, int]:
    """How bad this candidate is, lowest is best, compared lexicographically.

    Ordered by consequence, not by severity of the writing problem. The first
    three can cost the candidate its place in the response (the hold-backs
    below drop them), the fourth gets silently clipped by _trim_to_band(),
    and the fifth only costs the candidate rank -- so a retry is an
    improvement exactly when it trades a later problem for an earlier one,
    never the reverse."""
    return (
        len(fact_guard.unverified_numbers(text, candidate)),
        len(fact_guard.nonsense_words(text, candidate)),
        len(fact_guard.drifted_entities(text, candidate)),
        _band_distance(candidate, band),
        0
        if not key_numbers or fact_guard.includes_article_number(text, candidate)
        else 1,
    )


def _correctives(
    text: str, candidate: str, band: dict, key_numbers: list[str]
) -> str:
    """Every correction this candidate needs, merged into one hint, or "" when
    it needs none.

    One hint rather than one round per problem: the model needs to be told
    what was specifically wrong to fix it, but it can be told several things
    at once, and a round costs a serialised generation per candidate."""
    parts: list[str] = []

    bad_numbers = fact_guard.unverified_numbers(text, candidate)
    if bad_numbers:
        parts.append(_fact_corrective_hint(bad_numbers))

    bad_words = fact_guard.nonsense_words(text, candidate)
    if bad_words:
        parts.append(_nonsense_corrective_hint(bad_words))

    bad_entities = [e for e in fact_guard.drifted_entities(text, candidate)
                    if e not in bad_words]
    if bad_entities:
        parts.append(_entity_corrective_hint(bad_entities))

    length_hint = _corrective_hint(candidate, band)
    if length_hint:
        parts.append(length_hint)

    # Last, and only when nothing above already applies to a number: a
    # missing figure is the mildest of the four, and stacking it onto a
    # candidate that is also inventing numbers gives the model two
    # contradictory-sounding instructions about digits in one breath.
    if key_numbers and not bad_numbers and not fact_guard.includes_article_number(
        text, candidate
    ):
        parts.append(_missing_number_hint(key_numbers))

    return " ".join(parts)


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
    deadline = time.monotonic() + HEADLINE_BUDGET_SECONDS
    resolved_length = resolve_headline_length(length)
    band = HEADLINE_LENGTHS[resolved_length]
    fanout = min(count + _FACT_CHECK_HEADROOM, len(HEADLINE_VARIATION_HINTS))
    hints = HEADLINE_VARIATION_HINTS[:fanout]

    # The figure this story is about, read from exactly the view of the
    # article the model is given -- prompt_headline() strips media tags then
    # truncates to MAX_ARTICLE_CHARS, so taking the numbers from the raw text
    # instead could name a figure that never reached the prompt.
    #
    # Used here only to decide whether a candidate is *missing* a figure.
    # Asking for it is prompt_headline()'s job now: this was merged onto every
    # variation hint first, and the live model ignored it in every candidate
    # (see the comment on number_rule there), so the requirement moved into
    # the rules block where the same computation runs off the same view of
    # the article. Empty for an article whose lead reports no figure, in
    # which case nothing below pushes a number into a story that has none.
    key_numbers = fact_guard.salient_numbers(
        strip_article_media_tags(text)[:MAX_ARTICLE_CHARS]
    )

    async def generate_one(hint: str | None):
        return await model_generate(
            "headline",
            text,
            category=category,
            length=resolved_length,
            variation_hint=hint or None,
            adapter=adapter,
        )

    # Deadline-bounded like the repair rounds below: on a slow inference
    # server the fan-out alone can outlast the router's patience, and eight
    # candidates nobody ever receives are worth less than the three that
    # arrived in time.
    results, _ = await _gather_within(
        [generate_one(hint) for hint in hints], deadline
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
        if outcome is None:
            # Cancelled by the deadline rather than failed. Distinguished from
            # the exception case only in the log line: both leave an empty
            # slot the repair loop skips.
            logger.warning("Headline candidate abandoned at the deadline")
            candidates.append(None)
            continue
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

    # ── Repair ──
    # One deadline-bounded loop, not one sequential round per signal.
    #
    # It used to be four: two length rounds, then a missing-number round, an
    # invented-number round and a nonsense-word round. Because they ran back
    # to back and the inference server serialises generations, a candidate
    # that was both out-of-band and figureless -- the normal case for a
    # "long" request, since the adapter under-shoots the 8-10 band and omits
    # figures -- cost three sequential calls to fix two problems, and the
    # worst case reached 8 + 8*5 = 48 calls for a single request. Computing
    # every applicable corrective per candidate and sending them as one
    # merged hint fixes both problems in one call and caps the whole repair
    # phase at MAX_REPAIR_ROUNDS * fanout.
    for _ in range(MAX_REPAIR_ROUNDS):
        if _expired(deadline):
            logger.warning("Headline repair budget spent; returning candidates as-is")
            break

        repairs = {
            i: _correctives(text, candidate, band, key_numbers)
            for i, candidate in enumerate(candidates)
            if candidate
        }
        retry_slots = [i for i, hint in repairs.items() if hint]
        if not retry_slots:
            break

        retries, timed_out = await _gather_within(
            [generate_one(_merge_hints(hints[i] or None, repairs[i])) for i in retry_slots],
            deadline,
        )

        for slot, outcome in zip(retry_slots, retries):
            if outcome is None:
                continue  # cancelled by the deadline
            if isinstance(outcome, BaseException):
                # Keep the candidate we already have; a failed retry is never
                # a reason to lose one.
                logger.warning("Headline repair retry failed: %s", outcome)
                continue
            total_latency += outcome.latency_ms
            input_tokens = add_tokens(input_tokens, outcome.meta.get("input_tokens"))
            output_tokens = add_tokens(output_tokens, outcome.meta.get("output_tokens"))
            retried_text = strip_headline_artifacts(outcome.text)
            # Sampling can hand back something worse than what it replaces, so
            # a retry only wins on a strict improvement in the combined score
            # -- which also stops a retry that fixes the length from being
            # accepted when it invented a number on the way.
            if _quality_score(text, retried_text, band, key_numbers) < _quality_score(
                text, candidates[slot], band, key_numbers
            ):
                candidates[slot] = retried_text

        if timed_out:
            logger.warning("Headline repair round hit the deadline; stopping repairs")
            break

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

    # Entity drift is held back *conditionally*, unlike an invented number.
    #
    # A wrong country is as wrong as a wrong casualty count, so a candidate
    # naming one should never be shown when a candidate that got it right
    # exists. But the signal isn't as exact as the number check: the length
    # floor in drifted_entities() separates a swapped name from a paraphrase
    # by proxy, and a long ordinary word the article happened not to use can
    # land on the wrong side of it. Dropping those unconditionally would
    # empty batches over a synonym. Conditioning on a clean alternative gives
    # the guarantee where it can be had -- a drifted candidate never outranks
    # or displaces a grounded one -- and costs only variety where it can't.
    if any(c and not fact_guard.drifted_entities(text, c) for c in candidates):
        candidates = [
            c if c and not fact_guard.drifted_entities(text, c) else None
            for c in candidates
        ]

    headlines = _dedupe([_trim_to_band(c, band) for c in candidates if c])[:count]
    if not headlines:
        if not generated_any_candidate:
            # Every model call itself failed, or none of them came back
            # before the deadline — surface the first real error if there was
            # one, and say plainly that it was a timeout if there wasn't.
            first_error = next((r for r in results if isinstance(r, BaseException)), None)
            if first_error:
                raise first_error
            raise HeadlineBudgetExhausted(
                "No headline candidate completed within "
                f"{HEADLINE_BUDGET_SECONDS:.0f}s"
            )
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
            len(fact_checks[i].drifted_entities),
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
                drifted_entities=fc.drifted_entities,
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
