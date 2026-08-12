"""
Pydantic schemas for the Grammar Checker API.
Defines request/response shapes independently of ORM models.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, PrivateAttr


# ── Request ──

class GrammarCheckRequest(BaseModel):
    """Input payload for grammar checking."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala text to check for grammar errors",
    )


# ── Nested detail ──

class CorrectionDetail(BaseModel):
    """A single correction applied to the text."""
    position: int = Field(description="Character offset in original text")
    original: str = Field(description="Original incorrect fragment")
    corrected: str = Field(description="Corrected fragment")
    rule: str = Field(description="Rule or pattern that triggered the correction")
    type: str = Field(
        default="grammar",
        description="Correction category: grammar | spelling | punctuation | spacing",
    )
    suspicious: bool = Field(
        default=False,
        description=(
            "The model appears to have swapped in a different word rather than "
            "corrected a spelling — most often a name. In the hybrid pipeline "
            "such an edit is normally blocked before it reaches this applied list."
        ),
    )
    suspicious_reason: str | None = Field(
        default=None,
        description="Why the replacement was flagged. None when not suspicious.",
    )
    decision: Literal["ACCEPT", "SUGGEST"] = Field(
        default="ACCEPT",
        description="Applied directly (ACCEPT) or applied with an advisory warning (SUGGEST).",
    )
    rule_ids: list[str] = Field(
        default_factory=list,
        description="Stable research rule IDs that validated this applied edit.",
    )
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Deprecated numeric score; null for categorical rule decisions.",
    )
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"] | None = Field(
        default=None,
        description="Categorical evidence strength, not a probability.",
    )


class ValidationRule(BaseModel):
    """One stable rule signal, with a user-readable explanation."""

    id: str
    category: str
    tier: Literal["AUTO", "CHECK", "NEURAL", "PROTECT"]
    severity: Literal["info", "warning", "error"]
    message: str
    decision: Literal["ACCEPT", "SUGGEST", "REJECT", "KEEP"] | None = None
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"] | None = None


class ValidationEditDetail(BaseModel):
    """A model edit that was accepted, downgraded, or rejected."""

    operation: str
    original: str
    candidate: str
    decision: Literal["ACCEPT", "SUGGEST", "REJECT", "KEEP"]
    rule_ids: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"] | None = None
    reason: str
    category: str
    severity: Literal["info", "warning", "error"]
    original_start: int | None = None
    original_end: int | None = None
    candidate_start: int | None = None
    candidate_end: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class GrammarValidation(BaseModel):
    """Explainable hybrid-validation summary added without changing old fields."""

    enabled: bool = True
    failed_open: bool = False
    decision: Literal["ACCEPT", "SUGGEST", "REJECT", "KEEP"]
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"] | None = None
    rules_triggered: list[ValidationRule] = Field(default_factory=list)
    edits: list[ValidationEditDetail] = Field(default_factory=list)
    counts: dict[str, int] = Field(default_factory=dict)


# ── Response ──

class SpellingSuggestion(BaseModel):
    """
    A word the frequency lexicon thinks is misspelled.

    Deliberately separate from `corrections`: those describe edits already
    applied to the text, these are advisory only and nothing acts on them. The
    grammar model memorises word forms, so it misses words it was never taught;
    the lexicon covers ~38% of that residue (see services/grammar/lexicon.py).
    It is tuned to near-silence rather than coverage — the corpus it counts
    carries its own misspellings, so a bolder setting starts proposing the wrong
    spelling for correct words. Shown for a human to judge, never written into
    the copy.
    """

    position: int = Field(description="Character offset in the corrected text")
    original: str = Field(description="The word as written")
    suggestion: str = Field(description="A near-identical, far commoner spelling")
    seen: int = Field(description="Times the written form appears in the news corpus")
    suggestion_seen: int = Field(description="Times the suggested form appears")


class GrammarCheckResponse(BaseModel):
    """Output payload after grammar checking."""
    id: str = Field(description="Unique correction record ID")
    corrected: str = Field(description="Full corrected text")
    model_candidate: str | None = Field(
        default=None,
        description="Raw neural candidate before rule validation; null on legacy history rows.",
    )
    validation: GrammarValidation | None = Field(
        default=None,
        description="Hybrid rule/safety decision metadata; additive and backward compatible.",
    )
    corrections: list[CorrectionDetail] = Field(
        default_factory=list,
        description="List of individual corrections applied",
    )
    correction_count: int = Field(description="Total number of corrections made")
    suggestions: list[SpellingSuggestion] = Field(
        default_factory=list,
        description=(
            "Possible misspellings the model did not fix. Advisory only — these "
            "are NOT applied to `corrected`."
        ),
    )
    created_at: datetime | None = Field(
        default=None,
        description="Timestamp of the correction",
    )
    model_used: str | None = Field(
        default=None,
        description="Inference provider that produced this result (sinllama | openrouter | mock)",
    )
    input_tokens: int | None = Field(
        default=None,
        description="Prompt tokens reported by the provider; null when it reports none",
    )
    output_tokens: int | None = Field(
        default=None,
        description="Generated tokens reported by the provider; null when it reports none",
    )

    # Which adapter actually served this check — an admin-diagnostics value,
    # never a user-facing one. A PrivateAttr rather than a Field: private
    # attributes are invisible to .model_dump()/.model_dump_json() and to the
    # generated OpenAPI schema (verified directly against this pydantic
    # version), so there is no serialization path — response_model or
    # otherwise — that can leak it to a caller by accident. Set by
    # grammar_service.check_grammar(); read by the /check endpoint only, to
    # forward into request_telemetry.
    _adapter: str | None = PrivateAttr(default=None)

class GrammarHistoryResponse(BaseModel):
    """Paginated list of past grammar corrections."""
    items: list[GrammarCheckResponse]
    total: int
    page: int
    page_size: int
