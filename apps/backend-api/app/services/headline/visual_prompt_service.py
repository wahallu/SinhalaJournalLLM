"""
Visual prompt generation service.

Reads a Sinhala news article (and optional headline) via Groq and produces an
English prompt for text-to-image models (Stable Diffusion, DALL-E, GPT Image,
etc.) that shows only what the article states -- the image is published
alongside the article, so an invented detail is a factual error.

The model answers in two parts: the visual facts it is using, each with the
article words it took them from, and the prompt built from those facts. Then:

1. visual_prompt_guard checks the facts against the article and the prompt
   against the facts -- numbers, names, real people, time/weather/emotions,
   text and graphic content.
2. A prompt that passes goes to a second, temperature-0 call that sees only
   the article and the prompt and lists anything the article doesn't state.
   This is for invented props and actions, which have no surface form the
   rule-based checks could match across Sinhala and English.

Whatever either step flags goes back to the model as a named correction, up
to _MAX_CORRECTIONS times. See visual_prompt_guard's docstring for what the
earlier free-form version was inventing.
"""

import json
import logging
import re
from dataclasses import dataclass

from app.core.groq_client import GroqUnavailable, groq_chat
from app.services.headline import visual_prompt_guard as guard

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You write English prompts for a text-to-image model from Sinhala news articles. \
The image is published next to the article, so it must show only what the article \
states. An invented detail is a factual error in published news.

Reply with JSON only, in exactly this shape:
{"facts": [{"detail": "...", "source": "..."}], "named_people": ["..."], "prompt": "..."}

facts: the concrete details the article states that an image can show -- what \
happened or is scheduled, where, who (role, how many, and age or gender only if \
stated), objects, actions, and the time, date or weather only if stated.
- "detail" is in English. Transliterate place names exactly as the Sinhala spells \
them; never substitute a similar or better-known place (මත්තල is Mattala, not Matara).
- "source" is the article's own words for that detail, copied character for \
character in Sinhala. Never translate or paraphrase it.

named_people: every real person the article names, in English.

prompt: one photorealistic news-photograph prompt of 40-80 words, built only from \
your facts.
- Every person, object, action, place and condition in it must come from a fact. \
Do not add people, crowds, props, vehicles, animals, decorations, flags, weather, \
time of day, season, light colour, facial expressions or emotions the article \
does not state.
- You may choose only the photographic style, camera distance and angle, and \
composition. If the article gives no time or weather, say "natural light".
- Show one real scene. If the article names several locations, show one of them \
and name only that one.
- If the event is announced or scheduled, show the setting as described; do not \
invent what anyone said or did.
- Do not name anyone or depict a real person's likeness: describe people only by \
role, such as "officials" or "fishermen". Never depict prophets, deities or \
religious figures.
- For deaths, injuries and crime, never show bodies, blood or injuries; show the \
place the article names.
- No text, captions, signs, banners, logos or watermarks, and no quoted words.
- A headline, if given, only tells you the focus. Where it differs from the \
article, follow the article."""

_CHECK_PROMPT = """\
You check an English image prompt against the Sinhala news article it was written \
from. The image is published with the article, so it may show only what the article \
states.

List every concrete element of the prompt that the article does not state: people, \
crowds, objects, vehicles, animals, decorations, actions, states (such as capsized or \
floating), ages, quantities, places, time of day, weather and emotions. An element is \
supported when the article states it, or when it is the plain setting of something \
stated (the sea for a drowning at sea, a road for a traffic jam). Photographic style, \
camera angle, composition and "natural light" are always allowed.

Reply with JSON only: {"unsupported": ["<element, worded as in the prompt>"]} -- an \
empty list when everything is supported."""

# Each round names exactly what to fix, so one or two normally settle it; the
# cap bounds the extra latency, since a user is waiting on this endpoint.
_MAX_CORRECTIONS = 2
# Was 0.7, which is a creativity setting -- the opposite of what this needs.
_TEMPERATURE = 0.2
# The old 300 fit a bare prompt. Sinhala source quotes cost several tokens per
# word, and the facts that ground the prompt now come first.
_MAX_TOKENS = 1500
_CHECK_MAX_TOKENS = 600

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)
_SENTENCE = re.compile(r"(?:(?<=[.!?])|(?<=[.!?][\"”’)]))\s+")


@dataclass
class _Draft:
    prompt: str
    facts: list[guard.Fact]
    named_people: list[str]


def _build_user_message(article_text: str, headline: str) -> str:
    headline_line = f"Headline (focus only): {headline}\n\n" if headline else ""
    return f"{headline_line}Article (Sinhala):\n{article_text}"


def _json_object(reply: str) -> dict | None:
    match = _JSON_OBJECT.search(reply or "")
    if not match:
        return None
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _parse(reply: str) -> _Draft | None:
    data = _json_object(reply)
    if data is None:
        return None
    prompt = data.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return None
    raw_facts = data.get("facts") if isinstance(data.get("facts"), list) else []
    raw_people = data.get("named_people") if isinstance(data.get("named_people"), list) else []
    return _Draft(
        prompt=guard.clean_prompt(prompt),
        facts=[
            guard.Fact(str(f.get("detail") or ""), str(f.get("source") or ""))
            for f in raw_facts
            if isinstance(f, dict)
        ],
        named_people=[p for p in raw_people if isinstance(p, str)],
    )


async def _unsupported_elements(article_text: str, prompt: str) -> list[str]:
    """Elements of `prompt` the article doesn't state, per the check call.
    Fails open: the rule-based checks have already passed, and a failed
    check shouldn't cost the user the prompt."""
    messages = [
        {"role": "system", "content": _CHECK_PROMPT},
        {"role": "user", "content": f"Article (Sinhala):\n{article_text}\n\nImage prompt:\n{prompt}"},
    ]
    try:
        reply = await groq_chat(messages, temperature=0.0, max_tokens=_CHECK_MAX_TOKENS)
    except GroqUnavailable:
        logger.warning("Visual prompt check call failed; using the rule-based checks only", exc_info=True)
        return []
    data = _json_object(reply)
    items = data.get("unsupported") if data else None
    if not isinstance(items, list):
        logger.warning("Visual prompt check reply was not the expected JSON")
        return []
    return [item.strip() for item in items if isinstance(item, str) and item.strip()]


def _correction(issues: list[str], dropped: list[guard.Fact]) -> str:
    lines = ["Your prompt includes details the article does not support:"]
    lines += [f"- {issue}" for issue in issues]
    if dropped:
        lines.append(
            "These facts cannot be used because their source is not in the article "
            "(copy the source character for character, or drop the fact):"
        )
        lines += [f'- {f.detail} (source: "{f.source}")' for f in dropped]
    lines.append(
        "Fix every point by removing the detail or correcting it to what the "
        "article says -- never replace one guess with another. Reply with the "
        "full JSON again."
    )
    return "\n".join(lines)


def _without_flagged_sentences(
    draft: _Draft,
    facts: list[guard.Fact],
    unsupported: list[str],
    article: str,
) -> str:
    """Last resort once corrections run out: keep the opening sentence, which
    carries the subject, and drop any later sentence that still has an issue.
    Losing an atmosphere sentence is better than publishing what it invented."""
    flagged = [u.lower() for u in unsupported]

    def clean(sentence: str) -> bool:
        lowered = sentence.lower()
        return not guard.find_issues(sentence, facts, draft.named_people, article) and not any(
            u in lowered for u in flagged
        )

    sentences = _SENTENCE.split(draft.prompt)
    return " ".join(s for i, s in enumerate(sentences) if i == 0 or clean(s))


async def generate_visual_prompt(article_text: str, headline: str = "") -> str:
    """
    Produce an English image-generation prompt grounded in the article.

    Args:
        article_text: The Sinhala article body -- the only source of facts.
        headline:     The chosen headline. Used only to pick the focus, and
                      ignored if it isn't grounded in the article.

    Returns:
        An English image-generation prompt string.

    Raises:
        GroqUnavailable: if the API key is missing or the first call fails.
        RuntimeError: if the model never returns a usable prompt.
    """
    focus = guard.grounded_headline(article_text, headline)
    if headline.strip() and not focus:
        logger.info("Visual prompt: headline isn't grounded in the article; ignoring it")

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_message(article_text, focus)},
    ]

    logger.info("Generating visual prompt via Groq (article length=%d chars)", len(article_text))

    # Ranked by (rule-based issues, check-call issues): a rule-based issue is a
    # hard mismatch, and the check call only runs once there are none.
    best: tuple[tuple[int, int], _Draft, list[guard.Fact], list[str]] | None = None
    for attempt in range(_MAX_CORRECTIONS + 1):
        try:
            reply = await groq_chat(messages, temperature=_TEMPERATURE, max_tokens=_MAX_TOKENS)
        except GroqUnavailable:
            # A failed correction round shouldn't throw away a usable draft.
            if best is None:
                raise
            logger.warning("Visual prompt correction round failed; keeping the best draft", exc_info=True)
            break

        draft = _parse(reply)
        if draft is None:
            logger.warning("Visual prompt attempt %d: reply was not the expected JSON", attempt + 1)
            correction = 'Reply with only the JSON object described, with a non-empty "prompt".'
        else:
            facts = guard.verified_facts(draft.facts, article_text)
            issues = guard.find_issues(draft.prompt, facts, draft.named_people, article_text)
            unsupported = [] if issues else await _unsupported_elements(article_text, draft.prompt)
            score = (len(issues), len(unsupported))
            if best is None or score <= best[0]:
                best = (score, draft, facts, unsupported)
            if not issues and not unsupported:
                return draft.prompt
            issues += [f'"{u}" -- the article does not state this' for u in unsupported]
            logger.info("Visual prompt attempt %d flagged: %s", attempt + 1, issues)
            correction = _correction(issues, [f for f in draft.facts if f not in facts])

        messages = messages + [
            {"role": "assistant", "content": reply},
            {"role": "user", "content": correction},
        ]

    if best is None:
        raise RuntimeError("Groq returned no usable visual prompt")

    _, draft, facts, unsupported = best
    prompt = _without_flagged_sentences(draft, facts, unsupported, article_text)
    logger.warning(
        "Visual prompt still flagged after corrections: %s",
        guard.find_issues(prompt, facts, draft.named_people, article_text),
    )
    return prompt
