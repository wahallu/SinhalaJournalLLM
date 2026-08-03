"""
Optimize Article — the four writing tools run as one ordered pipeline.

This orchestrates the existing services rather than reimplementing them, so
a change to grammar correction or headline banding reaches an optimize run
for free, and every stage still persists to its own history table under its
own record id.

Two properties are the whole point of the module:

  Order.  Style rewriting *regenerates* the article. A headline or summary
          produced from the pre-rewrite text would describe copy that no
          longer exists, so the read-only stages are held until the text has
          stopped changing. `final_text` threads that dependency explicitly.

  Isolation.  A stage that fails does not take the run with it. Headlines
          are four separate generations behind one call; losing them should
          not also lose a grammar pass the user already waited for. Failures
          are reported per stage and the pipeline continues.
"""

import asyncio
import logging
from collections.abc import AsyncIterator

from app.core.features import is_enabled
from app.schemas.optimize import (
    STAGE_FEATURES,
    OptimizeEvent,
    OptimizeRequest,
    OptimizeResult,
)
from app.services.grammar.grammar_service import check_grammar
from app.services.headline.headline_service import generate_headlines
from app.services.style.style_service import rewrite_style
from app.services.summarizer.summarizer_service import summarize_text

logger = logging.getLogger(__name__)


async def _stage_allowed(stage: str, requested: bool) -> str | None:
    """
    None when the stage should run, otherwise the reason it should not.

    An operator switching a tool off should not break Optimize — the run
    continues without that stage and says so. 503-ing the whole pipeline
    because one of four tools is in maintenance would be a worse trade.
    """
    if not requested:
        return "not_requested"
    if not await is_enabled(STAGE_FEATURES[stage]):
        return "disabled"
    return None


class _Accumulator:
    """Mutable run state, kept out of the generator body for readability."""

    def __init__(self, original: str):
        self.result = OptimizeResult(original_text=original, final_text=original)

    def done(self, stage: str, payload: dict) -> OptimizeEvent:
        setattr(self.result, stage, payload)
        self.result.stages_run.append(stage)
        return OptimizeEvent(stage=stage, status="done", data=payload)

    def skipped(self, stage: str, reason: str) -> OptimizeEvent:
        self.result.stages_skipped[stage] = reason
        return OptimizeEvent(stage=stage, status="skipped", reason=reason)

    def failed(self, stage: str, exc: BaseException) -> OptimizeEvent:
        message = str(exc) or exc.__class__.__name__
        self.result.stages_failed[stage] = message
        logger.exception("Optimize stage %s failed", stage)
        return OptimizeEvent(stage=stage, status="failed", error=message)


async def run_optimize(
    payload: OptimizeRequest, user_id: str | None = None
) -> AsyncIterator[OptimizeEvent]:
    """
    Run the pipeline, yielding one event per state change.

    Emits, in order: a `pipeline`/running envelope carrying the plan, then
    running/done (or skipped/failed) for each stage, then a
    `pipeline`/done envelope carrying the assembled OptimizeResult.

    The caller is responsible for serialising these — see the /optimize
    endpoint, which writes them as NDJSON.
    """
    text = payload.text.strip()
    acc = _Accumulator(text)

    # Resolved up front so the client can render the full stage list —
    # including the ones that will be skipped — before the first model call
    # returns, instead of having rows appear one at a time.
    plan = {
        "grammar": await _stage_allowed("grammar", True),
        "style": await _stage_allowed("style", payload.restyle),
        "headline": await _stage_allowed("headline", True),
        "summary": await _stage_allowed("summary", payload.summarize),
    }
    yield OptimizeEvent(
        stage="pipeline",
        status="running",
        data={"plan": {stage: (reason or "queued") for stage, reason in plan.items()}},
    )

    # ── 1. Grammar ─────────────────────────────────────────────────────
    # First, so every later stage works from clean copy.
    if plan["grammar"]:
        yield acc.skipped("grammar", plan["grammar"])
    else:
        yield OptimizeEvent(stage="grammar", status="running")
        try:
            grammar = await check_grammar(text, user_id=user_id)
            acc.result.final_text = grammar.corrected
            yield acc.done("grammar", grammar.model_dump(mode="json"))
        except Exception as exc:  # noqa: BLE001 — reported, not swallowed
            yield acc.failed("grammar", exc)

    # ── 2. Style ───────────────────────────────────────────────────────
    # Runs on the corrected text and replaces it. Anything downstream must
    # wait for this, which is why the pipeline is not simply four parallel
    # calls.
    if plan["style"]:
        yield acc.skipped("style", plan["style"])
    else:
        yield OptimizeEvent(stage="style", status="running")
        try:
            style = await rewrite_style(
                acc.result.final_text, payload.tone, user_id=user_id
            )
            acc.result.final_text = style.rewritten
            yield acc.done("style", style.model_dump(mode="json"))
        except Exception as exc:  # noqa: BLE001
            yield acc.failed("style", exc)

    # ── 3 & 4. Headline + summary ──────────────────────────────────────
    # Both read `final_text` and neither writes it, so they are independent
    # of each other and run concurrently — the only place in the pipeline
    # where that is safe.
    final_text = acc.result.final_text
    tail: dict[str, asyncio.Task] = {}

    if plan["headline"]:
        yield acc.skipped("headline", plan["headline"])
    else:
        tail["headline"] = asyncio.create_task(
            generate_headlines(
                final_text,
                count=payload.headline_count,
                category=payload.headline_category,
                length=payload.headline_length,
                user_id=user_id,
            )
        )

    if plan["summary"]:
        yield acc.skipped("summary", plan["summary"])
    else:
        tail["summary"] = asyncio.create_task(
            summarize_text(final_text, payload.length, user_id=user_id)
        )

    for stage in tail:
        yield OptimizeEvent(stage=stage, status="running")

    # as_completed order, so whichever finishes first is published first.
    pending = {task: stage for stage, task in tail.items()}
    while pending:
        finished, _ = await asyncio.wait(
            pending.keys(), return_when=asyncio.FIRST_COMPLETED
        )
        for task in finished:
            stage = pending.pop(task)
            try:
                yield acc.done(stage, task.result().model_dump(mode="json"))
            except Exception as exc:  # noqa: BLE001
                yield acc.failed(stage, exc)

    yield OptimizeEvent(
        stage="pipeline",
        status="done",
        data=acc.result.model_dump(mode="json"),
    )
