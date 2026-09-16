"""
FastAPI application entrypoint.

- CORS middleware
- Router registration
- Global health checks (basic + model gateway)
- ModelGatewayError → 503 handler
- CORS-safe handling for unhandled errors
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.core.config import get_settings
from app.core.model_gateway import ModelGatewayError, gateway_status
from app.core.observability import (
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
    configure_logging,
    get_request_id,
)
from app.repositories import base
from app.repositories.base import DatabaseUnavailable

logger = logging.getLogger(__name__)

settings = get_settings()

_IS_PRODUCTION = settings.APP_ENV.lower() == "production"

# JSON lines in production, where logs are read by machine; the readable
# formatter everywhere else, where they are read by a person.
configure_logging(json_logs=_IS_PRODUCTION)

app = FastAPI(
    title="SinAI — Sinhala Journalism LLM API",
    description=(
        "Backend API for Sinhala grammar checking, headline generation, "
        "style rewriting, and summarization. Inference runs on the fine-tuned "
        "SinLlama model server, with hosted-LLM and offline fallbacks."
    ),
    version="2.0.0",
)

# ── Unhandled errors ──
# Registered BEFORE the CORS middleware on purpose. Starlette builds its
# middleware stack outermost-last, so this ends up *inside* CORSMiddleware and
# its responses pick up the CORS headers on the way out. The built-in 500 does
# not: it comes from ServerErrorMiddleware, which wraps everything including
# CORSMiddleware, so an unhandled exception reaches the browser as an opaque
# cross-origin failure and the frontend can only report "Failed to fetch" --
# the real error is unreadable to the one person who needs to see it. Catching
# here turns any unhandled exception into an ordinary, readable 500.
@app.middleware("http")
async def cors_safe_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        # The id is echoed in the body as well as the header so a user can
        # quote it from whatever the frontend chooses to show them.
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Something went wrong handling this request.",
                "request_id": get_request_id(),
            },
        )


# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://([a-zA-Z0-9_-]+\.)?sin-ai\.app$|^https://([a-zA-Z0-9_-]+\.)?onrender\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request correlation and security headers ──
# Added after CORSMiddleware so they end up OUTSIDE it: Starlette builds the
# stack outermost-last. The request id must be bound before anything else can
# log, and the headers must be on every response CORS lets through.
app.add_middleware(SecurityHeadersMiddleware, hsts=_IS_PRODUCTION)
app.add_middleware(RequestIdMiddleware)

# ── Routers ──
app.include_router(v1_router)


# ── Error handling ──
@app.exception_handler(ModelGatewayError)
async def model_gateway_error_handler(request: Request, exc: ModelGatewayError):
    """Every inference provider failed and fallback is disabled."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Model inference is currently unavailable. Please try again shortly.",
            "error": str(exc),
        },
    )


@app.exception_handler(DatabaseUnavailable)
async def database_unavailable_handler(request: Request, exc: DatabaseUnavailable):
    """History storage is unreachable — inference itself still works."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": "History storage is currently unreachable. New results are still generated, but past activity can't be loaded.",
        },
    )


# ── Health checks ──
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "service": "SinAI Backend",
        "version": "2.0.0",
    }


@app.get("/health", tags=["Health"])
async def health():
    """Fast liveness probe — no downstream calls."""
    return {"status": "healthy"}


@app.get("/health/ready", tags=["Health"])
async def health_ready():
    """
    Readiness probe — is this instance fit to serve traffic?

    Distinct from /health, which must stay a pure liveness check: an
    orchestrator that restarts on a failed liveness probe would kill every
    instance during a database blip, turning a degraded service into no
    service. Readiness only removes the instance from rotation.

    Checked against the database because authentication reads `profiles` on
    every request — without it, the service is up but nobody can sign in.
    """
    try:
        await base.ping()
    except Exception as exc:
        logger.warning("Readiness check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "database": "unreachable"},
        )
    return {"status": "ready", "database": "ok"}


@app.get("/health/model", tags=["Health"])
async def health_model():
    """Model gateway status, including SinLlama server reachability."""
    return await gateway_status()
