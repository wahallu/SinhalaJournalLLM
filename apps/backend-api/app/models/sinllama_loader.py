"""
HTTP client for the SinLlama inference server.

The model itself lives in the research environment
(SinAI-Training/work/sinllama/serve_sinai.py) — a FastAPI app that loads
SinLLaMA-merged-base plus all four task adapters on GPU and exposes:

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
    length: str | None = None,
    adapter: str | None = None,
    num_candidates: int = 1,
) -> dict[str, Any]:
    """
    Call the inference server's /generate endpoint.

    `length` (short|medium|long) applies to the summarizer and headline tasks.
    It's worth sending even alongside a fully-formed prompt: the server reads
    it for the per-task token budget, which a formed prompt can't carry.
    Servers on an older build ignore the field.

    `num_candidates` requests multiple sampled candidates in one call (server
    support: work/serve_sinai.py's PromptRequest.num_candidates — forces
    sampling even for tasks that default to greedy, e.g. grammar). 1, the
    default, omits the field entirely, so the request is byte-identical to
    what a server predating this parameter already understands.

    Returns the raw response dict:
        {"response", "task", "style", "length", "input_tokens", "max_cap_used",
         "output_tokens", "candidates"?}
    "candidates" is present only when num_candidates > 1 and the server
    supports it.

    Raises:
        SinLlamaUnavailable: on connection errors, timeouts, or 5xx responses.
    """
    settings = get_settings()
    url = f"{settings.SINLLAMA_API_URL}/generate"
    payload: dict[str, Any] = {"prompt": prompt, "task": task}
    if style is not None:
        payload["style"] = style
    if length is not None:
        payload["length"] = length
    if adapter:
        # Only sent when an admin has chosen one. A server that predates
        # adapter support ignores the extra field, so this stays backward
        # compatible; one that supports it but rejects the value returns 422,
        # which the gateway retries without the override.
        payload["adapter"] = adapter
    if num_candidates and num_candidates > 1:
        payload["num_candidates"] = num_candidates

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


async def sinllama_get_comparison_adapters() -> dict[str, Any]:
    """Call the comparison inference server's /adapters endpoint."""
    settings = get_settings()
    url = f"{settings.SINLLAMA_COMPARISON_API_URL}/adapters"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise SinLlamaUnavailable(f"SinLlama comparison server unreachable: {exc}") from exc
    except Exception as exc:
        raise SinLlamaUnavailable(f"SinLlama comparison server unexpected error: {exc}") from exc


async def sinllama_run_comparison(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Call the comparison inference server's /compare endpoint."""
    settings = get_settings()
    url = f"{settings.SINLLAMA_COMPARISON_API_URL}/compare"
    try:
        async with httpx.AsyncClient(timeout=settings.SINLLAMA_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise SinLlamaUnavailable(f"SinLlama comparison server error: {exc}") from exc
    except Exception as exc:
        raise SinLlamaUnavailable(f"SinLlama comparison server unexpected error: {exc}") from exc

