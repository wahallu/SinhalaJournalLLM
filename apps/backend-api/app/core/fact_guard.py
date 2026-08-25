"""Rule-based, retrain-independent check for factual drift between a source
article and a generated headline -- the gap the v19-vs-Claude comparison
flagged as the model's biggest weakness (invented casualty counts, swapped
money amounts, changed entities), addressed here without touching the model.

Three checks, deliberately different in how much they're trusted:

1. Numbers. Exact and cheap: every number in the headline is resolved to a
   base numeric value (unit words like "මිලියන"/"කෝටි" are folded in, so
   "මිලියන 110" and "කෝටි 11" compare equal) and checked against the same
   set extracted from the article. A mismatch is a hard fact -- the digit
   sequence genuinely doesn't appear, in any equivalent form, in the source.

2. Words. A heuristic, not NER: Sinhala carries no capitalization signal, so
   there's no reliable surface-form way to detect "this token is a person or
   place name." What's checked instead is source-grounding -- does this
   headline word appear verbatim anywhere in the article. Sinhala's
   inflectional morphology means a correct word can still get flagged if the
   model changed its grammatical form, so this is a prompt for human review,
   not a verdict, and callers should present it as such (see
   HeadlineFactCheck's docstring in app/schemas/headline.py).

3. Nonsense words. Stricter than (2), and trusted enough to drive a retry:
   a content word that's neither grounded in the article *nor* attested by
   the shared Sinhala news lexicon (app/services/grammar/lexicon.py, built
   from 215k published articles) isn't a real published word and isn't
   something the article said either -- almost always generation noise (a
   garbled or invented word form), not a legitimate rare entity. This is why
   it needs both conditions: a genuine rare place/person name the model
   copied correctly still passes because it's grounded in the article, even
   when the lexicon has never seen it.
"""

import re
from dataclasses import dataclass, field

from app.services.grammar import lexicon

_NUMBER = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?")

_UNIT_MULTIPLIERS = {
    "ලක්ෂ": 100_000,
    "මිලියන": 1_000_000,
    "කෝටි": 10_000_000,
    "බිලියන": 1_000_000_000,
}
_UNIT_WORD = re.compile("|".join(_UNIT_MULTIPLIERS))

# How far from a number a unit word can sit and still be treated as
# modifying it -- covers both orders news copy uses ("මිලියන 110" and
# "110 මිලියන") without reaching far enough to pick up an unrelated number's
# unit two clauses away.
_UNIT_WINDOW = 12


def _resolved_value(text: str, match: "re.Match[str]") -> float:
    value = float(match.group().replace(",", ""))
    window = text[max(0, match.start() - _UNIT_WINDOW) : match.end() + _UNIT_WINDOW]
    unit = _UNIT_WORD.search(window)
    return value * _UNIT_MULTIPLIERS[unit.group()] if unit else value


def extract_number_facts(text: str) -> set[float]:
    """Every number in `text`, resolved to its base numeric value."""
    text = text or ""
    return {_resolved_value(text, m) for m in _NUMBER.finditer(text)}


def unverified_numbers(article: str, headline: str) -> list[str]:
    """Numbers in `headline` (as they appear, in order, de-duplicated) whose
    resolved value doesn't match any number resolved from `article`."""
    article_facts = extract_number_facts(article)
    headline = headline or ""
    seen: set[str] = set()
    unverified: list[str] = []
    for match in _NUMBER.finditer(headline):
        raw = match.group()
        if raw in seen:
            continue
        seen.add(raw)
        if _resolved_value(headline, match) not in article_facts:
            unverified.append(raw)
    return unverified


_WORD = re.compile(r"[඀-෿]+|[A-Za-z]+")

# Common Sinhala function words and headline-verb forms -- excluded so the
# grounding check only flags content words (candidate names, places,
# organizations), not the grammatical scaffolding every headline shares.
_STOPWORDS = {
    "සහ", "හෝ", "ද", "ට", "ක්", "කට", "කින්", "ගේ", "ගෙන්", "වෙත", "වෙතින්",
    "තුළ", "තුල", "මගින්", "නිසා", "නිසාවෙන්", "වශයෙන්", "ලෙස", "පිළිබඳ",
    "සමග", "සමඟ", "වැනි", "වැනිදා", "මෙම", "මේ", "එම", "ඒ", "අද", "ඊයේ",
    "හෙට", "දක්වා", "දෙනෙකු", "දෙනා", "දෙනෙක්", "දෙනෙකුට", "දෙනෙකුගේ",
    "බව", "බවට", "බවත්", "වන", "වූ", "වේ", "වෙයි", "වීම", "වීමට", "වීමෙන්",
    "ඇති", "ඇත", "ඇතැයි", "කරයි", "කරන", "කළ", "කළේ", "කරගත්", "ලද", "ලදි",
    "ලබා", "ලබයි", "ලබාදෙයි", "සිදු", "සිදුවිය", "සිදුවේ", "පැවති",
    "පැවැත්වීම", "තිබෙන", "තිබේ", "නොවේ", "රට", "රටේ", "රජය", "රජයේ", "නව",
}

# Below this length a Sinhala token is almost always a particle/suffix
# fragment, not a content word worth grounding-checking.
_MIN_WORD_LEN = 3


def _headline_content_words(article: str, headline: str) -> tuple[set[str], list[str]]:
    """Article content words (as a set, for membership checks) and headline
    content words (de-duplicated, in order) -- the shared extraction both
    unverified_words() and nonsense_words() filter differently."""
    article_words = set(_WORD.findall(article or ""))
    seen: set[str] = set()
    headline_words: list[str] = []
    for word in _WORD.findall(headline or ""):
        if len(word) < _MIN_WORD_LEN or word in _STOPWORDS or word in seen:
            continue
        seen.add(word)
        headline_words.append(word)
    return article_words, headline_words


def unverified_words(article: str, headline: str) -> list[str]:
    """Headline words (content words only, de-duplicated, in order) that
    don't appear verbatim anywhere in `article`. See module docstring --
    heuristic, not NER."""
    article_words, headline_words = _headline_content_words(article, headline)
    return [word for word in headline_words if word not in article_words]


def nonsense_words(article: str, headline: str) -> list[str]:
    """Headline content words that are neither grounded in the article nor
    attested by the shared Sinhala news lexicon -- see module docstring
    point 3. Unlike unverified_words(), this is trusted enough to drive a
    regeneration retry."""
    article_words, headline_words = _headline_content_words(article, headline)
    return [
        word
        for word in headline_words
        if word not in article_words and not lexicon.contains(word)
    ]


@dataclass
class FactCheck:
    numbers_verified: bool
    unverified_numbers: list[str] = field(default_factory=list)
    unverified_words: list[str] = field(default_factory=list)


def check_headline(article: str, headline: str) -> FactCheck:
    bad_numbers = unverified_numbers(article, headline)
    return FactCheck(
        numbers_verified=not bad_numbers,
        unverified_numbers=bad_numbers,
        unverified_words=unverified_words(article, headline),
    )
