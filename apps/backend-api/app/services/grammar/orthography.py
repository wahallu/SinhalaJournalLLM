"""Non-destructive Unicode and grapheme helpers for Sinhala text."""

from __future__ import annotations

import re
import unicodedata

_SPACE_BEFORE_PUNCT = re.compile(r"[ \t]+([,;:!?])")
_REPEATED_HORIZONTAL_SPACE = re.compile(r"[ \t]{2,}")


def normalize_nfc(text: str) -> str:
    """Canonical normalization only; combining marks and joiners are retained."""
    return unicodedata.normalize("NFC", text or "")


def apply_safe_spacing(text: str) -> str:
    """Apply only whitespace transformations that do not cross a line break."""
    return _SPACE_BEFORE_PUNCT.sub(
        r"\1", _REPEATED_HORIZONTAL_SPACE.sub(" ", text)
    )


def grapheme_clusters(text: str) -> tuple[str, ...]:
    """Small dependency-free cluster splitter with explicit ZWJ attachment.

    It is intentionally not a full Unicode text-segmentation implementation.
    It is sufficient for detecting whether a model changed joiner/combining-mark
    structure, and uncertainty is downgraded instead of guessed away.
    """
    clusters: list[str] = []
    current = ""
    join_next = False
    for char in normalize_nfc(text):
        category = unicodedata.category(char)
        attaches = category in {"Mn", "Mc", "Me", "Cf"} or char in {"\u200c", "\u200d"}
        if not current or attaches or join_next:
            current += char
        else:
            clusters.append(current)
            current = char
        join_next = char in {"\u200c", "\u200d"}
    if current:
        clusters.append(current)
    return tuple(clusters)


def joiner_signature(text: str) -> tuple[tuple[int, int, str], ...]:
    """Return joiner counts and positions per grapheme cluster."""
    return tuple(
        (cluster.count("\u200d"), cluster.count("\u200c"), cluster)
        for cluster in grapheme_clusters(text)
        if "\u200d" in cluster or "\u200c" in cluster
    )


def uncertain_joiner_change(original: str, candidate: str) -> bool:
    """True when an edit changes explicit joiner structure."""
    return joiner_signature(original) != joiner_signature(candidate)
