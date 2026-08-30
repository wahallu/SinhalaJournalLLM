"""
FastAPI application entrypoint.

- CORS middleware
- Router registration
- Global health checks (basic + model gateway)
- ModelGatewayError → 503 handler
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.core.config import get_settings
from app.core.model_gateway import ModelGatewayError, gateway_status
from app.repositories.base import DatabaseUnavailable

settings = get_settings()

app = FastAPI(
    title="SinAI — Sinhala Journalism LLM API",
    description=(
        "Backend API for Sinhala grammar checking, headline generation, "
        "style rewriting, and summarization. Inference runs on the fine-tuned "
        "SinLlama model server, with hosted-LLM and offline fallbacks."
    ),
    version="2.0.0",
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


@app.get("/health/model", tags=["Health"])
async def health_model():
    """Model gateway status, including SinLlama server reachability."""
    return await gateway_status()
