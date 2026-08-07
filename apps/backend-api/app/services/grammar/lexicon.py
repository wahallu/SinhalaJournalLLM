"""
Frequency-based Sinhala spelling suggestions.

Why this exists
---------------
The grammar adapter memorises word forms rather than learning rules. Measured
identically across v22, v23 and v24 — three datasets, two step budgets — it
fixes a word it was taught 15/22 = 68% of the time and a word it never saw
26% of the time (Fisher exact p=0.0014). That 68% never moved once, so the
words it misses cannot be reached by training it on more words.

A frequency lexicon covers part of that gap, because it has nothing to
memorise: it only asks whether a near-identical spelling is much commoner in
real published Sinhala.

WHAT IT ACTUALLY BUYS
---------------------
Measured end to end on stage4 + stage5: of the 26 single-word errors v22 still
leaves after correcting, and against the 44 sentences it got right and must
stay silent on:

    caught 10 of 26 = 38% recall, 1 flag across the 44 clean sentences

and that single flag is පොලිසිය (0x) -> පොලීසිය (77,856x), which is a correct
suggestion the gold answer disagrees with. Flat from ratio 1 to 10; above 25
the knob only costs recall.

Two earlier figures here were wrong and are recorded so they are not repeated.
"~66%" scored against the gold corrections rather than against what survives
the model, and never required the suggested spelling to be right. "30% recall,
3 false flags" was measured against a lexicon counted straight off the raw
corpus, which was itself the bug below.

WHICH CORPUS MATTERS MORE THAN HOW MUCH
---------------------------------------
Built from Ada Derana + Vidusara (215k articles), deliberately NOT from ITN,
and deliberately not from both. Same benchmark, three corpora:

    ITN only          106k articles, 74,919 words   ->  23%
    Derana+Vidusara   215k articles, 78,537 words   ->  38%
    both combined     319k articles, 92,279 words   ->  31%   MORE words, WORSE

Adding ITN to a better-edited corpus makes the checker worse, and the mechanism
is exact. බිරිද (the misspelling) appears 0 times in Derana, which always
writes බිරිඳ — so it gets flagged. ITN publishes බිරිද 568 times, and because
_MAX_SEEN treats "the corpus knows this word" as evidence of correctness,
mixing ITN in converts the error into a known word and the checker falls
silent. Same story for කැදවීමේ. A badly-edited corpus does not average out
against a good one, it poisons it — so prefer the best-edited source available
over the biggest one available.

THE CORPUS IS STILL NOT AN AUTHORITY
------------------------------------
Every corpus tested gets about half the known-contaminated pairs wrong. ITN
publishes තරග 4,624 times against the correct තරඟ's 755; Derana is much better
on බරපතළ and බිරිඳ but worse on සක්‍රිය and නිලධාරිණිය. build_lexicon.py folds
each known misspelling into its correct form first, reusing the
human-adjudicated map behind the training data
(build_corpus_dataset.build_tables) rather than re-litigating it here.

That map does not cover everything, which is what _MAX_SEEN below is for. The
remaining ceiling is real: දුෂණ is deliberately not flagged, because the
leniency needed to catch it also "corrects" මඟහැර and බැණ, which are right as
written. Reaching those needs another curated pair, not a lower threshold.

SUGGESTIONS, NEVER EDITS
------------------------
Those false flags are why nothing here rewrites the text. The corpus contains
its own typos, proper nouns are rare by nature, and a rare word is often
simply correct. Applying a change on that evidence would introduce errors into
copy the model had already got right — the exact over-correction failure this
project spent v17-v18 removing. A flag a journalist can ignore costs nothing;
a silent edit costs trust.
"""

from __future__ import annotations

import gzip
import logging
import os
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

logger = logging.getLogger(__name__)

_LEXICON_PATH = os.path.join(os.path.dirname(__file__), "sinhala_lexicon.txt.gz")

_WORD_RE = re.compile(r"[඀-෿‍]+")

# The letters Sinhala writers actually confuse, as unordered pairs — a
# suggestion has to be able to go in either direction. Same set the corpus
# corruption generator uses (build_corpus_dataset.py CHAR_RULES), because that
# list was derived from real observed error patterns.
_CONFUSABLE = [
    ("ණ", "න"),  # ණ / න   murdhaja na
    ("ළ", "ල"),  # ළ / ල   murdhaja la
    ("ෂ", "ශ"),  # ෂ / ශ
    ("ෂ", "ස"),  # ෂ / ස
    ("ී", "ි"),  # ී / ි   long/short i
    ("ූ", "ු"),  # ූ / ු   long/short u
    ("ඳ", "ද"),  # ඳ / ද
    ("ඟ", "ග"),  # ඟ / ග
]

_SWAP = {}
for _a, _b in _CONFUSABLE:
    _SWAP.setdefault(_a, []).append(_b)
    _SWAP.setdefault(_b, []).append(_a)

# Two is enough for every real case measured (පරීක්ශන -> පරීක්ෂණ needs two).
# Three would multiply the candidate set without covering anything observed.
_MAX_SWAPS = 2

# The lexicon only speaks about words the corpus has essentially never seen.
#
# This is a correctness bar, not a tuning knob, which is why it is not admin-
# settable. Without it, frequency alone was measurably giving WRONG advice more
# often than right on clean text: 6 of 10 flags proposed a spelling that is
# itself the error — සක්‍රියව -> සක්‍රීයව, බැණ -> බැන, මඟහැර -> මගහැර. ITN
# publishes the wrong form of each more often than the right one, so no ratio
# threshold can separate them.
#
# Every one of those bad flags shared a property: the word as written is
# genuinely attested. Every true catch shared the opposite — පරීක්ශන and
# මියගගොස් appear zero times in 106k articles. Where both spellings are
# attested, frequency cannot distinguish "misspelling" from "correct but less
# common", so the honest move is silence. Where the written form is absent,
# "this is not a word" is a claim the corpus can actually support.
#
# 5 rather than 0 because the shipped file already drops anything under
# MIN_COUNT=3, so this admits absent words plus the 3-5x band; measured, that
# band adds recall without adding a single false flag.
_MAX_SEEN = 5


@dataclass(frozen=True)
class Suggestion:
    """One flagged word. Advisory only — nothing applies these."""

    position: int          # character offset in the text that was checked
    original: str
    suggestion: str
    seen: int              # corpus frequency of what the writer wrote
    suggestion_seen: int   # corpus frequency of the proposed spelling


@lru_cache(maxsize=1)
def _lexicon() -> dict[str, int]:
    """
    Word -> corpus frequency, loaded once per process.

    A missing lexicon degrades to "no suggestions" rather than raising: this is
    an advisory extra, and it must never be able to fail a grammar request that
    would otherwise have succeeded.
    """
    if not os.path.exists(_LEXICON_PATH):
        logger.warning("Sinhala lexicon missing at %s — suggestions disabled", _LEXICON_PATH)
        return {}
    words: dict[str, int] = {}
    try:
        with gzip.open(_LEXICON_PATH, "rt", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("#"):
                    continue
                word, _, count = line.rstrip("\n").partition("\t")
                if word and count:
                    words[word] = int(count)
    except Exception:
        logger.exception("Could not read the Sinhala lexicon — suggestions disabled")
        return {}
    logger.info("Sinhala lexicon loaded: %d words", len(words))
    return words


def _swap_candidates(word: str) -> set[str]:
    """Every form reachable by up to _MAX_SWAPS confusable-letter swaps."""
    sites = [i for i, ch in enumerate(word) if ch in _SWAP]
    out: set[str] = set()

    def recurse(current: str, start: int, depth: int) -> None:
        if depth == _MAX_SWAPS:
            return
        for idx_pos in range(start, len(sites)):
            i = sites[idx_pos]
            for replacement in _SWAP.get(current[i], ()):
                nxt = current[:i] + replacement + current[i + 1:]
                out.add(nxt)
                recurse(nxt, idx_pos + 1, depth + 1)

    recurse(word, 0, 0)
    out.discard(word)
    return out


def _doubled_candidates(word: str) -> set[str]:
    """
    Forms reachable by deleting one half of a doubled letter.

    Accidental repetition is its own error class — මියගගොස් for මියගොස් — and no
    letter swap can reach it.
    """
    return {
        word[:i] + word[i + 1:]
        for i in range(1, len(word))
        if word[i] == word[i - 1]
    }


# Sinhala vowel signs, same list the corpus corruption generator drops
# (build_corpus_dataset.py VOWEL_SIGNS).
_VOWEL_SIGNS = "ාැෑිීුූෘෙේෛොෝෞ"

# The anusvara (ං, nasalisation — "ministry" as අමාත්‍යාංශය vs. the typo
# අමාත්‍යාශය) is dropped by the exact same class of typo as a vowel sign — one
# character silently missing from an otherwise-correct word — and is restored
# the same way: try inserting it at every plausible position and let the
# lexicon counts decide. Kept separate from _VOWEL_SIGNS rather than folded
# into it because the two need different insertion rules below: a real vowel
# sign never stacks on another vowel sign, so the skip two lines down is
# correct for them, but ං routinely does follow one (අමාත්‍යාංශය is itself
# ...ය + ා + ං + ...) — folding it into _VOWEL_SIGNS would make it subject to
# a skip written for a constraint it doesn't share, and silently exclude the
# exact position this exists to catch.
_ANUSVARA = "ං"


def _dropped_vowel_candidates(word: str) -> set[str]:
    """
    Forms reachable by restoring a dropped vowel sign or anusvara.

    A third distinct error class: මෙහදී for මෙහිදී is a missing ි, which is
    neither a swap nor a repetition, so the two generators above cannot reach it
    at any threshold. Vowel signs and the anusvara only ever follow a
    consonant (or, for the anusvara, a vowel sign), so insertion is tried only
    in those positions rather than at every offset.

    Insertion stops before the final letter. A vowel sign appended at the very
    end of a Sinhala word is inflection, not a typo: නියමිතය and නියමිතයි are
    both correct, the first being the formal predicate ending news copy uses —
    and the colloquial form outnumbers it 10,149 to 766, so frequency alone
    would "correct" perfectly good journalism into the wrong register. Real
    dropped-vowel errors are word-internal.
    """
    out: set[str] = set()
    for i in range(1, len(word)):
        previous = word[i - 1]
        if previous == "‍" or previous == "්":
            continue
        if previous not in _VOWEL_SIGNS:
            for sign in _VOWEL_SIGNS:
                out.add(word[:i] + sign + word[i:])
        out.add(word[:i] + _ANUSVARA + word[i:])
    out.discard(word)
    return out


def check(text: str, min_ratio: int = 3, max_suggestions: int = 25) -> list[Suggestion]:
    """
    Flag words whose near-identical twin is far commoner in real Sinhala.

    `min_ratio` is the evidence bar: the proposed spelling must be at least this
    many times commoner than what was written. Since _MAX_SEEN already limits
    this to words the corpus barely knows, in practice it sets how established
    the suggested spelling has to be — measured flat from 1 to 10, losing recall
    above 25 without removing any flag. 3 is the default; 0 turns the whole
    layer off.

    Returns at most `max_suggestions`, commonest-first, so a badly OCR'd
    paste cannot produce a wall of noise.
    """
    lexicon = _lexicon()
    if not lexicon or not text:
        return []

    suggestions: list[Suggestion] = []
    # word -> (suggestion, written_count, suggestion_count) or None when the
    # word is fine. Purely a cache: the candidate generation below is the
    # expensive part and the answer cannot differ between two occurrences of
    # the same word.
    verdicts: dict[str, tuple[str, int, int] | None] = {}

    for match in _WORD_RE.finditer(unicodedata.normalize("NFC", text)):
        word = match.group(0)

        if word not in verdicts:
            verdicts[word] = _verdict(word, lexicon, min_ratio)

        verdict = verdicts[word]
        if verdict is None:
            continue

        suggestion, written, best_count = verdict
        # One entry per OCCURRENCE, not per distinct word. Skipping repeats
        # meant a misspelling used three times was underlined once and left
        # bare the other two, which reads as the checker having changed its
        # mind rather than as a deliberate limit.
        suggestions.append(
            Suggestion(
                position=match.start(),
                original=word,
                suggestion=suggestion,
                seen=written,
                suggestion_seen=best_count,
            )
        )

    # Commonest suggestion first so the cap keeps the best evidence, then back
    # into document order: a client marks by offset, and a list that jumps
    # around the article is hard to review against the text.
    suggestions.sort(key=lambda s: -s.suggestion_seen)
    return sorted(suggestions[:max_suggestions], key=lambda s: s.position)


def _verdict(
    word: str, lexicon: dict[str, int], min_ratio: int
) -> tuple[str, int, int] | None:
    """The suggestion for one word, or None when it should be left alone."""
    written = lexicon.get(word, 0)

    # A word the corpus knows is left alone, however much commoner its
    # neighbour is — see _MAX_SEEN. The cost is real: a misspelling common
    # enough to clear that bar is invisible here, and the fix for those is
    # CURATED_NORMALIZE in build_corpus_dataset (which folds the wrong form to
    # zero and so brings it back under this bar), not a looser threshold — the
    # same leniency that would catch දුෂණ also "corrects" මඟහැර and බැණ, which
    # are right as written.
    if written > _MAX_SEEN:
        return None

    candidates = (
        _swap_candidates(word)
        | _doubled_candidates(word)
        | _dropped_vowel_candidates(word)
    )
    best, best_count = None, 0
    for candidate in candidates:
        count = lexicon.get(candidate, 0)
        if count > best_count:
            best, best_count = candidate, count

    if best is None or best_count < min_ratio * max(written, 1):
        return None
    return best, written, best_count
