"""
Shared, pooled outbound HTTP client.

Every inference call used to open `httpx.AsyncClient()` and close it again,
which throws away the connection after one request: a fresh TCP handshake —
and, to OpenRouter/Groq or the ngrok-fronted GPU box, a fresh TLS handshake —
in front of every generation. One long-lived client keeps connections alive
and reuses them across requests.

Timeouts stay per call (`client.post(..., timeout=...)`): the SinLlama
generate budget is minutes, the health probe is seconds, and a single
client-wide timeout would be wrong for one of them.

The client is bound to the event loop that created it. A second loop (pytest
starts one per test; uvicorn --reload starts a new one per reload) gets a
fresh client instead of a pool whose sockets belong to a dead loop.
"""

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

# Sized for a single worker process. The GPU server handles a handful of
# generations at once, so a larger pool would only queue work there instead.
_LIMITS = httpx.Limits(
    max_connections=100,
    max_keepalive_connections=20,
    keepalive_expiry=30.0,
)
_DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def get_http_client() -> httpx.AsyncClient:
    """The process-wide pooled client for the running event loop."""
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    if _client is None or _client.is_closed or _client_loop is not loop:
        _client = httpx.AsyncClient(limits=_LIMITS, timeout=_DEFAULT_TIMEOUT)
        _client_loop = loop
    return _client


async def close_http_client() -> None:
    """Close the pool on shutdown so keep-alive sockets are released cleanly."""
    global _client, _client_loop
    if _client is not None and not _client.is_closed:
        try:
            await _client.aclose()
        except Exception:  # shutdown must not fail on a half-dead socket
            logger.warning("Error closing shared HTTP client", exc_info=True)
    _client = None
    _client_loop = None
