"""
HTTP client for the SinLlama inference server.

The model itself lives in the research environment
(SinAI-Training/work/sinllama/serve_sinllama.py) — a FastAPI app that loads
SinLLaMA-merged-base on GPU and exposes:

    POST /generate  {"prompt": str, "task": "grammar|headline|summarizer|style",
                     "style": "formal|sports|youth|editorial|feature" | null}
    GET  /health
    GET  /tasks

`prompt` may be raw text (the server wraps it in the task's training template)
or a fully-formed Alpaca prompt containing "### Instruction:" (passed through
untouched — that's how we control summary length and headline variations).

This backend never loads model weights; it only speaks that HTTP contract.
"""

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class SinLlamaUnavailable(Exception):
    """Raised when the inference server can't be reached or errors out."""


async def sinllama_generate(
    prompt: str,
    task: str,
    style: str | None = None,
) -> dict[str, Any]:
    """
    Call the inference server's /generate endpoint.

    Returns the raw response dict:
        {"response", "task", "style", "input_tokens", "max_cap_used", "output_tokens"}

    Raises:
        SinLlamaUnavailable: on connection errors, timeouts, or 5xx responses.
    """
    settings = get_settings()
    url = f"{settings.SINLLAMA_API_URL}/generate"
    payload: dict[str, Any] = {"prompt": prompt, "task": task}
    if style is not None:
        payload["style"] = style

    try:
        async with httpx.AsyncClient(timeout=settings.SINLLAMA_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        # 422 = our bug (bad style value etc.) — surface it, don't mask as availability
        if exc.response.status_code == 422:
            raise
        raise SinLlamaUnavailable(
            f"SinLlama server returned {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        raise SinLlamaUnavailable(f"SinLlama server unreachable: {exc}") from exc

    if "response" not in data:
        raise SinLlamaUnavailable(f"Unexpected SinLlama response shape: {data}")
    return data


async def sinllama_health() -> bool:
    """True when the inference server responds to /health."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.SINLLAMA_API_URL}/health")
            return response.status_code == 200
    except httpx.HTTPError:
        return False
