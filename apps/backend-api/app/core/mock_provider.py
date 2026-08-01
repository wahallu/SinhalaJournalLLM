"""
Deterministic offline provider.

Last link in the model-gateway fallback chain: keeps every app usable with no
GPU server and no OpenRouter key (local dev, CI, demos). Output quality is
intentionally basic — rule-based grammar fixes, extractive summaries,
template headlines — but shape-compatible with the real model.
"""

import re

# ── Rule table for the mock grammar checker ──
# Common Sinhala mistakes: missing long-vowel verb endings, possessive forms,
# spelling, spacing, punctuation. The real grammar adapter replaces all this.
GRAMMAR_RULES: list[dict[str, str]] = [
    # ── Verb ending corrections ──
    {"pattern": "යනව", "replacement": "යනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "කරනව", "replacement": "කරනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "ඉන්නව", "replacement": "ඉන්නවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "බලනව", "replacement": "බලනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "කියනව", "replacement": "කියනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "දෙනව", "replacement": "දෙනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "ලියනව", "replacement": "ලියනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "කනව", "replacement": "කනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "බොනව", "replacement": "බොනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    {"pattern": "එනව", "replacement": "එනවා", "rule": "Verb ending: missing long vowel marker (ā)"},
    # ── Particle / postposition corrections ──
    {"pattern": "මම ඔයට", "replacement": "මම ඔයාට", "rule": "Pronoun form: ඔය → ඔයා before -ට"},
    {"pattern": "ඔයගෙ", "replacement": "ඔයාගේ", "rule": "Possessive: ඔයගෙ → ඔයාගේ"},
    {"pattern": "මගෙ", "replacement": "මගේ", "rule": "Possessive: missing long vowel in මගේ"},
    # ── Common misspellings ──
    {"pattern": "විද්‍යලය", "replacement": "විද්‍යාලය", "rule": "Spelling: විද්‍යලය → විද්‍යාලය"},
    # ── Spacing / punctuation ──
    {"pattern": "  ", "replacement": " ", "rule": "Spacing: double space reduced to single"},
    {"pattern": " .", "replacement": ".", "rule": "Punctuation: no space before period"},
    {"pattern": " ,", "replacement": ",", "rule": "Punctuation: no space before comma"},
]


def mock_grammar(text: str) -> str:
    """
    Apply the rule table and return corrected text.

    Longest patterns run first, and suffix-appending rules (e.g. යනව → යනවා)
    only fire when the suffix isn't already present — otherwise a word fixed
    by one rule gets the vowel sign appended again by an overlapping rule.
    """
    corrected = text
    for rule in sorted(GRAMMAR_RULES, key=lambda r: len(r["pattern"]), reverse=True):
        pattern, replacement = rule["pattern"], rule["replacement"]
        if replacement.startswith(pattern) and len(replacement) > len(pattern):
            guard = re.escape(replacement[len(pattern)])
            corrected = re.sub(
                re.escape(pattern) + f"(?!{guard})", replacement, corrected
            )
        else:
            corrected = corrected.replace(pattern, replacement)
    return corrected


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?।])\s+|(?<=\n)\s*")


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text.strip()) if s.strip()]


def mock_summarize(text: str, target_words: int) -> str:
    """Extractive stand-in: leading sentences up to the word budget."""
    sentences = _sentences(text)
    if not sentences:
        return text.strip()

    summary_parts: list[str] = []
    used = 0
    for sentence in sentences:
        words = len(sentence.split())
        if summary_parts and used + words > target_words:
            break
        summary_parts.append(sentence)
        used += words
    return " ".join(summary_parts)


def mock_headline(text: str, variation_index: int = 0, length: str = "medium") -> str:
    """First-sentence-derived headline, varied per candidate and length setting."""
    sentences = _sentences(text)
    base = sentences[0] if sentences else text.strip()
    words = base.split()

    norm_len = str(length).lower() if length else "medium"

    if norm_len in ("short", "60"):
        lengths = [4, 5, 3, 4, 5]
    elif norm_len in ("long", "120"):
        lengths = [8, 7, 9, 10, 8]
    else:
        lengths = [6, 5, 7, 6, 5]

    # Vary the window per candidate so N candidates differ.
    starts = [0, 1, 0, 2, 1]
    start = min(starts[variation_index % len(starts)], max(0, len(words) - 3))
    target_len = lengths[variation_index % len(lengths)]
    headline = " ".join(words[start:start + target_len])
    return headline.rstrip(".,;:،")


def mock_style(text: str, style: str) -> str:
    """
    No real rewriting offline — light normalisation plus a conversational
    opener for youth style so the change is visible in demos.
    """
    clean = re.sub(r"\s+", " ", text.strip())
    if style == "youth" and clean and not clean.startswith("මෙන්න"):
        return f"මෙන්න කතාව — {clean}"
    return clean
