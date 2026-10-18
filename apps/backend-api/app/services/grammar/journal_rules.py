"""
Deterministic grammar rules for formal written (journalistic) Sinhala.

Why this exists: the neural grammar adapter mostly repairs word spelling, and
the rule validator (rule_validator.py) only accepts, downgrades or blocks the
model's own edits — it never proposes a correction. So when an article has a
grammatical error the model leaves alone (a wrong case suffix, a singular verb
after a plural subject, an agent marked with විසින් on an active verb), nothing
in the pipeline fixes it. This module is that missing generator: a small set
of pattern-scoped rules that run on the validated text and rewrite only the
constructions they recognise.

Scope, stated plainly: every rule is anchored on a governing word (the verb
that selects a case, a time word that selects a tense, the subject that
selects a verb ending) and is guarded to stay inside one clause. They are
precise on the constructions they name and silent everywhere else — this is a
curated rule layer, not a general Sinhala grammar. Each hit carries its rule
id and a bilingual explanation so the UI can show *why* an edit is grammar
and not spelling.

Rules, in the order they run (later rules see earlier rules' output):

  SPELL_JOURNAL_001      curated journalism misspellings (word-initial)
  GRAM_TENSE_001         ඊයේ / පසුගිය සතියේ  + future verb  -> past
                         හෙට / ලබන සතියේ    + past verb    -> future
  GRAM_VOICE_002         X විසින් ... පැවසීය           -> X ... පැවසීය
  GRAM_VOICE_001         X විසින් ... කළහ / කළේය      -> X විසින් ... කරන ලදී
  GRAM_CASE_DATIVE_001   ජනතාවගෙන් අනතුරු ඇඟවීය      -> ජනතාවට ...
  GRAM_CASE_ABLATIVE_001 ජනතාවට ඉල්ලා සිටියේය        -> ජනතාවගෙන් ...
  GRAM_NUM_CLASS_001     සැකකරුවන් 3ක්                -> සැකකරුවන් 3 දෙනෙක්
  GRAM_AGR_001           නිලධාරීහු ... කළේය / ඇය ... කළේය -> කළහ / කළාය
  GRAM_CLAUSE_001        ... අවධාරණය කළේ <clause>.   -> ... <clause> බවයි.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from typing import Callable

# ── Tokens ────────────────────────────────────────────────────────────────

_EDGE_PUNCT = ".,;:!?\"'“”‘’()[]{}«»…"
# A full stop ends a sentence only before whitespace, so "10.00ට" stays whole.
_SENTENCE_END = re.compile(r"[.!?।]+(?=\s|$)|\n+")


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


def _clause_ok(tokens: list[_Tok], lo: int, hi: int) -> bool:
    """No comma and no clause-boundary word strictly between lo and hi."""
    for k in range(lo, hi):
        if k > lo and tokens[k].core in _BOUNDARY:
            return False
        if tokens[k].comma_after and k < hi:
            return False
    return True


# Words that open or close an embedded clause; a rule never reaches across one.
_BOUNDARY = frozenset({"බව", "බවත්", "බවද", "බවට", "යැයි", "කියා", "ලෙස", "නිසා", "විට", "අතර"})

# Relative/participial verb forms: a විසින් before one of these belongs to an
# embedded clause ("පොලිසිය විසින් සිදු කළ විමර්ශනය"), not the main predicate.
_RELATIVE = frozenset({"කළ", "කරන", "ගත්", "ගන්නා", "දුන්", "දෙන", "ලද", "වූ", "කරනු", "සිදුකළ"})


# ── Spelling (curated) ───────────────────────────────────────────────────

_SPELLING_PREFIXES: tuple[tuple[str, str], ...] = (
    ("ශ්‍රෂ්ඨාධිකරණ", "ශ්‍රේෂ්ඨාධිකරණ"),
    ("බරපතල", "බරපතළ"),
    ("රෝගන්", "රෝගීන්"),
    ("ශබ්ධ", "ශබ්ද"),
    ("දූෂන", "දූෂණ"),
    ("විමර්ෂන", "විමර්ශන"),
    ("ප්‍රකාෂ", "ප්‍රකාශ"),
    ("අධිකරන", "අධිකරණ"),
    ("අමාත්‍යාන්ශ", "අමාත්‍යාංශ"),
    ("සාක්ෂීකරු", "සාක්ෂිකරු"),
    ("පාර්ලිමෙන්තු", "පාර්ලිමේන්තු"),
    ("පොලීසි", "පොලිසි"),
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


_PURPOSE_ENDINGS = ("ීමට", "ීමටත්", "න්නට")


def _time_class(tokens: list[_Tok], k: int) -> str | None:
    word = tokens[k].core
    nxt = tokens[k + 1].core if k + 1 < len(tokens) else ""
    if word in {"ඊයේ", "පෙරේදා"}:
        return "past"
    if word in {"හෙට", "අනිද්දා"}:
        return "future"
    if word in {"පසුගිය", "ලබන"} and nxt.startswith(_PERIOD_NOUNS):
        return "past" if word == "පසුගිය" else "future"
    return None


def _final_predicate(tokens: list[_Tok], table: dict[str, str]) -> tuple[int, str] | None:
    """Index of the first token of a sentence-final predicate found in `table`."""
    for width in (2, 1):
        if len(tokens) >= width:
            phrase = " ".join(t.core for t in tokens[-width:])
            if phrase in table:
                return len(tokens) - width, phrase
    return None


def _rule_tense(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        markers = [(k, c) for k in range(len(tokens)) if (c := _time_class(tokens, k))]
        classes = {c for _, c in markers}
        if len(classes) != 1:
            continue
        marker_index, wanted = markers[-1]
        table = _FUTURE_TO_PAST if wanted == "past" else _PAST_TO_FUTURE
        found = _final_predicate(tokens, table)
        if not found:
            continue
        first, phrase = found
        if not _clause_ok(tokens, marker_index, first):
            continue
        # "ලබන සතියේ නැවත කැඳවීමට නියෝග කළේය": the time word belongs to the
        # purpose clause (-ීමට), not to the main verb, so the tense is right.
        if any(t.core.endswith(_PURPOSE_ENDINGS) for t in tokens[marker_index + 1:first]):
            continue
        edits.append(_Edit(tokens[first].start, tokens[-1].end, table[phrase], "GRAM_TENSE_001"))
    return edits


# ── Voice: the agent marker විසින් ───────────────────────────────────────

_SPEECH_VERBS = frozenset({"පැවසීය", "පැවසූහ", "පැවසුවාය", "කීය", "කීහ", "කීවාය",
                           "කියා සිටියේය", "කියා සිටියහ", "කියා සිටියාය"})
_PASSIVE_OF = {
    "කළේය": "කරන ලදී", "කළහ": "කරන ලදී", "කළාය": "කරන ලදී",
    "ගත්තේය": "ගන්නා ලදී", "ගත්හ": "ගන්නා ලදී", "ගත්තාය": "ගන්නා ලදී",
    "දුන්නේය": "දෙන ලදී", "දුන්හ": "දෙන ලදී", "දුන්නාය": "දෙන ලදී",
    "පැවැත්වීය": "පවත්වන ලදී", "පැවැත්වූහ": "පවත්වන ලදී",
}


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
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        speech = {phrase: phrase for phrase in _SPEECH_VERBS}
        found = _final_predicate(tokens, speech)
        if not found:
            continue
        agent = _agent_index(tokens, found[0], max_gap=5)
        if agent is None or agent == 0:
            continue
        # Delete the space before විසින් together with the word itself.
        edits.append(_Edit(tokens[agent - 1].end, tokens[agent].end, "", "GRAM_VOICE_002"))
    return edits


def _rule_voice_passive(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        if not tokens or tokens[-1].core not in _PASSIVE_OF:
            continue
        if _agent_index(tokens, len(tokens) - 1, max_gap=6) is None:
            continue
        last = tokens[-1]
        edits.append(_Edit(last.start, last.end, _PASSIVE_OF[last.core], "GRAM_VOICE_001"))
    return edits


# ── Case marking governed by the verb ───────────────────────────────────

# Warning, advising and informing someone: the addressee is dative (-ට).
_DATIVE_VERBS = ("අනතුරු ඇඟ", "අනතුරු අඟ", "අවවාද ක", "අවවාද දු", "උපදෙස් දු",
                 "උපදෙස් දෙ", "උපදෙස් දී", "දැනුම් දු", "දැනුම් දෙ", "දැනුම් දී")
# Requesting from and questioning someone: the source is ablative (-ගෙන්).
_ABLATIVE_VERBS = ("ඉල්ලා සිටි", "ඉල්ලා සිටී", "ඉල්ලීමක් ක", "ප්‍රශ්න ක", "විමසී",
                   "විමසූ", "විමසා", "විමසුවේ")
# -ගෙන් is the animate ablative, so only animate stems may take it.
_ANIMATE_STEMS = ("න්", "ජනතාව", "කරු", "වරයා", "වරිය", "මහතා", "මහත්මිය",
                  "තුමා", "තුමිය", "ඔහු", "ඇය", "දරුවා", "ළමයා")


def _verb_follows(tokens: list[_Tok], i: int, verbs: tuple[str, ...], max_gap: int) -> bool:
    for j in range(i + 1, min(len(tokens), i + 2 + max_gap)):
        pair = tokens[j].core + (" " + tokens[j + 1].core if j + 1 < len(tokens) else "")
        if pair.startswith(verbs):
            return _clause_ok(tokens, i, j) and not tokens[i].comma_after
    return False


def _rule_case(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        for i, tok in enumerate(tokens):
            word = tok.core
            if word.endswith("ගෙන්") and len(word) > 4 and _verb_follows(tokens, i, _DATIVE_VERBS, 2):
                gap = tokens[i + 1:i + 3]
                if not any(t.core.endswith("ට") for t in gap if not t.core.startswith(_DATIVE_VERBS)):
                    edits.append(_Edit(tok.end - 4, tok.end, "ට", "GRAM_CASE_DATIVE_001"))
            elif (
                word.endswith("ට")
                and word[:-1].endswith(_ANIMATE_STEMS)
                and _verb_follows(tokens, i, _ABLATIVE_VERBS, 2)
            ):
                edits.append(_Edit(tok.end - 1, tok.end, "ගෙන්", "GRAM_CASE_ABLATIVE_001"))
    return edits


# ── Numeral classifier: people are counted with දෙනා ───────────────────

_COUNTED = re.compile(r"^([\d,]+)(ක්|කට|කගේ)$")
# "රෝගීන් 1,200කට අධික සංඛ්‍යාවක්" is a quantity comparison, not a head count.
_COMPARATIVES = frozenset({"අධික", "වැඩි", "ආසන්න", "අඩු"})
_HUMAN_PLURAL = ("යන්", "යින්", "කරුවන්", "වරුන්", "ීන්", "ුන්", "දරුවන්")
_CLASSIFIER = {"ක්": "දෙනෙක්", "කට": "දෙනෙකුට", "කගේ": "දෙනෙකුගේ"}


def _rule_numeral(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        for k in range(1, len(tokens)):
            match = _COUNTED.match(tokens[k].core)
            nxt = tokens[k + 1].core if k + 1 < len(tokens) else ""
            if match and tokens[k - 1].core.endswith(_HUMAN_PLURAL) and nxt not in _COMPARATIVES:
                number, suffix = match.groups()
                edits.append(_Edit(tokens[k].start, tokens[k].end,
                                   f"{number} {_CLASSIFIER[suffix]}", "GRAM_NUM_CLASS_001"))
    return edits


# ── Subject–predicate agreement (number and gender) ─────────────────────

# (masculine/neuter singular, feminine singular, plural)
_AGREEMENT_ROWS: tuple[tuple[str, str, str], ...] = (
    ("කළේය", "කළාය", "කළහ"),
    ("පැවසීය", "පැවසුවාය", "පැවසූහ"),
    ("ගියේය", "ගියාය", "ගියහ"),
    ("පැමිණියේය", "පැමිණියාය", "පැමිණියහ"),
    ("සිටියේය", "සිටියාය", "සිටියහ"),
    ("කීය", "කීවාය", "කීහ"),
    ("දුන්නේය", "දුන්නාය", "දුන්හ"),
    ("ගත්තේය", "ගත්තාය", "ගත්හ"),
    ("ආවේය", "ආවාය", "ආහ"),
    ("දැක්වීය", "දැක්වූවාය", "දැක්වූහ"),
)
_CLASSES = ("masculine", "feminine", "plural")
_VERB_CLASS = {form: (row, _CLASSES[n]) for row in _AGREEMENT_ROWS for n, form in enumerate(row)}

_PLURAL_ENDINGS = ("ීහු", "ූහු", "ුහු", "වරු", "කරුවෝ", "යෝ")
_FEMININE_WORDS = frozenset({"ඇය", "ඈ"})
_FEMININE_ENDINGS = ("වරිය", "මහත්මිය", "මෙනවිය", "තුමිය")
_MASCULINE_WORDS = frozenset({"ඔහු", "මොහු", "හෙතෙම", "පොලිසිය", "රජය", "අධිකරණය",
                              "අමාත්‍යාංශය", "දෙපාර්තමේන්තුව", "සභාව", "ආයතනය",
                              "මණ්ඩලය", "කමිටුව", "කොමිසම"})
_MASCULINE_ENDINGS = ("වරයා", "මහතා", "තුමා")
_POSTPOSITIONS = frozenset({"සමඟ", "සමග", "ගැන", "වෙනුවෙන්", "විසින්", "සඳහා", "පිළිබඳ"})
_COORDINATORS = frozenset({"සහ", "හා", "හෝ"})


def _subject_class(word: str) -> str | None:
    if word.endswith(_PLURAL_ENDINGS):
        return "plural"
    if word in _FEMININE_WORDS or word.endswith(_FEMININE_ENDINGS):
        return "feminine"
    if word in _MASCULINE_WORDS or word.endswith(_MASCULINE_ENDINGS):
        return "masculine"
    return None


def _rule_agreement(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        if len(tokens) < 2 or tokens[-1].core not in _VERB_CLASS:
            continue
        row, verb_class = _VERB_CLASS[tokens[-1].core]
        # The main clause starts after the last comma or embedded-clause word.
        clause_start = 0
        for k, tok in enumerate(tokens[:-1]):
            if tok.comma_after:
                clause_start = k + 1
            elif tok.core in _BOUNDARY:
                clause_start = k + 1
        clause = tokens[clause_start:-1]
        if any(t.core == "විසින්" for t in clause):
            continue  # agentive/passive clause: agreement does not apply
        subject = None
        for k, tok in enumerate(clause):
            cls = _subject_class(tok.core)
            if cls is None:
                continue
            nxt = clause[k + 1].core if k + 1 < len(clause) else ""
            if nxt in _COORDINATORS:
                subject = None
                break  # "X සහ Y" — a coordinated subject; leave it alone
            if nxt in _POSTPOSITIONS:
                continue
            subject = cls
            break
        if subject is None or subject == verb_class:
            continue
        last = tokens[-1]
        edits.append(_Edit(last.start, last.end, row[_CLASSES.index(subject)], "GRAM_AGR_001"))
    return edits


# ── Reported clause closed by බවයි / ලෙසයි ───────────────────────────────

_CLEFT_SINGLE = frozenset({"පැවසුවේ", "ඇඟවූයේ", "කීවේ", "දැක්වූයේ"})
_CLEFT_AFTER = {"කළේ": {"අවධාරණය", "ප්‍රකාශ", "සඳහන්"},
                "සිටියේ": {"කියා", "ඉල්ලා"},
                "දුන්නේ": {"පෙන්වා"}}


def _rule_clause(text: str) -> list[_Edit]:
    edits = []
    for s, e in _sentences(text):
        tokens = _tokens(text, s, e)
        sentence = text[s:e]
        if "බවයි" in sentence or "ලෙසයි" in sentence or "යන්නයි" in sentence:
            continue
        for k, tok in enumerate(tokens[:-1]):
            prev = tokens[k - 1].core if k else ""
            is_cleft = tok.core in _CLEFT_SINGLE or prev in _CLEFT_AFTER.get(tok.core, ())
            if not is_cleft:
                continue
            if len(tokens) - k - 1 < 3:
                break
            if any(t.core in {"මෙසේ", "එසේ"} for t in tokens[max(0, k - 3):k]):
                break
            final = tokens[-1]
            # Already closed (…ය / …යි), or ends in a finite verb that would
            # need rewriting (ඇත -> ඇති බවයි), which this rule does not attempt.
            if final.core.endswith(("ය", "යි")) or final.core in {"ඇත", "නැත"}:
                break
            closer = "ලෙසයි" if prev == "ඉල්ලා" else "බවයි"
            edits.append(_Edit(final.end, final.end, f" {closer}", "GRAM_CLAUSE_001"))
            break
    return edits


# ── Engine ─────────────────────────────────────────────────────────────────

_LABELS: dict[str, tuple[str, str]] = {
    "SPELL_JOURNAL_001": ("spelling", "Spelling (අක්ෂර වින්‍යාසය): curated journalism spelling list"),
    "GRAM_TENSE_001": ("grammar", "Tense (කාල භේදය): the time expression in the sentence fixes the verb's tense"),
    "GRAM_VOICE_002": ("grammar", "Voice (කර්තෘ කාරක): විසින් marks a passive agent; an active speech verb takes a plain subject"),
    "GRAM_VOICE_001": ("grammar", "Voice (කර්ම කාරක): an agent marked with විසින් needs a passive predicate (… ලදී)"),
    "GRAM_CASE_DATIVE_001": ("grammar", "Case marking (විභක්ති): warning, advising or informing someone takes the dative -ට"),
    "GRAM_CASE_ABLATIVE_001": ("grammar", "Case marking (විභක්ති): requesting from or questioning someone takes the ablative -ගෙන්"),
    "GRAM_NUM_CLASS_001": ("grammar", "Numeral classifier (සංඛ්‍යා විශේෂණ): people are counted with දෙනා, not -ක්"),
    "GRAM_AGR_001": ("grammar", "Subject–verb agreement (උක්ත–ආඛ්‍යාත සම්බන්ධය): the verb ending must match the subject's number and gender"),
    "GRAM_CLAUSE_001": ("grammar", "Reported clause (වාර්තා වාක්‍ය): a focused reporting verb (… කළේ) must close its clause with බවයි / ලෙසයි"),
}

_RULES: tuple[Callable[[str], list[_Edit]], ...] = (
    _rule_spelling,
    _rule_tense,
    _rule_voice_speech,
    _rule_voice_passive,
    _rule_case,
    _rule_numeral,
    _rule_agreement,
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
