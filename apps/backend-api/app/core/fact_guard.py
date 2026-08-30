"""Rule-based, retrain-independent check for factual drift between a source
article and a generated headline -- the gap the v19-vs-Claude comparison
flagged as the model's biggest weakness (invented casualty counts, swapped
money amounts, changed entities), addressed here without touching the model.

Four checks, deliberately different in how much they're trusted:

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

4. Key numbers -- the mirror image of (1). Checks (1)-(3) all answer "is
   something in this headline wrong?", which leaves the opposite failure
   invisible: a headline that reports none of the article's figures is
   perfectly "verified" by (1), because it has no number to get wrong. For a
   casualty or amount story that omission is the whole story going missing
   ("Nepal flood death toll confirmed" where the article says 734 died), so
   salient_numbers()/includes_article_number()/missing_key_numbers() give the
   service a signal for it, and the same shape of corrective retry the other
   checks get. Unlike (1) it never holds a candidate back -- a figureless
   headline is weaker, not wrong -- it only drives a retry and the ranking.
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


# ── Key numbers ──
# Scoped to the article's lead, for two reasons. News copy puts the figure
# the story is *about* in its opening lines -- a number in the sixth
# paragraph is background, not what a headline is written from -- and the
# lead always sits inside the MAX_ARTICLE_CHARS window the model is actually
# shown, so a hint built from these can never name a number that prompt
# truncation cut out of the model's view.
_LEAD_CHARS = 600

# Calendar furniture rather than the story's figure: a bare four-digit year,
# and the "(25)" dateline parenthetical Sinhala news copy routinely opens
# with. Pushing either into a headline as "the key number" would be worse
# than leaving the headline figureless.
_YEAR = re.compile(r"^(?:19|20)\d{2}$")
_DATE_PARENTHETICAL = re.compile(r"\(\s*\d{1,2}\s*\)")


def salient_numbers(article: str, limit: int = 3) -> list[str]:
    """The article's headline-worthy figures -- as written, in order,
    de-duplicated, capped at `limit`.

    Empty means this article's lead reports no figure at all, which is the
    signal that it simply isn't a numbers story and nothing downstream should
    push a number into its headline."""
    lead = (article or "")[:_LEAD_CHARS]
    # Blanked rather than deleted so the ±_UNIT_WINDOW context around every
    # surviving number still lines up with the original text.
    lead = _DATE_PARENTHETICAL.sub(lambda m: " " * len(m.group()), lead)
    seen: set[str] = set()
    salient: list[str] = []
    for match in _NUMBER.finditer(lead):
        raw = match.group()
        if raw in seen or _YEAR.match(raw):
            continue
        seen.add(raw)
        salient.append(raw)
        if len(salient) >= limit:
            break
    return salient


def includes_article_number(article: str, headline: str) -> bool:
    """Whether the headline carries at least one number that actually
    resolves to a figure in the article -- the positive counterpart to
    unverified_numbers(), which can only ever report absence of error."""
    article_facts = extract_number_facts(article)
    headline = headline or ""
    return any(
        _resolved_value(headline, match) in article_facts
        for match in _NUMBER.finditer(headline)
    )


def missing_key_numbers(article: str, headline: str) -> list[str]:
    """The article's key figures when the headline reports none of them.

    Empty in both of the acceptable cases -- the headline already carries an
    article number, or the article has no key figure to carry -- so a
    non-empty result is exactly the actionable one: this story has a number
    in it and this headline dropped it."""
    if includes_article_number(article, headline):
        return []
    return salient_numbers(article)


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


# ── Stem grounding ──
# Sinhala inflects by suffix and compounds freely, so verbatim grounding is
# close to useless as a signal. Measured on the reported Nepal article, the
# exact-match check flagged six words in one headline -- "නේපාලය" (the
# *correct* country; the article writes "නේපාලයේ"), "වතුරෙන්" (correct; the
# article writes "ගංවතුරින්"), "මිය" and "ගිය" (both inside the article's
# "මියගිය"), "ඉහළට" (the article has "ඉහළ") -- and one real error. One true
# flag in six is not something any caller can act on, which is exactly why
# unverified_words() was documented as too heuristic to drive anything.
#
# Matching on a stem instead collapses all five false positives: a shared
# opening of _STEM_LEN characters survives suffix inflection and finds a word
# inside a compound, while a genuinely different entity shares nothing --
# "නෙදර්ලන්තයේ" and "නේපාලයේ" have one character in common. That is what
# makes the signal precise enough to act on; see unverified_words().
_STEM_LEN = 4
_SHORT_STEM_LEN = 3


def _stem(word: str) -> str:
    """The opening of `word` used for grounding. Shorter for short words, so
    a 4-character word like "ඉහළට" still matches the article's "ඉහළ" instead
    of needing itself verbatim."""
    return word[:_STEM_LEN] if len(word) > _STEM_LEN else word[:_SHORT_STEM_LEN]


# An ungrounded word this long is a name -- a country, a place, a person, an
# organisation -- rather than the general vocabulary a headline is free to
# paraphrase with. "නෙදර්ලන්තයේ" is 11 characters; the paraphrases that also
# come back ungrounded ("ගණන", "මරණ") are three. That length gap is what lets
# entity drift be held back while a synonym is merely ranked down.
_ENTITY_MIN_LEN = 5


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
    """Headline content words (de-duplicated, in order) that aren't grounded
    in `article` -- neither verbatim nor by stem.

    Still not NER, but no longer merely heuristic: stem matching removes the
    inflection and compounding false positives that made the verbatim version
    unusable (see the _STEM_LEN comment), so what survives is a word the
    article genuinely doesn't contain in any form. A legitimate synonym the
    model chose over the article's wording still lands here, which is why
    this ranks a candidate down rather than dropping it -- dropping is
    reserved for drifted_entities()."""
    article_text = article or ""
    _, headline_words = _headline_content_words(article, headline)
    return [word for word in headline_words if _stem(word) not in article_text]


def drifted_entities(article: str, headline: str) -> list[str]:
    """Ungrounded headline words long enough to be a name rather than
    ordinary vocabulary -- the reported "Netherlands for Nepal" failure.

    This is the part of unverified_words() worth acting on. A wrong country
    is a factual error of the same kind as an invented number; a synonym the
    article didn't happen to use is not, and the length floor is what
    separates them without needing NER Sinhala doesn't support."""
    return [
        word
        for word in unverified_words(article, headline)
        if len(word) >= _ENTITY_MIN_LEN
    ]


def nonsense_words(article: str, headline: str) -> list[str]:
    """Headline content words that are neither grounded in the article nor
    attested by the shared Sinhala news lexicon -- see module docstring
    point 3. Unlike unverified_words(), this is trusted enough to drive a
    regeneration retry."""
    article_words, headline_words = _headline_content_words(article, headline)
    article_text = article or ""
    return [
        word
        for word in headline_words
        if _stem(word) not in article_text and not lexicon.contains(word)
    ]


@dataclass
class FactCheck:
    numbers_verified: bool
    unverified_numbers: list[str] = field(default_factory=list)
    unverified_words: list[str] = field(default_factory=list)
    drifted_entities: list[str] = field(default_factory=list)
    # True in both good cases -- the headline reports one of the article's
    # figures, or the article had none to report -- so False specifically
    # means "this story had a number and the headline dropped it". Defaults
    # to True so a caller constructing a FactCheck by hand isn't forced to
    # reason about a signal it doesn't use.
    key_number_included: bool = True


def check_headline(article: str, headline: str) -> FactCheck:
    bad_numbers = unverified_numbers(article, headline)
    return FactCheck(
        numbers_verified=not bad_numbers,
        unverified_numbers=bad_numbers,
        unverified_words=unverified_words(article, headline),
        drifted_entities=drifted_entities(article, headline),
        key_number_included=not missing_key_numbers(article, headline),
    )
