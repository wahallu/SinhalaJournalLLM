"""
Pydantic schemas for the Optimize Article pipeline.

One request runs several of the existing tools in order, so nothing here
redefines a result shape — each stage carries the very same payload its own
endpoint returns. A client that can already render a grammar result can
render the grammar stage of an optimize run without a second code path.
"""

from typing import Literal

from pydantic import BaseModel, Field

StageName = Literal["grammar", "style", "headline", "summary"]
StageStatus = Literal["running", "done", "skipped", "failed"]

# Order is meaning, not presentation: style rewriting regenerates the text,
# so a headline or summary produced before it would describe an article that
# no longer exists. Grammar runs first for the same reason, and the two
# read-only stages run last, off whatever text survived.
STAGE_ORDER: tuple[StageName, ...] = ("grammar", "style", "headline", "summary")

# Stage → the feature flag in app.core.features that gates it.
STAGE_FEATURES: dict[StageName, str] = {
    "grammar": "grammar",
    "style": "rewriter",
    "headline": "headlines",
    "summary": "summarizer",
}


class OptimizeRequest(BaseModel):
    """
    Input payload for a full optimize run.

    Grammar and headlines always run — they are the two stages that are
    useful for every article, and making everything optional would turn a
    one-click action into a form. Style and summary are opt-in.
    """

    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala article to optimize",
    )

    restyle: bool = Field(
        default=False,
        description="Rewrite the corrected text into `tone` before headlines and summary",
    )
    tone: str = Field(
        default="formal",
        description="Target style when `restyle` is set: formal | sports | youth | editorial | feature",
    )

    summarize: bool = Field(
        default=False,
        description="Produce a summary of the final text",
    )
    length: str = Field(
        default="medium",
        description="Summary length when `summarize` is set: short | medium | long",
    )

    headline_count: int = Field(
        default=3,
        ge=1,
        le=10,
        description="How many headline candidates to generate",
    )
    headline_category: str = Field(
        default="General",
        description="News category passed to the headline generator",
    )
    headline_length: str = Field(
        default="medium",
        description="Headline word band: short | medium | long",
    )


class OptimizeEvent(BaseModel):
    """
    One line of the NDJSON stream.

    The stream is the contract, not a convenience: four sequential model
    calls take long enough that a single spinner reads as a hang, so each
    stage is published the moment it resolves.

    `stage` is "pipeline" for the two envelope events — the opening plan and
    the closing result — and a stage name for everything in between.
    """

    stage: StageName | Literal["pipeline"]
    status: StageStatus
    data: dict | None = Field(
        default=None,
        description="The stage's own response payload, unchanged, once status is done",
    )
    error: str | None = Field(
        default=None,
        description="Human-readable failure reason when status is failed",
    )
    reason: str | None = Field(
        default=None,
        description="Why a stage was skipped: not_requested | disabled",
    )


class OptimizeResult(BaseModel):
    """
    The closing `pipeline` event's payload — everything the run produced.

    `final_text` is what the article should become: the corrected text, or
    the restyled text when that stage ran. It is the only value a client
    needs to write back into the editor.
    """

    original_text: str
    final_text: str

    grammar: dict | None = None
    style: dict | None = None
    headline: dict | None = None
    summary: dict | None = None

    stages_run: list[str] = Field(default_factory=list)
    stages_skipped: dict[str, str] = Field(
        default_factory=dict,
        description="Stage → skip reason, for stages that did not run",
    )
    stages_failed: dict[str, str] = Field(
        default_factory=dict,
        description="Stage → error message, for stages that ran and failed",
    )
