"""Tokenization and factual-safety signals for neural grammar candidates."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field, replace
from typing import Iterable, Sequence

from app.services.grammar.orthography import normalize_nfc
from app.services.grammar.substitution_guard import is_probable_name

_TOKEN_RE = re.compile(
    r"https?://[^\s\"'“”‘’<>]+|www\.[^\s\"'“”‘’<>]+|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|"
    r"\d+(?:[.,:/-]\d+)*(?:%|％)?|"
    r"[\u0D80-\u0DFF\u200C\u200D]+|"
    r"[A-Za-z]+(?:[.'’-][A-Za-z]+)*|"
    r"\s+|[^\s]",
    re.UNICODE,
)
_NUMBER_RE = re.compile(r"\d+(?:[.,:/-]\d+)*(?:%|％)?")
_URL_RE = re.compile(r"(?:https?://|www\.)[^\s\"'“”‘’<>]+", re.I)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_SINHALA_RE = re.compile(r"^[\u0D80-\u0DFF\u200C\u200D]+$")
_LATIN_WORD_RE = re.compile(r"^[A-Za-z]+(?:[.'’-][A-Za-z]+)*$")
_OPEN_QUOTES = {'"': '"', "'": "'", "“": "”", "‘": "’"}
_CLOSE_QUOTES = {'"', "'", "”", "’"}
_ENTITY_TYPE_TERMS = frozenset({
    # Entity designators repeatedly present in the repository's journalism
    # datasets. Protecting the designator prevents the model changing what
    # kind of institution is being reported; complete names should still be
    # supplied through the newsroom glossary/metadata.
    "අමාත්‍යාංශය", "දෙපාර්තමේන්තුව", "විශ්වවිද්‍යාලය", "සමාගම",
    "සංස්ථාව", "කොමිසම", "පක්ෂය", "බැංකුව", "අධිකාරිය", "පුවත්පත",
})


@dataclass(frozen=True)
class Token:
    text: str
    start: int
    end: int
    kinds: frozenset[str] = field(default_factory=frozenset)

    @property
    def lexical(self) -> bool:
        return bool(_SINHALA_RE.fullmatch(self.text) or _LATIN_WORD_RE.fullmatch(self.text) or self.text.isdigit())


def _base_kinds(text: str, protected_terms: set[str]) -> set[str]:
    kinds: set[str] = set()
    if _URL_RE.fullmatch(text):
        kinds.add("url")
    if _EMAIL_RE.fullmatch(text):
        kinds.add("email")
    if _NUMBER_RE.fullmatch(text):
        kinds.add("number")
    if text in protected_terms:
        kinds.add("entity")
    return kinds


def tokenize(text: str, protected_terms: Iterable[str] = ()) -> list[Token]:
    """Tokenize losslessly and annotate protected quoted/factual spans."""
    text = normalize_nfc(text)
    terms = {normalize_nfc(term) for term in protected_terms if term}
    protected_ranges = [
        (start, start + len(term))
        for term in terms
        for start in _occurrences(text, term)
    ]
    out: list[Token] = []
    expected_close: str | None = None

    for match in _TOKEN_RE.finditer(text):
        value = match.group(0)
        kinds = _base_kinds(value, terms)
        if any(match.start() < end and start < match.end() for start, end in protected_ranges):
            kinds.add("entity")
        if expected_close is not None:
            kinds.add("quote")

        if value in _OPEN_QUOTES:
            kinds.add("quote")
            if expected_close is None:
                expected_close = _OPEN_QUOTES[value]
            elif value == expected_close:
                expected_close = None
        elif value in _CLOSE_QUOTES and value == expected_close:
            kinds.add("quote")
            expected_close = None

        out.append(Token(value, match.start(), match.end(), frozenset(kinds)))
    return out


def _occurrences(text: str, term: str) -> Iterable[int]:
    start = 0
    while term:
        found = text.find(term, start)
        if found < 0:
            return
        yield found
        start = found + len(term)


def probable_entity_terms(text: str) -> set[str]:
    """High-precision entity-like tokens available without an NER dependency."""
    terms: set[str] = set()
    for match in _TOKEN_RE.finditer(normalize_nfc(text)):
        token = match.group(0).strip(".,;:!?\"'“”‘’()[]{}")
        if not token:
            continue
        if is_probable_name(token) or token in _ENTITY_TYPE_TERMS:
            terms.add(token)
        elif _LATIN_WORD_RE.fullmatch(token) and any(char.isupper() for char in token):
            # Mixed-script copy routinely carries Latin names/acronyms. Do not
            # silently normalize those without a newsroom-approved glossary.
            terms.add(token)
    return terms


def segment_kinds(tokens: Sequence[Token]) -> frozenset[str]:
    found: set[str] = set()
    for token in tokens:
        found.update(token.kinds)
    return frozenset(found)


def lexical_words(tokens: Sequence[Token]) -> list[str]:
    return [token.text for token in tokens if token.lexical]


def protected_counters(text: str) -> dict[str, Counter[str]]:
    """Comparable factual values; counters preserve duplicates."""
    text = normalize_nfc(text)
    return {
        "number": Counter(_NUMBER_RE.findall(text)),
        "url": Counter(_URL_RE.findall(text)),
        "email": Counter(_EMAIL_RE.findall(text)),
    }


def mark_probable_entities(tokens: Sequence[Token], probable_terms: Iterable[str]) -> list[Token]:
    """Add an entity label for caller-supplied or independently detected terms."""
    terms = set(probable_terms)
    return [
        replace(token, kinds=token.kinds | {"entity"}) if token.text in terms else token
        for token in tokens
    ]
