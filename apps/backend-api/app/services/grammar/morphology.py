"""Conservative morphology backed by reviewed project data files."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Sequence

from app.services.grammar.rule_types import MorphFeatures

_DATA = Path(__file__).with_name("data")


@lru_cache(maxsize=None)
def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text(encoding="utf-8"))


def pronoun_features(surface: str) -> MorphFeatures | None:
    entry = _load("pronouns.json").get("entries", {}).get(surface)
    if not entry:
        return None
    return MorphFeatures(lemma=entry.get("lemma", surface), pos="pronoun", **{
        key: entry.get(key)
        for key in ("animacy", "gender", "number", "person", "case")
        if entry.get(key) is not None
    })


def morphology_rules() -> dict[str, Any]:
    return _load("morphology_rules.json")


def case_suffixes() -> tuple[str, ...]:
    return tuple(morphology_rules().get("case_suffixes", ()))


def predicate_features(words: Sequence[str]) -> MorphFeatures | None:
    """Return features only for exact predicate forms recorded in project data."""
    if not words:
        return None
    rules = morphology_rules()
    phrase = " ".join(words)
    for compound in sorted(rules.get("compound_predicates", ()), key=len, reverse=True):
        if phrase.endswith(compound):
            details = rules.get("compound_features", {}).get(compound, {})
            return MorphFeatures(lemma=compound, pos="verb", verb_form="compound", **details)

    token = words[-1].strip(".,;:!?\"'”’)")
    details = rules.get("verb_features", {}).get(token)
    if not details:
        return None
    return MorphFeatures(lemma=details.get("lemma", token), pos="verb", **{
        key: value for key, value in details.items() if key != "lemma"
    })


def polarity(text: str) -> str | None:
    """Detect explicit negative morphology only; absence is not guessed positive."""
    words = set(text.replace(".", " ").replace(",", " ").split())
    negatives = set(morphology_rules().get("negative_tokens", ()))
    if words & negatives or any(word.startswith("නො") and len(word) > 2 for word in words):
        return "negative"
    return None


def tense(text: str) -> str | None:
    words = [word.strip(".,;:!?\"'”’") for word in text.split()]
    features = predicate_features(words)
    return features.tense if features else None


def voice(text: str) -> str | None:
    words = [word.strip(".,;:!?\"'”’") for word in text.split()]
    features = predicate_features(words)
    if features and features.voice:
        return features.voice
    phrase = " ".join(words)
    if any(marker in phrase for marker in morphology_rules().get("passive_markers", ())):
        return "passive"
    return None


def has_compound_predicate(text: str) -> bool:
    phrase = " ".join(text.split())
    return any(
        phrase.endswith(compound)
        for compound in morphology_rules().get("compound_predicates", ())
    )
