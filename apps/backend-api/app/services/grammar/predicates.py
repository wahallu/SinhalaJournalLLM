"""Predicate guards used before agreement, tense, and voice checks."""

from __future__ import annotations

from app.services.grammar.morphology import has_compound_predicate, predicate_features


def is_compound_predicate(text: str) -> bool:
    return has_compound_predicate(text)


def allows_nonverbal_predicate(text: str) -> bool:
    """No finite predicate is an allowed unknown, never evidence of invalidity."""
    words = [word.strip(".,;:!?\"'“”‘’") for word in text.split() if word.strip()]
    return predicate_features(words) is None
