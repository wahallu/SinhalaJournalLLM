"""
Pydantic schemas for the Grammar Checker API.
Defines request/response shapes independently of ORM models.
"""

from datetime import datetime
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
