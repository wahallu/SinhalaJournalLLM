"""
Sentence-final form restoration: three positional rules, not spelling ones.

Some Sinhala words are complete mid-sentence and truncated at the end of one,
or vice versa — the frequency lexicon cannot see this because it only compares
word counts, and the "wrong" form is often the commoner one overall, just not
in this position. Each rule here is precision-first: every condition is
required, and an unattested target is skipped rather than invented.

1. PARTICIPLE  -මින් -> -මිනි   (කරමින් -> කරමිනි)
   Literary present participle. -මින් is correct mid-sentence and wrong at
   the end of one. Measured on 30,001 Derana articles: sentence-final
   position takes -මිනි 90.6% of the time (202 vs 21), while -මින් appears
   16,616 times mid-sentence — essentially all of the model's training
   signal for this string says the plain form is fine, because it is, almost
   everywhere except the one position this rule targets.

2. COLLOQUIAL VERB  -නව -> -නවා   (තිබෙනව -> තිබෙනවා, කරනව -> කරනවා)
   Reported: තිබෙනව was left uncorrected at a sentence end. -නවා is the
   standard colloquial present-tense verb ending (කරනවා, යනවා, එනවා, ...);
   a bare -නව missing its final ා is not a separate valid form the way
   -මින්/-මිනි are — it is simply incomplete. Measured on the same sample,
   at sentence-final position specifically: 127 occurrences across 34 verb
   stems end bare -නව (0.77%), against 16,376 ending -නවා. Not a lexicon
   candidate: _dropped_vowel_candidates deliberately never inserts at the
   final position (see lexicon.py) because for OTHER endings that position is
   genuine inflection, not a typo — this rule is the position-restricted
   exception, scoped to exactly the ending where the corpus shows there is no
   legitimate bare form to protect.

3. PARTICIPLE-ADJECTIVE  නියමිත -> නියමිතය   (closed-class, one word)
   "Scheduled/due" bare, with no predicate suffix, is not a complete
   sentence-final predicate in Sinhala — needs either -ය (formal) or -යි
   (colloquial). Measured sentence-final: නියමිත. bare is 2 occurrences
   against 7,100 for නියමිතය. and 789 for නියමිතයි. — bare is essentially
   never correct there. Between the two valid completions the formal -ය wins
   9:1 AT THIS POSITION, the opposite of its usage elsewhere (lexicon.py's
   dropped-vowel guard cites නියමිතයි outnumbering නියමිතය generally 10,149 to
   766) — position, not overall frequency, decides which one this rule picks.

All three share one shape: detect the word at a sentence end, check it against
a rule, and require the target to be attested in the lexicon before proposing
it. Advisory only, like every other suggestion here — surfaced for a human,
never applied on its own.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# A Sinhala word immediately followed by a sentence terminator. The terminator
# may carry closing punctuation first — a quote or bracket sits between the
# word and the stop without changing that the word ends the sentence.
_SENTENCE_FINAL = re.compile(r"([඀-෿‍]+)([\"'”’)\]]*\s*)(\.|$)")

# Words this whole module must never touch, keyed by which rule would
# otherwise fire on them.
_EXCLUDED: dict[str, frozenset[str]] = {
    "participle": frozenset({
        "ස්වාමින්",  # vocative noun ("Lord", "Sir"), not a verb form — counts
                      # sit at 439 vs ස්වාමිනි's 453, near parity either way.
    }),
    "verb": frozenset({
        "නව",  # "new"/"nine" — the bare word IS the suffix. Also excluded
               # structurally below (a stem must precede the suffix), kept
               # here as a second, independent guard.
    }),
}

# Minimum characters required before the -නව suffix, so the rule only ever
# fires on an actual verb stem and never on the standalone word නව itself.
_MIN_VERB_STEM = 1


@dataclass(frozen=True)
class FinalFormSuggestion:
    """Same shape as lexicon.Suggestion, so callers can merge the two lists."""

    position: int
    original: str
    suggestion: str
    seen: int
    suggestion_seen: int


def _attested(lexicon: dict[str, int], word: str) -> int:
    return lexicon.get(word, 0)


def _check_participle(word: str, lexicon: dict[str, int]) -> str | None:
    """-මින් -> -මිනි. See rule 1 in the module docstring."""
    suffix, final = "මින්", "මිනි"
    if not word.endswith(suffix) or word in _EXCLUDED["participle"]:
        return None
    corrected = word[: -len(suffix)] + final
    return corrected if _attested(lexicon, corrected) > 0 else None


def _check_verb(word: str, lexicon: dict[str, int]) -> str | None:
    """-නව -> -නවා. See rule 2 in the module docstring."""
    suffix = "නව"
    if word in _EXCLUDED["verb"] or len(word) < len(suffix) + _MIN_VERB_STEM:
        return None
    if not word.endswith(suffix):
        return None
    corrected = word + "ා"
    return corrected if _attested(lexicon, corrected) > 0 else None


def _check_niyamita(word: str, lexicon: dict[str, int]) -> str | None:
    """නියමිත -> නියමිතය. See rule 3 in the module docstring."""
    if word != "නියමිත":
        return None
    corrected = "නියමිතය"
    return corrected if _attested(lexicon, corrected) > 0 else None


# Checked in order; the first rule to match a word wins, so a word cannot be
# double-flagged by two rules (none currently overlap, but order is still
# meaningful if that ever changes).
_RULES = (_check_participle, _check_verb, _check_niyamita)


def check(text: str, lexicon: dict[str, int] | None = None) -> list[FinalFormSuggestion]:
    """
    Flag words at a sentence end that need a different ending than they have.

    `lexicon` supplies the attestation check. Without one every rule is
    skipped entirely rather than guessed at — an unattested suggestion is
    worse than no suggestion, and this layer has no other way to tell a real
    word form from a string that merely ends in the right letters.
    """
    if not text or not lexicon:
        return []

    out: list[FinalFormSuggestion] = []
    for match in _SENTENCE_FINAL.finditer(unicodedata.normalize("NFC", text)):
        word = match.group(1)

        for rule in _RULES:
            corrected = rule(word, lexicon)
            if corrected is None:
                continue
            out.append(
                FinalFormSuggestion(
                    position=match.start(1),
                    original=word,
                    suggestion=corrected,
                    seen=lexicon.get(word, 0),
                    suggestion_seen=lexicon.get(corrected, 0),
                )
            )
            break  # one rule per word — see _RULES ordering note above

    return out
