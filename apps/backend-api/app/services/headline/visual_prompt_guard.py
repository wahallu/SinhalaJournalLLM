"""
Grounding checks for the English image prompt built from a Sinhala article.

The image is published next to the article, so anything in it that the
article doesn't support reads as a factual claim. The old prompt writer was
told to supply "subject, setting, lighting, mood, photographic style, camera
angle, and any key visual details" in 60-120 words at temperature 0.7, and it
met that quota by inventing them. Live output on four sample articles
(2026-10-18) included:

- "Matara" for the article's Mattala exit (මත්තල) -- a different town;
- "middle-aged" for a man the article says is 67 (හැටහත් හැවිරිදි);
- "bright midday sunlight" for a ceremony the article puts at 3.00 PM;
- a real head of state "delivering a speech" the article never reports;
- flags, lanterns, a cooking pot, a police officer, a capsized boat and a
  banner carrying a misquoted theme -- none of them in the source;
- a decomposing body, and a drowning victim's "lifeless" body in close-up.

The model now has to list the facts it is drawing on, each with the article
words it came from, and these checks hold the prompt to those facts:

1. Facts. A fact's `source` must actually appear in the article (ignoring
   ZWJ/ZWNJ and punctuation, with a stem fallback for inflection) and any
   digits in it must be the article's; a fact that fails is dropped, so it
   can't ground anything below.
2. Numbers. Every number in the prompt must be in the article or a verified
   fact. Sinhala often writes ages as words, so the English "67" can only be
   grounded through the fact that quotes "හැටහත් හැවිරිදි".
3. Names. A capitalised word mid-sentence is almost always a place,
   organisation or person, and must appear in the verified facts or in the
   article's own Latin text. This is what catches Matara-for-Mattala: the
   fact says Mattala, the prompt doesn't.
4. People. Names the model reported as real people must not appear at all:
   a photorealistic generated image of a named person is a fabricated photo.
5. Conditions. Time of day, weather, people's emotions and vague ages must
   be stated in the facts -- together these were the most common inventions.
6. Text and graphic content. No signs, banners or quoted words (image models
   render them as garbled or misquoted text) and no bodies, blood or injuries.

Every check returns readable issue strings, which the service sends back to
the model verbatim as the correction to make. Invented props and actions (the
cooking pot, the capsized boat) have no surface signal to match an English
prompt against a Sinhala article, so the service runs a separate model check
for those.
"""

import re
from dataclasses import dataclass

from app.core import fact_guard


@dataclass(frozen=True)
class Fact:
    detail: str   # English, as the model will use it in the prompt
    source: str   # the article words it was taken from


# ── Fact grounding ──

_JOINERS = re.compile("[‌‍]")
# \w alone splits Sinhala words at every vowel sign and virama (they are
# combining marks, not alphanumerics), so the Sinhala block is listed too.
_NON_WORD = re.compile(r"[^\w඀-෿]+")

# Same idea as fact_guard's stem matching: a source quote the model re-inflected
# still shares each word's opening with the article; an invented one doesn't.
_STEM_LEN = 4
_MIN_SOURCE_COVERAGE = 0.75


def _normalize(text: str) -> str:
    text = _JOINERS.sub("", text or "")
    return " ".join(_NON_WORD.sub(" ", text).split()).lower()


def is_grounded_source(source: str, article: str) -> bool:
    """Whether `source` is taken from `article`: verbatim after normalising,
    or with at least three quarters of its words found there by stem."""
    quote = _normalize(source)
    if not quote:
        return False
    text = _normalize(article)
    if quote in text:
        return True
    words = [w for w in quote.split() if len(w) >= 2]
    if not words:
        return False
    found = sum(1 for w in words if w[:_STEM_LEN] in text)
    return found / len(words) >= _MIN_SOURCE_COVERAGE


def verified_facts(facts: list[Fact], article: str) -> list[Fact]:
    """The facts whose source is really in the article. When the source
    carries digits, the detail's digits must be the article's too -- that
    catches "57-year-old" quoted from "56 හැවිරිදි". A source with no digits
    (a number written in words) is trusted for the detail's number."""
    article_numbers = fact_guard.extract_number_facts(article)
    kept = []
    for fact in facts:
        if not is_grounded_source(fact.source, article):
            continue
        if fact_guard.extract_number_facts(fact.source) and not (
            fact_guard.extract_number_facts(fact.detail) <= article_numbers
        ):
            continue
        kept.append(fact)
    return kept


def grounded_headline(article: str, headline: str) -> str:
    """`headline` if it is safe to show the prompt writer, else "".

    The web app sends the generated best headline, which can itself carry an
    invented number or a swapped entity (the UI already warns about the
    former). The prompt writer treated it as fact, so a drifted headline
    flowed straight into the image. It only ever helps pick the focus, so
    dropping it costs little."""
    headline = (headline or "").strip()
    if not headline:
        return ""
    if fact_guard.unverified_numbers(article, headline):
        return ""
    if fact_guard.drifted_entities(article, headline):
        return ""
    return headline


# ── Prompt checks ──

# The model writes U+2011 non-breaking hyphens ("blood‑donation"), which
# the patterns below would otherwise read as word breaks.
_HYPHENS = str.maketrans({c: "-" for c in "\u2010\u2011\u2012\u2013\u2212"})


def clean_prompt(prompt: str) -> str:
    return " ".join((prompt or "").translate(_HYPHENS).split())


# A sentence also ends after a closing quote or bracket: `... Co-existence.” Behind him`.
_SENTENCE_BREAK = re.compile(r"(?:(?<=[.!?:;])|(?<=[.!?:;][\"”’)]))\s+|\n+")
_LATIN_WORD = re.compile(r"[A-Za-z][A-Za-z'’]*(?:-[A-Za-z]+)*")
_POSSESSIVE = re.compile(r"['’]s$")

# Capitalised mid-sentence but not a claim about this story.
_ALWAYS_ALLOWED_NAMES = {"sri", "lanka", "lankan", "south", "asian", "dslr"}

# Kept out of the real-person check so the prompt may still say "the
# President" or "the Prophet's birthday" by role.
_ROLE_WORDS = {
    "president", "prime", "minister", "prophet", "mr", "mrs", "ms", "miss",
    "dr", "hon", "sir", "the", "of", "and",
}

_CONDITIONS = re.compile(
    r"\b(sunrise|sunset|dawn|dusk|twilight|morning|midday|noon|afternoon|"
    r"evening|night(?:time)?|golden hour|blue hour|moonlit|moonlight|"
    r"rain(?:y|ing)?|drizzle|storm(?:y)?|thunder\w*|fog(?:gy)?|mist(?:y)?|"
    r"haze|hazy|overcast|cloudy|clouds|sunny|sunshine|sunlight|sunlit|monsoon|"
    r"(?:clear|blue|cloudless|grey|gray) sk(?:y|ies))\b",
    re.IGNORECASE,
)
_EMOTIONS = re.compile(
    r"\b(frustrated|angry|furious|anxious|worried|grieving|grief[- ]stricken|"
    r"crying|weeping|tearful|in tears|mourn\w*|shock(?:ed)?|horrified|"
    r"terrified|panic\w*|distraught|anguish\w*|despair\w*|smiling|laughing|"
    r"cheering|jubilant)\b",
    re.IGNORECASE,
)
# "67-year-old man" is fine; "middle-aged man" for that 67-year-old was not.
_AGES = re.compile(
    r"\b(young|youthful|middle-aged|elderly|teenaged?|(?<!-)old (?:man|men|woman|women))\b",
    re.IGNORECASE,
)
_TEXT_ELEMENTS = re.compile(
    r"\b(texts?|captions?|headlines?|banners?|signs?|signboards?|signage|"
    r"placards?|posters?|billboards?|lettering|logos?|watermarks?|slogans?|"
    r"inscriptions?|writing|written)\b",
    re.IGNORECASE,
)
_QUOTED = re.compile(r"[\"“‘]([^\"”’]{2,})[\"”’]")
_GRAPHIC = re.compile(
    r"\b(corpses?|cadavers?|dead bod(?:y|ies)|lifeless|"
    r"blood(?![\s-]*(?:donat|donor|bank|drive))\w*|bleeding|gor(?:e|y)|"
    r"wounds?|wounded|injur\w*|decompos\w*|bloated|mutilat\w*|human remains|"
    r"(?:a|the|his|her|victim's|man's|woman's|child's)\s+(?:dead\s+)?"
    r"bod(?:y|ies)\b(?!\s+of\s+water))",
    re.IGNORECASE,
)
# "no text, logos or watermarks" mentions all three without asking for them.
_NEGATION = re.compile(
    r"\b(no|not|without|never|free of|avoid\w*|exclud\w*)\b[^.;!?]*$", re.IGNORECASE
)
_NEGATION_WINDOW = 40


def _negated(prompt: str, start: int) -> bool:
    return bool(_NEGATION.search(prompt[max(0, start - _NEGATION_WINDOW):start]))


def _collapse(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def _facts_text(facts: list[Fact]) -> str:
    return "\n".join(f.detail for f in facts)


def ungrounded_numbers(prompt: str, facts: list[Fact], article: str) -> list[str]:
    return fact_guard.unverified_numbers(f"{article}\n{_facts_text(facts)}", prompt)


def ungrounded_names(prompt: str, facts: list[Fact], article: str) -> list[str]:
    """Capitalised words, other than a sentence's first, that neither the
    verified facts nor the article's Latin text contain. Compared with
    punctuation and case removed, so "Milad-un-Nabi" matches "Milad un Nabi"."""
    grounded = _collapse(f"{_facts_text(facts)}\n{article}")
    found: list[str] = []
    for sentence in _SENTENCE_BREAK.split(prompt or ""):
        for i, match in enumerate(_LATIN_WORD.finditer(sentence)):
            word = _POSSESSIVE.sub("", match.group())
            key = _collapse(word)
            if (
                i == 0
                or not word[0].isupper()
                or len(key) < 3
                or key in _ALWAYS_ALLOWED_NAMES
                or key in grounded
                or word in found
            ):
                continue
            found.append(word)
    return found


def named_people_in(prompt: str, named_people: list[str]) -> list[str]:
    prompt_words = {_collapse(w) for w in _LATIN_WORD.findall(prompt or "")}
    found: list[str] = []
    for name in named_people:
        for part in re.split(r"[\s\-]+", name or ""):
            key = _collapse(part)
            if (
                len(key) >= 3
                and key not in _ROLE_WORDS
                and key in prompt_words
                and part not in found
            ):
                found.append(part)
    return found


def _unstated(pattern: re.Pattern, prompt: str, facts: list[Fact]) -> list[str]:
    stated = _facts_text(facts).lower()
    found: list[str] = []
    for match in pattern.finditer(prompt or ""):
        phrase = match.group().lower()
        if phrase in stated or phrase in found or _negated(prompt, match.start()):
            continue
        found.append(phrase)
    return found


def _present(pattern: re.Pattern, prompt: str) -> list[str]:
    found: list[str] = []
    for match in pattern.finditer(prompt or ""):
        phrase = match.group().lower()
        if phrase not in found and not _negated(prompt, match.start()):
            found.append(phrase)
    return found


def find_issues(
    prompt: str,
    facts: list[Fact],
    named_people: list[str],
    article: str,
) -> list[str]:
    """Everything in `prompt` the article doesn't support, phrased as the
    correction to make. `facts` must already be verified_facts()."""
    prompt = clean_prompt(prompt)
    issues = [
        f'the number "{n}" is not in the article'
        for n in ungrounded_numbers(prompt, facts, article)
    ]
    people = named_people_in(prompt, named_people)
    issues += [
        f'"{p}" names a real person -- refer to people only by role'
        for p in people
    ]
    issues += [
        f'"{n}" is not in the article or your verified facts -- use only places '
        "and names the article states, spelled as the article spells them"
        for n in ungrounded_names(prompt, facts, article)
        if n not in people
    ]
    issues += [
        f'"{c}" -- the article does not state the time of day, light or weather'
        for c in _unstated(_CONDITIONS, prompt, facts)
    ]
    issues += [
        f'"{e}" -- the article does not describe anyone\'s emotions or expressions'
        for e in _unstated(_EMOTIONS, prompt, facts)
    ]
    issues += [
        f'"{a}" -- give age only as the article states it'
        for a in _unstated(_AGES, prompt, facts)
    ]
    issues += [
        f'"{t}" -- the image must not contain text, signs, banners or logos'
        for t in _present(_TEXT_ELEMENTS, prompt)
    ]
    issues += [
        f'"{q}" -- quoted words get rendered as text in the image'
        for q in _QUOTED.findall(prompt or "")
    ]
    issues += [
        f'"{g}" -- do not show bodies, blood or injuries'
        for g in _present(_GRAPHIC, prompt)
    ]
    return issues
