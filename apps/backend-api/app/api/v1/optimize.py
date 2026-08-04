"""
Optimize Article API endpoint.

POST /optimize — run grammar, style, headlines, and summary as one pipeline,
                 streamed as NDJSON (one JSON object per line).

Why a stream rather than a JSON body: the pipeline is up to four model calls
and two of them cannot start until the rewrite returns, so a single response
would leave the user watching a spinner for the whole run. Each stage is
flushed the moment it resolves.

Why one endpoint and not a client-side loop over the existing four: ordering
(see optimize_service), a single rate-limit unit rather than four, and one
telemetry row that identifies the run as an optimize rather than as four
unrelated tool calls.
"""

import json
import logging
import time
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.core.deps import optional_user
from app.core.features import TOOL_LABELS, is_enabled
from app.core.model_gateway import add_tokens
from app.core.rate_limit import client_ip, enforce_anonymous_limit, hash_ip
from app.repositories.telemetry_repository import record_request
from app.schemas.auth import AuthUser
from app.schemas.optimize import OptimizeEvent, OptimizeRequest
from app.services.optimize.optimize_service import run_optimize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/optimize", tags=["Optimize"])

# Stages whose absence makes a run pointless. Style and summary are opt-in
# extras, but a run that can neither correct the text nor propose a headline
# has nothing left to do, so that case is a real 503 rather than a stream of
# four "skipped" events.
_ESSENTIAL_FEATURES = ("grammar", "headlines")


def _serialise(event: OptimizeEvent) -> bytes:
    """One NDJSON line. `separators` keeps Sinhala payloads compact."""
    return (
        json.dumps(
            event.model_dump(mode="json", exclude_none=True),
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


@router.post("")
async def optimize_endpoint(
    request: Request,
    payload: OptimizeRequest,
    user: AuthUser | None = Depends(optional_user),
):
    """
    Run the full optimize pipeline over one article.

    Responds with `application/x-ndjson`: a `pipeline` event carrying the
    plan, then `running` and `done`/`skipped`/`failed` events per stage, then
    a closing `pipeline` event carrying the assembled result.

    Everything that can legitimately produce an HTTP error — the rate limit,
    a fully disabled pipeline — is checked here, before the first byte goes
    out. Once the stream has started the status code is already 200, so any
    later failure is reported as a `failed` event instead.
    """
    await enforce_anonymous_limit(request, user)

    if not any([await is_enabled(tool) for tool in _ESSENTIAL_FEATURES]):
        disabled = ", ".join(TOOL_LABELS[tool] for tool in _ESSENTIAL_FEATURES)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Optimize Article is temporarily unavailable — {disabled} are "
                "both switched off."
            ),
        )

    user_id = user.id if user else None
    ip_hash = hash_ip(client_ip(request))

    async def stream() -> AsyncIterator[bytes]:
        started = time.perf_counter()
        provider: str | None = None
        input_tokens: int | None = None
        output_tokens: int | None = None
        failed: dict[str, str] = {}

        try:
            async for event in run_optimize(payload, user_id=user_id):
                # Tokens and provider are reported per stage; the run's own
                # telemetry row is the sum, so an optimize costs one row and
                # not four the way a client-side loop would.
                if event.status == "done" and event.data:
                    provider = provider or event.data.get("model_used")
                    input_tokens = add_tokens(input_tokens, event.data.get("input_tokens"))
                    output_tokens = add_tokens(output_tokens, event.data.get("output_tokens"))
                if event.status == "failed":
                    failed[str(event.stage)] = event.error or "failed"
                yield _serialise(event)
        except Exception as exc:  # noqa: BLE001
            # The generator itself broke — not a stage. The client is mid
            # stream and cannot be sent a status code, so tell it in band.
            logger.exception("Optimize pipeline aborted")
            failed["pipeline"] = str(exc)
            yield _serialise(
                OptimizeEvent(stage="pipeline", status="failed", error=str(exc))
            )
        finally:
            await record_request(
                user_id=user_id,
                endpoint="/api/v1/optimize",
                method="POST",
                tool="optimize",
                # A partial run still served the stages that worked, so the
                # HTTP status stays 200; 207 records "some stage failed"
                # without claiming the request itself did.
                status_code=207 if failed else 200,
                latency_ms=int((time.perf_counter() - started) * 1000),
                provider=provider,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                ip_hash=ip_hash,
            )

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson",
        headers={
            # Without this, nginx and friends buffer the whole response and
            # the per-stage streaming this endpoint exists for silently stops
            # working in production while still passing locally.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-store",
        },
    )
