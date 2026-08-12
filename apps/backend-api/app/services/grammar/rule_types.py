"""Shared, provider-independent types for Sinhala grammar validation."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
from enum import StrEnum
from typing import Any


class Decision(StrEnum):
    """Outcome of a model-proposed correction."""

    ACCEPT = "ACCEPT"
    SUGGEST = "SUGGEST"
    REJECT = "REJECT"
    KEEP = "KEEP"


class RuleTier(StrEnum):
    """How much authority a deterministic rule has."""

    AUTO = "AUTO"
    CHECK = "CHECK"
    NEURAL = "NEURAL"
    PROTECT = "PROTECT"


class Severity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class ConfidenceLevel(StrEnum):
    """Categorical evidence strength; deliberately not a probability."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass(frozen=True)
class MorphFeatures:
    """Known morphology only; unavailable features deliberately remain ``None``."""

    lemma: str | None = None
    pos: str | None = None
    animacy: str | None = None
    gender: str | None = None
    number: str | None = None
    person: int | None = None
    case: str | None = None
    definiteness: str | None = None
    tense: str | None = None
    aspect: str | None = None
    voice: str | None = None
    polarity: str | None = None
    verb_form: str | None = None


@dataclass(frozen=True)
class RuleDefinition:
    id: str
    name: str
    category: str
    tier: RuleTier
    severity: Severity
    description: str


@dataclass(frozen=True)
class RuleTrigger:
    id: str
    category: str
    tier: RuleTier
    severity: Severity
    message: str
    decision: Decision
    confidence_level: ConfidenceLevel

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["tier"] = self.tier.value
        data["severity"] = self.severity.value
        data["decision"] = self.decision.value
        data["confidence_level"] = self.confidence_level.value
        return data


@dataclass(frozen=True)
class ValidationEdit:
    """One aligned edit and the validator's decision about it."""

    operation: str
    original: str
    candidate: str
    decision: Decision
    rule_ids: tuple[str, ...]
    confidence: float | None
    confidence_level: ConfidenceLevel
    reason: str
    category: str
    severity: Severity
    original_start: int | None = None
    original_end: int | None = None
    candidate_start: int | None = None
    candidate_end: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def rebased(self, original_offset: int, candidate_offset: int | None = None) -> "ValidationEdit":
        """Return a copy whose offsets address the containing article."""
        candidate_offset = original_offset if candidate_offset is None else candidate_offset
        return replace(
            self,
            original_start=(
                None if self.original_start is None else self.original_start + original_offset
            ),
            original_end=(
                None if self.original_end is None else self.original_end + original_offset
            ),
            candidate_start=(
                None if self.candidate_start is None else self.candidate_start + candidate_offset
            ),
            candidate_end=(
                None if self.candidate_end is None else self.candidate_end + candidate_offset
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["decision"] = self.decision.value
        data["rule_ids"] = list(self.rule_ids)
        data["severity"] = self.severity.value
        data["confidence_level"] = self.confidence_level.value
        return data


@dataclass(frozen=True)
class ValidationConfig:
    enabled: bool = True
    auto_safe_orthography: bool = True
    protect_entities: bool = True
    protect_numbers: bool = True
    protect_quotes: bool = True
    agreement_validation: bool = True
    contextual_rules: bool = True
    # Evaluation-only switches preserve the historical policy so the same
    # candidate set can be compared before and after recalibration.
    apply_advisory_edits: bool = True
    legacy_entity_policy: bool = False


@dataclass
class ValidationResult:
    original_text: str
    model_candidate: str
    final_text: str
    decision: Decision
    confidence: float | None
    confidence_level: ConfidenceLevel | None = None
    edits: list[ValidationEdit] = field(default_factory=list)
    rules_triggered: list[RuleTrigger] = field(default_factory=list)
    enabled: bool = True
    failed_open: bool = False

    @property
    def applied_edits(self) -> list[ValidationEdit]:
        return [
            edit
            for edit in self.edits
            if edit.decision in {Decision.ACCEPT, Decision.SUGGEST}
        ]

    @property
    def suggestions(self) -> list[ValidationEdit]:
        return [edit for edit in self.edits if edit.decision == Decision.SUGGEST]

    @property
    def blocked_edits(self) -> list[ValidationEdit]:
        return [edit for edit in self.edits if edit.decision == Decision.REJECT]

    def counts(self) -> dict[str, int]:
        accepted = sum(edit.decision == Decision.ACCEPT for edit in self.edits)
        warnings = len(self.suggestions)
        rejected = len(self.blocked_edits)
        return {
            "proposed": len(self.edits),
            "accepted": accepted,
            "applied": accepted + warnings,
            "suggested": warnings,
            "rejected": rejected,
            "advisory_warnings": warnings,
            "hard_rejections": rejected,
            "selectively_reverted": rejected,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "failed_open": self.failed_open,
            "decision": self.decision.value,
            "confidence": self.confidence,
            "confidence_level": (
                self.confidence_level.value if self.confidence_level else None
            ),
            "rules_triggered": [rule.to_dict() for rule in self.rules_triggered],
            "edits": [edit.to_dict() for edit in self.edits],
            "counts": self.counts(),
        }
