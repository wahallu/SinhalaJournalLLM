"""
Deterministic grammar rules for formal written (journalistic) Sinhala.

Why this exists: the neural grammar adapter mostly repairs word spelling, and
the rule validator (rule_validator.py) only accepts, downgrades or blocks the
model's own edits — it never proposes a correction. So when an article has a
grammatical error the model leaves alone (a wrong case suffix, a singular verb
after a plural subject, an agent marked with විසින් on an active verb), nothing
in the pipeline fixes it. This module is that missing generator: a set of
pattern-scoped rules that run on the validated text and rewrite only the
constructions they recognise.

Scope, stated plainly: every rule is anchored on a governing word (the verb
that selects a case, a time word that selects a tense, the subject that
selects a verb ending) and is kept inside one clause. Sentences with direct
quotation are left alone, because quoted speech is reported as spoken. The
rules were tuned against 1.06M sentences of published Sinhala news, where
they must stay almost silent (see docs/research/grammar-journal-rules.md for
the measured firing rates and the rules that were tried and rejected).

Rules, in the order they run (later rules see earlier rules' output):

  SPELL_JOURNAL_001        curated journalism misspellings (word-initial)
  GRAM_CASE_ATTACH_001     ප්‍රදේශ වල / සමාගම ගේ        -> ප්‍රදේශවල / සමාගමගේ
  GRAM_TENSE_001           ඊයේ ... කරනු ඇත / හෙට ... කළේය -> කළේය / කරනු ඇත
  GRAM_VOICE_002           X විසින් ... පැවසීය            -> X ... පැවසීය
  GRAM_VOICE_001           X විසින් ... කළේය / දුන්හ     -> X විසින් ... කරන ලදී / දෙන ලදී
  GRAM_CASE_DATIVE_001     ජනතාවගෙන් අනතුරු ඇඟවීය       -> ජනතාවට අනතුරු ඇඟවීය
  GRAM_CASE_ABLATIVE_001   ජනතාවට ඉල්ලා සිටියේය         -> ජනතාවගෙන් ඉල්ලා සිටියේය
  GRAM_REGISTER_001        නිලධාරීහු ... කළා              -> නිලධාරීහු ... කළහ
  GRAM_AGR_001             නිලධාරීහු ... කළේය / ඇය ... කළේය / ඔවුහු ... කරයි
                                                        -> කළහ / කළාය / කරති
  GRAM_CLEFT_FOCUS_001     මේ බව පැවසුවේ ... අමතමින්.   -> ... අමතමිනි.
  GRAM_CLAUSE_001          ... අවධාරණය කළේ <clause>.     -> ... <clause> බවයි.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path
from typing import Callable

_DATA = Path(__file__).resolve().parent / "data" / "journal_verb_forms.json"

# ── Tokens ────────────────────────────────────────────────────────────────

_EDGE_PUNCT = ".,;:!?\"'“”‘’()[]{}«»…"
_QUOTES = frozenset("\"“”‘’")
# A full stop ends a sentence only before whitespace, so "10.00ට" stays whole.
_SENTENCE_END = re.compile(r"[.!?।]+(?=\s|$)|\n+")
_SINHALA_FINAL = re.compile(r"[඀-෿]$")


@dataclass(frozen=True)
class _Tok:
    core: str        # the word with edge punctuation removed
    start: int       # span of `core` in the text
    end: int
    comma_after: bool


@dataclass(frozen=True)
class _Edit:
    start: int
    end: int
    replacement: str
    rule_id: str


@dataclass(frozen=True)
class RuleHit:
    """One rule application, located in the text the rules returned."""

    rule_id: str
    category: str   # "grammar" | "spelling" — matches CorrectionDetail.type
    label: str      # bilingual explanation shown to the reader
    original: str
    corrected: str
    start: int      # span of the changed characters in the OUTPUT text
    end: int


def _sentences(text: str) -> list[tuple[int, int]]:
    spans, cursor = [], 0
    for match in _SENTENCE_END.finditer(text):
        if match.start() > cursor:
            spans.append((cursor, match.start()))
        cursor = match.end()
    if cursor < len(text):
        spans.append((cursor, len(text)))
    return spans


def _tokens(text: str, start: int, end: int) -> list[_Tok]:
    out: list[_Tok] = []
    for match in re.finditer(r"\S+", text[start:end]):
        raw = match.group()
        lead = len(raw) - len(raw.lstrip(_EDGE_PUNCT))
        core = raw.strip(_EDGE_PUNCT)
        if not core:
            continue
        s = start + match.start() + lead
        trailing = raw[lead + len(core):]
        out.append(_Tok(core, s, s + len(core), "," in trailing or ";" in trailing))
    return out


def _grammar_sentences(text: str):
    """Sentences grammar rules may touch: quoted speech is reported as spoken."""
    for s, e in _sentences(text):
        if not any(ch in _QUOTES for ch in text[s:e]):
            yield _tokens(text, s, e)


# ── Clause structure ─────────────────────────────────────────────────────

# Words that open or close an embedded clause; a rule never reaches across one.
_BOUNDARY_WORDS = frozenset({
    "බව", "බවත්", "බවද", "බවට", "බවටත්", "යැයි", "කියා", "ලෙස", "ලෙසත්", "ලෙසද",
    "නිසා", "විට", "අතර", "යනුවෙන්", "යනුවෙනි", "නම්", "හොත්", "බැවින්",
    "නමුත්", "එහෙත්", "යන",
})
# Quotative and subordinate endings fused onto a verb: ඇතැයි, තිබියදී, යද්දී, කළහොත්.
_BOUNDARY_ENDINGS = ("යැයි", "ැයි", "ැයිද", "යැයිද", "බවද", "බවත්", "යදී", "ද්දී", "හොත්", "බැවින්",
                     "යනුවෙන්ද", "යනුවෙනුත්")

# Relative/participial verb forms: a word before one of these belongs to an
# embedded clause ("පොලිසිය විසින් සිදු කළ විමර්ශනය"), not the main predicate.
_RELATIVE = frozenset({"කළ", "කරන", "ගත්", "ගන්නා", "දුන්", "දෙන", "ලද", "වූ", "කරනු",
                       "සිදුකළ", "ලැබූ", "ලැබුණු", "කෙරුණු", "යවන", "පැවති", "පැවැති"})


def _is_boundary(tok: _Tok) -> bool:
    return tok.core in _BOUNDARY_WORDS or tok.core.endswith(_BOUNDARY_ENDINGS)


def _clause_ok(tokens: list[_Tok], lo: int, hi: int) -> bool:
    """No comma and no clause boundary between token lo and token hi."""
    if any(tokens[k].comma_after for k in range(lo, hi)):
        return False
    return not any(_is_boundary(tokens[k]) for k in range(lo + 1, hi))


def _main_clause_start(tokens: list[_Tok], last: int) -> int:
    """Index where the clause ending at token `last` begins."""
    start = 0
    for k in range(last):
        if tokens[k].comma_after or _is_boundary(tokens[k]):
            start = k + 1
    return start


# ── Spelling (curated) ───────────────────────────────────────────────────

# Contested pairs are left out on purpose: පොලිසිය / පොලීසිය are both common in
# published news (18,960 vs 12,392 occurrences), so neither is "the" spelling.
_SPELLING_PREFIXES: tuple[tuple[str, str], ...] = (
    ("ශ්‍රෂ්ඨාධිකරණ", "ශ්‍රේෂ්ඨාධිකරණ"),
    ("බරපතල", "බරපතළ"),
    ("රෝගන්", "රෝගීන්"),
    ("ශබ්ධ", "ශබ්ද"),
    ("දූෂන", "දූෂණ"),
    ("විමර්ෂන", "විමර්ශන"),
    # The model sometimes half-fixes විමර්ෂන into one of these; both are still wrong.
    ("විමර්ෂණ", "විමර්ශන"),
    ("විමර්ශණ", "විමර්ශන"),
    ("ප්‍රකාෂ", "ප්‍රකාශ"),
    ("අධිකරන", "අධිකරණ"),
    ("අමාත්‍යාන්ශ", "අමාත්‍යාංශ"),
    ("සාක්ෂීකරු", "සාක්ෂිකරු"),
    ("පාර්ලිමෙන්තු", "පාර්ලිමේන්තු"),
)


def _rule_spelling(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        for tok in _tokens(text, s, e):
            for wrong, right in _SPELLING_PREFIXES:
                if tok.core.startswith(wrong):
                    edits.append(_Edit(tok.start, tok.start + len(wrong), right, "SPELL_JOURNAL_001"))
                    break
    return edits


# ── Bound case suffixes written as separate words ────────────────────────

_DETACHED_SUFFIXES = frozenset({"වල", "වලට", "වලින්", "වලදී", "වලත්", "වලද", "වලටත්", "වලින්ද",
                                "ගේ", "ගේද", "ගේත්"})


def _rule_case_attach(text: str) -> list[_Edit]:
    edits = []
    for tokens in _grammar_sentences(text):
        for k in range(1, len(tokens)):
            prev, tok = tokens[k - 1], tokens[k]
            if (
                tok.core in _DETACHED_SUFFIXES
                and not prev.comma_after
                and _SINHALA_FINAL.search(prev.core)
                and not prev.core.endswith("වල්")  # "වෙළඳපොළවල් වලින්" needs a rewrite, not a join
                and text[prev.end:tok.start].isspace()
            ):
                edits.append(_Edit(prev.end, tok.start, "", "GRAM_CASE_ATTACH_001"))
    return edits


# ── Tense ↔ time expression ─────────────────────────────────────────────

# (future, past masculine/neuter, past feminine, past plural)
_TENSE_ROWS: tuple[tuple[str, ...], ...] = (
    ("කරනු ඇත", "කළේය", "කළාය", "කළහ"),
    ("යනු ඇත", "ගියේය", "ගියාය", "ගියහ"),
    ("පැමිණෙනු ඇත", "පැමිණියේය", "පැමිණියාය", "පැමිණියහ"),
    ("දෙනු ඇත", "දුන්නේය", "දුන්නාය", "දුන්හ"),
    ("පැවැත්වෙනු ඇත", "පැවැත්විණි"),
    ("කෙරෙනු ඇත", "කෙරිණි"),
    ("වනු ඇත", "විය"),
)
_FUTURE_TO_PAST = {row[0]: row[1] for row in _TENSE_ROWS}
_PAST_TO_FUTURE = {past: row[0] for row in _TENSE_ROWS for past in row[1:]}

_PERIOD_NOUNS = ("දින", "සති", "මාස", "මස", "වසර", "සඳුදා", "අඟහරුවාදා", "බදාදා",
                 "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා", "ඉරිදා")
_PURPOSE_ENDINGS = ("ීමට", "ීමටත්", "ීමටද", "න්නට")
# Relative clauses a time word may belong to instead of the main verb.
_TENSE_RELATIVE_ENDINGS = ("ූ", "ුණු", "ුණ")
_TENSE_RELATIVE_WORDS = frozenset({"ඇති", "තිබූ", "තිබුණ", "කළ", "ගත්", "දුන්", "ලද"})
# හෙට used as a noun modifier ("හෙට දවස", "හෙට දිනක්") means "the future", not tomorrow.
_FIGURATIVE_AFTER_TOMORROW = ("දින", "දවස")
_MODALS = frozenset({"හැකි", "නොහැකි", "යුතු", "හැකිවනු"})


def _time_class(tokens: list[_Tok], k: int) -> str | None:
    word = tokens[k].core
    nxt = tokens[k + 1].core if k + 1 < len(tokens) else ""
    if word in {"ඊයේ", "පෙරේදා", "පසුගියදා", "ඉකුත්දා"}:
        return "past"
    if word in {"හෙට", "අනිද්දා"}:
        return None if nxt.startswith(_FIGURATIVE_AFTER_TOMORROW) and word == "හෙට" else "future"
    if word in {"අද", "දැන්"}:
        return "present"
    if nxt.startswith(_PERIOD_NOUNS):
        if word in {"පසුගිය", "ඉකුත්", "ගිය"}:
            return "past"
        if word == "ලබන":
            return "future"
    return None


def _final_predicate(tokens: list[_Tok], table) -> tuple[int, str] | None:
    """Index of the first token of a sentence-final predicate found in `table`."""
    for width in (2, 1):
        if len(tokens) >= width:
            phrase = " ".join(t.core for t in tokens[-width:])
            if phrase in table:
                return len(tokens) - width, phrase
    return None


def _rule_tense(text: str) -> list[_Edit]:
    edits = []
    for tokens in _grammar_sentences(text):
        markers = [(k, c) for k in range(len(tokens)) if (c := _time_class(tokens, k))]
        classes = {c for _, c in markers}
        if len(classes) != 1 or "present" in classes:
            continue  # no time word, or several pointing different ways
        marker_index, wanted = markers[-1]
        # "ඊයේ සිට බලාත්මක වනු ඇත", "පසුගිය දින කිහිපය තුළ": a span reaching
        # into the present, not a past point. (හෙට සිට still needs the future.)
        if wanted == "past" and any(t.core in {"සිට", "තුළ", "පුරාවට"} for t in tokens[marker_index + 1:marker_index + 5]):
            continue
        table = _FUTURE_TO_PAST if wanted == "past" else _PAST_TO_FUTURE
        found = _final_predicate(tokens, table)
        if not found:
            continue
        first, phrase = found
        between = tokens[marker_index + 1:first]
        if between and between[-1].core == "ඇති":  # "ඇති විය" is one predicate
            between = between[:-1]
        if (
            not _clause_ok(tokens, marker_index, first)
            # The time word modifies a relative clause or a purpose clause,
            # not the main verb: "ඊයේ සිදු වූ ගනුදෙනුව", "ලබන සතියේ කැඳවීමට".
            or any(
                t.core in _RELATIVE
                or t.core in _TENSE_RELATIVE_WORDS
                or t.core.endswith(_PURPOSE_ENDINGS + _TENSE_RELATIVE_ENDINGS)
                for t in between
            )
            or (first and tokens[first - 1].core in _MODALS)
        ):
            continue
        edits.append(_Edit(tokens[first].start, tokens[-1].end, table[phrase], "GRAM_TENSE_001"))
    return edits


# ── Voice: the agent marker විසින් ───────────────────────────────────────

_SPEECH_VERBS = frozenset({"පැවසීය", "පැවැසීය", "පැවසූහ", "පැවසුවාය", "කීය", "කීවේය", "කීහ",
                           "කීවාය", "කියා සිටියේය", "කියා සිටියහ", "කියා සිටියාය"})
_PASSIVE_OF = {
    "කළේය": "කරන ලදී", "කළහ": "කරන ලදී", "කළාය": "කරන ලදී",
    "ගත්තේය": "ගන්නා ලදී", "ගත්හ": "ගන්නා ලදී", "ගත්තාය": "ගන්නා ලදී",
    "දුන්නේය": "දෙන ලදී", "දුන්හ": "දෙන ලදී", "දුන්නාය": "දෙන ලදී",
    "පැවැත්වීය": "පවත්වන ලදී", "පැවැත්වූහ": "පවත්වන ලදී",
    "යැවීය": "යවන ලදී", "යැවූහ": "යවන ලදී",
    "තැබීය": "තබන ලදී", "තැබූහ": "තබන ලදී",
    "පිරිනැමීය": "පිරිනමන ලදී", "පිරිනැමූහ": "පිරිනමන ලදී",
}
# කළේය also ends compounds written as one word (සිදුකළේය, රැස්කළේය).
_JOINABLE = ("කළේය", "කළහ", "කළාය")


def _agent_index(tokens: list[_Tok], predicate_first: int, max_gap: int) -> int | None:
    """Index of a main-clause විසින් governing the predicate, if any."""
    for k in range(predicate_first - 1, max(-1, predicate_first - max_gap - 2), -1):
        if tokens[k].core == "විසින්":
            gap = tokens[k + 1:predicate_first]
            if any(t.core in _RELATIVE for t in gap):
                return None
            return k if _clause_ok(tokens, k, predicate_first) else None
    return None


def _rule_voice_speech(text: str) -> list[_Edit]:
    edits = []
    for tokens in _grammar_sentences(text):
        found = _final_predicate(tokens, _SPEECH_VERBS)
        if not found:
            continue
        agent = _agent_index(tokens, found[0], max_gap=5)
        if agent is None or agent == 0:
            continue
        # Delete the space before විසින් together with the word itself.
        edits.append(_Edit(tokens[agent - 1].end, tokens[agent].end, "", "GRAM_VOICE_002"))
    return edits


def _passive_form(word: str) -> str | None:
    if word in _PASSIVE_OF:
        return _PASSIVE_OF[word]
    for ending in _JOINABLE:
        if word.endswith(ending) and len(word) > len(ending):
            return word[: -len(ending)] + _PASSIVE_OF[ending]
    return None


def _rule_voice_passive(text: str) -> list[_Edit]:
    edits = []
    for tokens in _grammar_sentences(text):
        if not tokens or (passive := _passive_form(tokens[-1].core)) is None:
            continue
        if _agent_index(tokens, len(tokens) - 1, max_gap=6) is None:
            continue
        last = tokens[-1]
        edits.append(_Edit(last.start, last.end, passive, "GRAM_VOICE_001"))
    return edits


# ── Case marking governed by the verb ───────────────────────────────────

# Warning, advising and informing someone: the addressee is dative (-ට).
_DATIVE_NOUNS = frozenset({"අවවාද", "උපදෙස්", "දැනුම්"})
_DATIVE_LIGHT_VERBS = frozenset({"කළේය", "කළහ", "කළාය", "කළේ", "කරයි", "කරති", "කර", "කරමින්",
                                 "කළා", "කරනවා", "දුන්නේය", "දුන්හ", "දුන්නාය", "දුන්නේ",
                                 "දෙයි", "දෙති", "දී", "දෙමින්", "දුන්නා", "දෙනවා", "ලබා"})
_WARN_FORMS = ("ඇඟවී", "ඇඟවූ", "ඇඟවු", "අඟවයි", "අඟවති", "අඟවා", "අඟවමින්")


def _is_dative_verb(tokens: list[_Tok], j: int) -> bool:
    if j + 1 >= len(tokens):
        return False
    noun, verb = tokens[j].core, tokens[j + 1].core
    if noun == "අනතුරු":
        # ඇඟවීම is the noun "a warning", not the verb.
        return verb.startswith(_WARN_FORMS) and not verb.startswith("ඇඟවීම")
    if verb == "ලබා":
        give = tokens[j + 2].core if j + 2 < len(tokens) else ""
        return noun in _DATIVE_NOUNS and give.startswith(("දුන්", "දෙ", "දී"))
    return noun in _DATIVE_NOUNS and verb in _DATIVE_LIGHT_VERBS


# Requesting from and questioning someone: the source is ablative (-ගෙන්).
_ASK_SINGLE = frozenset({"විමසීය", "විමසූහ", "විමසුවේය", "විමසුවාය", "විමසුවේ", "විමසූයේ", "විමසා", "විමසමින්"})
_ASK_LIGHT = frozenset({"කළේය", "කළහ", "කළාය", "කළේ", "කළා", "කරයි", "කරති", "කරමින්", "කර"})
# -ගෙන් is the animate ablative, so only animate stems may take it.
_ANIMATE_STEMS = ("න්", "ජනතාව", "කරු", "වරයා", "වරිය", "මහතා", "මහත්මිය",
                  "තුමා", "තුමිය", "ඔහු", "ඇය", "දරුවා", "ළමයා")


def _is_ask_verb(tokens: list[_Tok], j: int) -> bool:
    if j >= len(tokens):
        return False
    # "ඔහුට ඉල්ලා සිටිය හැකිය": the -ට is the experiencer of හැකි, not the source.
    if any(t.core.startswith(("හැකි", "නොහැකි", "පුළුවන්", "සිදු")) for t in tokens[j + 1:j + 4]):
        return False
    word = tokens[j].core
    nxt = tokens[j + 1].core if j + 1 < len(tokens) else ""
    if word in _ASK_SINGLE:
        return True
    if word == "ඉල්ලා":
        return nxt.startswith(("සිටි", "සිටී"))
    return word == "ප්‍රශ්න" and nxt in _ASK_LIGHT


def _rule_case(text: str) -> list[_Edit]:
    edits = []
    for tokens in _grammar_sentences(text):
        for i, tok in enumerate(tokens):
            word = tok.core
            if word.endswith("ගෙන්") and len(word) > 4 and not tok.comma_after:
                for j in range(i + 1, min(len(tokens) - 1, i + 4)):
                    if _is_dative_verb(tokens, j):
                        gap = tokens[i + 1:j]
                        if (
                            _clause_ok(tokens, i, j)
                            and not any(t.core in _RELATIVE or t.core.endswith("ට") for t in gap)
                        ):
                            edits.append(_Edit(tok.end - 4, tok.end, "ට", "GRAM_CASE_DATIVE_001"))
                        break
            # A -ට noun with anything between it and the verb is usually a
            # beneficiary ("ජනතාවට යුක්තිය ඉල්ලා"), so only the adjacent case fires.
            elif (
                word.endswith("ට")
                and word[:-1].endswith(_ANIMATE_STEMS)
                and not tok.comma_after
                and _is_ask_verb(tokens, i + 1)
            ):
                edits.append(_Edit(tok.end - 1, tok.end, "ගෙන්", "GRAM_CASE_ABLATIVE_001"))
    return edits


# ── Subjects ──────────────────────────────────────────────────────────────

_LITERARY_PLURAL_ENDINGS = ("ීහු", "ූහු", "ුහු", "ීහූ", "ුහූ")
_PLURAL_ENDINGS = _LITERARY_PLURAL_ENDINGS + ("වරු", "කරුවෝ", "කයෝ", "ඥයෝ", "යයෝ")
_NOT_PLURAL = frozenset({"ඔහු", "මොහු"})
_NOT_PLURAL_ENDINGS = ("පෙරවරු", "පස්වරු", "පුවරු")
_FEMININE_WORDS = frozenset({"ඇය", "ඈ"})
_FEMININE_ENDINGS = ("වරිය", "මහත්මිය", "මෙනවිය", "තුමිය")
_MASCULINE_WORDS = frozenset({"ඔහු", "මොහු", "හෙතෙම", "පොලිසිය", "පොලීසිය", "රජය", "අධිකරණය",
                              "අමාත්‍යාංශය", "දෙපාර්තමේන්තුව", "සභාව", "ආයතනය",
                              "මණ්ඩලය", "කමිටුව", "කොමිසම"})
_MASCULINE_ENDINGS = ("වරයා", "මහතා", "තුමා")
_POSTPOSITIONS = frozenset({"සමඟ", "සමග", "ගැන", "වෙනුවෙන්", "විසින්", "සඳහා", "පිළිබඳ", "ඉදිරියේ",
                            "හමුවේ", "අතින්", "යටතේ", "මගින්", "ලවා", "වෙත", "වෙතින්", "හරහා", "නිසා"})
# A clause with any of these has a subject this rule cannot read reliably:
# a coordinated or "X including Y" subject, a group noun, or a monk, whose
# honorific plural agreement is correct for one person.
_UNREADABLE_SUBJECT = frozenset({"සහ", "හා", "හෝ", "මෙන්ම", "ඇතුළු", "ඇතුළුව", "පිරිසක්", "පිරිස",
                                 "කණ්ඩායම", "කණ්ඩායමක්", "හිමියෝ", "හිමි", "හිමිපාණෝ", "වහන්සේ",
                                 "හාමුදුරුවෝ", "විසින්", "මගින්", "ඇතුලු", "ඇතුලුව", "පියතුමා",
                                 "සමඟ", "සමග"})
# A subject followed closely by a participle is the subject of that embedded
# clause ("ඔහු කියවමින් හුන් තැනට", "රජය ගත් තීන්දු"), not of the main verb.
_EMBEDDING_WORDS = _RELATIVE | {"හුන්", "සිටි", "සිටින", "ගිය", "පැමිණි", "ආ"}


def _subject_class(word: str) -> str | None:
    if word in _NOT_PLURAL:
        return "masculine" if word in _MASCULINE_WORDS else None
    if word.endswith(_NOT_PLURAL_ENDINGS):
        return None
    if word.endswith(_PLURAL_ENDINGS) or word in {"ඔවුහු", "ඔවුහූ", "මොවුහු"}:
        return "plural"
    if word in _FEMININE_WORDS or word.endswith(_FEMININE_ENDINGS):
        return "feminine"
    if word in _MASCULINE_WORDS or word.endswith(_MASCULINE_ENDINGS):
        return "masculine"
    return None


def _clause_subject(tokens: list[_Tok]) -> tuple[str, str] | None:
    """(class, word) of the main-clause subject before the final verb, or None.

    Every subject-like word in the clause must point the same way; a clause
    naming a man and a woman, or a person and a group, is left alone.
    """
    clause = tokens[_main_clause_start(tokens, len(tokens) - 1):-1]
    if any(t.core in _UNREADABLE_SUBJECT for t in clause):
        return None
    found = []
    for k, tok in enumerate(clause):
        cls = _subject_class(tok.core)
        nxt = clause[k + 1].core if k + 1 < len(clause) else ""
        embedded = any(
            t.core in _EMBEDDING_WORDS or t.core.endswith("මින්") for t in clause[k + 1:k + 5]
        )
        if cls and nxt not in _POSTPOSITIONS and not embedded:
            found.append((cls, tok.core))
    classes = {cls for cls, _ in found}
    return found[0] if len(classes) == 1 else None


_EVENT_LIGHT = frozenset({"හට", "සිදු", "ආරම්භ", "අවසන්", "ඇති"})
# විය agrees with a person only in these participation/appointment phrases.
_PERSON_VIYA = frozenset({"සහභාගි", "සහභාගී", "පත්", "එක්", "සම්බන්ධ"})


@lru_cache(maxsize=1)
def _verb_forms() -> tuple[dict, dict, dict]:
    data = json.loads(_DATA.read_text(encoding="utf-8"))
    past = {}
    for masc, fem, plural in data["past"]:
        row = {"masculine": masc, "feminine": fem, "plural": plural}
        for cls, form in row.items():
            if form:
                past[form] = (row, cls)
    present = {}
    for singular, plural in data["present"]:
        row = {"masculine": singular, "feminine": singular, "plural": plural}
        present[singular] = (row, "singular")
        present[plural] = (row, "plural")
    return past, present, data["colloquial_to_plural"]


# ── Register: literary plural subject with a spoken verb ─────────────────

def _rule_register(text: str) -> list[_Edit]:
    _, _, colloquial = _verb_forms()
    edits = []
    for tokens in _grammar_sentences(text):
        if len(tokens) < 2 or tokens[-1].core not in colloquial:
            continue
        subject = _clause_subject(tokens)
        # Only the literary plural (-හු) is an unambiguous written-register
        # subject; -වරු and -න් plurals are used in speech too.
        if subject and subject[0] == "plural" and subject[1].endswith(_LITERARY_PLURAL_ENDINGS + ("ඔවුහු",)):
            last = tokens[-1]
            edits.append(_Edit(last.start, last.end, colloquial[last.core], "GRAM_REGISTER_001"))
    return edits


# ── Subject–predicate agreement (number and gender) ─────────────────────

def _rule_agreement(text: str) -> list[_Edit]:
    past, present, _ = _verb_forms()
    edits = []
    for tokens in _grammar_sentences(text):
        if len(tokens) < 2:
            continue
        last = tokens[-1]
        entry = past.get(last.core) or present.get(last.core)
        subject = _clause_subject(tokens) if entry else None
        if subject is None:
            continue
        row, verb_class = entry
        cls, word = subject
        # Passive auxiliary (කරනු ලැබීය) agrees with the patient, not the
        # agent; an impersonal modal (දැක ගැනීමට හැකි විය) agrees with nothing.
        if tokens[-2].core.endswith("නු") or tokens[-2].core in _MODALS:
            continue
        # Event verbs agree with the event, not with a person named earlier:
        # "කාර්යාලයේ දී සිදු විය", "ගාලගෝට්ටියක් හට ගත්තේය".
        if tokens[-2].core in _EVENT_LIGHT or (last.core == "විය" and tokens[-2].core not in _PERSON_VIYA):
            continue
        # Only correct towards a form the evidence supports: a feminine verb
        # usually means an unmarked woman's name is the subject, and a plural
        # verb after "X මහතා" may be honorific or a list of names, so those are
        # changed only when the subject is a pronoun or an institution.
        if verb_class == "feminine":
            continue
        if verb_class == "plural" and word not in _MASCULINE_WORDS | _FEMININE_WORDS:
            continue
        if last.core in present:
            # The present tense has one singular form for both genders.
            cls = "plural" if cls == "plural" else "singular"
            row = {"singular": row["masculine"], "plural": row["plural"]}
        wanted = row.get(cls)
        if cls != verb_class and wanted:
            edits.append(_Edit(last.start, last.end, wanted, "GRAM_AGR_001"))
    return edits


# ── Cleft (focus) reporting sentences ────────────────────────────────────

_CLEFT_SINGLE = frozenset({"පැවසුවේ", "ඇඟවූයේ", "කීවේ", "දැක්වූයේ"})
_CLEFT_AFTER = {"කළේ": {"අවධාරණය", "ප්‍රකාශ", "සඳහන්"},
                "සිටියේ": {"කියා", "ඉල්ලා"},
                "දුන්නේ": {"පෙන්වා"}}
# A reported clause can end in an adjectival or nominal form that බව follows.
_CLAUSE_FINAL_FORMS = frozenset({"යුතු", "හැකි", "නොහැකි", "ඇති", "නැති", "කරන", "වන", "යන",
                                 "දෙන", "ගන්නා", "පවතින", "සිටින", "කළ", "වූ", "ගත්", "දුන්"})


_SPOKEN_WORDS = frozenset({"මම", "මමත්", "මට", "මගේ", "අපි", "අපේ", "අපට", "අපිට", "ඔබ", "ඔයා",
                           "මේක", "ඕක", "ඒක", "එකක්", "කෙනෙක්", "සර්", "නම්"})


def _cleft_index(tokens: list[_Tok]) -> int | None:
    for k, tok in enumerate(tokens[:-1]):
        prev = tokens[k - 1].core if k else ""
        if tok.core in _CLEFT_SINGLE or prev in _CLEFT_AFTER.get(tok.core, ()):
            return k
    return None


def _rule_cleft_focus(text: str) -> list[_Edit]:
    """The focused constituent after a cleft verb closes the sentence with -ි."""
    edits = []
    for tokens in _grammar_sentences(text):
        k = _cleft_index(tokens)
        final = tokens[-1] if tokens else None
        if k is None or final is None or not final.core.endswith("මින්"):
            continue
        edits.append(_Edit(final.end - 1, final.end, "ි", "GRAM_CLEFT_FOCUS_001"))
    return edits


def _rule_clause(text: str) -> list[_Edit]:
    edits = []
    for tokens in _grammar_sentences(text):
        k = _cleft_index(tokens)
        if k is None or len(tokens) - k - 1 < 3:
            continue
        if any(t.core in {"බවයි", "ලෙසයි", "යන්නයි"} for t in tokens):
            continue
        # "මේ බව පැවසුවේ <occasion>": the reported content is already named.
        if any(t.core in {"බව", "මෙසේ", "එසේ"} for t in tokens[max(0, k - 3):k]):
            continue
        # A comma after the verb, or first-person/spoken words, mean the rest is
        # direct speech written without quotation marks: "පැවසුවේ, අපි ... රටක්".
        if tokens[k].comma_after or any(t.core in _SPOKEN_WORDS for t in tokens[k + 1:]):
            continue
        final = tokens[-1]
        if not (final.core.endswith("ක්") or final.core in _CLAUSE_FINAL_FORMS):
            continue
        closer = "ලෙසයි" if tokens[k - 1].core == "ඉල්ලා" else "බවයි"
        edits.append(_Edit(final.end, final.end, f" {closer}", "GRAM_CLAUSE_001"))
    return edits


# ── Engine ─────────────────────────────────────────────────────────────────

_LABELS: dict[str, tuple[str, str]] = {
    "SPELL_JOURNAL_001": ("spelling", "Spelling (අක්ෂර වින්‍යාසය): curated journalism spelling list"),
    "GRAM_CASE_ATTACH_001": ("grammar", "Case suffix (විභක්ති ප්‍රත්‍ය): -වල / -ගේ is a bound case ending and is written joined to its noun"),
    "GRAM_TENSE_001": ("grammar", "Tense (කාල භේදය): the time expression in the sentence fixes the verb's tense"),
    "GRAM_VOICE_002": ("grammar", "Voice (කර්තෘ කාරක): විසින් marks a passive agent; an active speech verb takes a plain subject"),
    "GRAM_VOICE_001": ("grammar", "Voice (කර්ම කාරක): an agent marked with විසින් needs a passive predicate (… ලදී)"),
    "GRAM_CASE_DATIVE_001": ("grammar", "Case marking (විභක්ති): warning, advising or informing someone takes the dative -ට"),
    "GRAM_CASE_ABLATIVE_001": ("grammar", "Case marking (විභක්ති): requesting from or questioning someone takes the ablative -ගෙන්"),
    "GRAM_REGISTER_001": ("grammar", "Register agreement (ලිඛිත ව්‍යවහාරය): a written-plural subject (-හු) needs the written plural verb, not the spoken form"),
    "GRAM_AGR_001": ("grammar", "Subject–verb agreement (උක්ත–ආඛ්‍යාත සම්බන්ධය): the verb ending must match the subject's number and gender"),
    "GRAM_CLEFT_FOCUS_001": ("grammar", "Focus sentence (අවධාරණ වාක්‍ය): after a focused reporting verb (… පැවසුවේ) the closing participle takes -මිනි"),
    "GRAM_CLAUSE_001": ("grammar", "Reported clause (වාර්තා වාක්‍ය): a focused reporting verb (… කළේ) must close its clause with බවයි / ලෙසයි"),
}

_RULES: tuple[Callable[[str], list[_Edit]], ...] = (
    _rule_spelling,
    _rule_case_attach,
    _rule_tense,
    _rule_voice_speech,
    _rule_voice_passive,
    _rule_case,
    _rule_register,
    _rule_agreement,
    _rule_cleft_focus,
    _rule_clause,
)


def _common_prefix(a: str, b: str) -> int:
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]:
        n += 1
    return n


def _apply_edits(text: str, edits: list[_Edit], hits: list[RuleHit]) -> tuple[str, list[RuleHit]]:
    # One edit per span; a later overlapping edit from the same rule is dropped.
    chosen: list[_Edit] = []
    for edit in sorted(edits, key=lambda x: (x.start, x.end)):
        if chosen and edit.start < chosen[-1].end:
            continue
        chosen.append(edit)
    if not chosen:
        return text, hits

    parts, cursor, delta = [], 0, 0
    shifts: list[tuple[int, int]] = []
    new_hits: list[RuleHit] = []
    for edit in chosen:
        parts.append(text[cursor:edit.start])
        parts.append(edit.replacement)
        cursor = edit.end
        original = text[edit.start:edit.end]
        p = _common_prefix(original, edit.replacement)
        q = _common_prefix(original[p:][::-1], edit.replacement[p:][::-1])
        out_start = edit.start + delta
        category, label = _LABELS[edit.rule_id]
        new_hits.append(RuleHit(
            rule_id=edit.rule_id, category=category, label=label,
            original=original, corrected=edit.replacement,
            start=out_start + p, end=out_start + len(edit.replacement) - q,
        ))
        change = len(edit.replacement) - (edit.end - edit.start)
        shifts.append((edit.end, change))
        delta += change
    parts.append(text[cursor:])

    def moved(x: int) -> int:
        return x + sum(change for end, change in shifts if end <= x)

    hits = [replace(h, start=moved(h.start), end=moved(h.end)) for h in hits]
    return "".join(parts), hits + new_hits


def apply(text: str) -> tuple[str, list[RuleHit]]:
    """Run every rule in order; return the corrected text and where each hit landed."""
    hits: list[RuleHit] = []
    for rule in _RULES:
        text, hits = _apply_edits(text, rule(text), hits)
    return text, sorted(hits, key=lambda h: h.start)
