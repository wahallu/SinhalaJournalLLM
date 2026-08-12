"""Signals for phenomena that must remain contextual/suggestion-only."""

from __future__ import annotations

from app.services.grammar.morphology import morphology_rules


def contextual_rule_ids(original: str, candidate: str) -> tuple[str, ...]:
    """Return stable IDs when a model changes a known context-sensitive form."""
    if original == candidate:
        return ()
    rules = morphology_rules()
    old_words = set(original.split())
    new_words = set(candidate.split())
    changed = old_words ^ new_words
    out: list[str] = []
    if changed & set(rules.get("deictic_tokens", ())):
        out.append("DEIXIS_CONTEXT_001")
    if any(marker in original or marker in candidate for marker in rules.get("honorific_markers", ())):
        out.append("HONORIFIC_CONTEXT_001")
    if changed & set(rules.get("register_tokens", ())):
        out.append("REGISTER_CONTEXT_001")
    return tuple(out)
