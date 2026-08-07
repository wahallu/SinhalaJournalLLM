"""
Sentence-final participle form: `-මින්` → `-මිනි`.

A positional rule, not a spelling one. `කරමින්` is correct in the middle of a
sentence and wrong at the end of one, where literary Sinhala takes `කරමිනි`.
Nothing in the frequency lexicon can see this: it compares word counts, and
both forms are real words.

Why the grammar model does not do it either, measured on 30,001 Derana
articles and the 215k-article lexicon:

    -මින් mid-sentence (correct there)      16,616 occurrences in the sample
    -මිනි sentence-final (correct there)       202
    -මින් sentence-final (the error)            21

    sentence-final position takes -මිනි        90.6% of the time

The model sees `-මින්` 200,087 times across the corpus, essentially always
mid-sentence, all of it evidence that the form is fine. The positional contrast
appears in 35 of cleaned_v10's 36,006 training rows — 0.1%. There is nothing to
learn from, which is why this is a rule and not a data problem.

Precision comes from three conditions, all required:

1. The word sits immediately before a sentence end. Mid-sentence `-මින්` is
   correct and is never touched — that is 16,616 of the 16,637 occurrences in
   the sample, so a rule that ignored position would be wrong far more often
   than right.
2. The `-මිනි` counterpart is attested in the corpus. This is what stops the
   rule inventing a form for a verb that has none.
3. The word is not in EXCLUDED. `ස්වාමින්` is a vocative noun, not a
   participle, and its counts sit at 439 against `ස්වාමිනි`'s 453 — near
   parity, in a word where both spellings are right in different senses.

Advisory, like every other suggestion: it is surfaced for a human, never
applied on its own.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

_PARTICIPLE_SUFFIX = "මින්"
_FINAL_SUFFIX = "මිනි"

# Words ending in -මින් that are not present participles, so the sentence-final
# rule does not apply to them.
EXCLUDED: frozenset[str] = frozenset({
    "ස්වාමින්",   # vocative noun ("Lord", "Sir"), not a verb form
})

# A Sinhala word immediately followed by a sentence terminator. The terminator
# may carry closing punctuation first — a quote or bracket sits between the
# word and the stop without changing that the word ends the sentence.
_SENTENCE_FINAL = re.compile(r"([඀-෿‍]+)([\"'”’)\]]*\s*)(\.|$)")


@dataclass(frozen=True)
class FinalFormSuggestion:
    """Same shape as lexicon.Suggestion, so callers can merge the two lists."""

    position: int
    original: str
    suggestion: str
    seen: int
    suggestion_seen: int


def check(text: str, lexicon: dict[str, int] | None = None) -> list[FinalFormSuggestion]:
    """
    Flag present participles used at the end of a sentence.

    `lexicon` supplies the attestation check. Without one the rule is skipped
    entirely rather than guessed at — an unattested suggestion is worse than no
    suggestion, and this layer has no other way to tell a real verb form from a
    string that merely ends in the right letters.
    """
    if not text or not lexicon:
        return []

    out: list[FinalFormSuggestion] = []
    for match in _SENTENCE_FINAL.finditer(unicodedata.normalize("NFC", text)):
        word = match.group(1)

        if not word.endswith(_PARTICIPLE_SUFFIX) or word in EXCLUDED:
            continue

        corrected = word[: -len(_PARTICIPLE_SUFFIX)] + _FINAL_SUFFIX
        attested = lexicon.get(corrected, 0)
        if attested <= 0:
            continue

        out.append(
            FinalFormSuggestion(
                position=match.start(1),
                original=word,
                suggestion=corrected,
                seen=lexicon.get(word, 0),
                suggestion_seen=attested,
            )
        )
    return out
