"""
Per-request PostgREST client carrying the caller's JWT.

The service-role client in `database.py` bypasses Row Level Security by
design — admin queries and telemetry need that. User-facing history reads
must not use it, or RLS contributes nothing on the backend: a dropped
`WHERE` clause would return every user's articles.

This builds a PostgREST-only client (history queries need nothing else)
whose Authorization header is the caller's token, so Postgres evaluates the
`user_id = auth.uid()` policies itself.

The underlying httpx client is module-level and shared. Constructing a fresh
one per request would discard connection pooling and pay a TLS handshake on
every call; the per-request object here is a thin wrapper over that shared
transport.
"""

import httpx
from postgrest import AsyncPostgrestClient

from app.core.config import get_settings

_http_client: httpx.AsyncClient | None = None


def _shared_http() -> httpx.AsyncClient:
    """Lazily created, reused across requests so the pool survives."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=10.0)
    return _http_client


async def user_postgrest(jwt: str) -> AsyncPostgrestClient:
    """
    PostgREST client authenticated as the caller.

    Row Level Security applies to everything this client reads or writes,
    which is the point: isolation is enforced by Postgres rather than by
    application code remembering to filter.
    """
    settings = get_settings()
    return AsyncPostgrestClient(
        f"{settings.PUBLIC_SUPABASE_URL}/rest/v1",
        headers={
            "apikey": settings.SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {jwt}",
        },
        http_client=_shared_http(),
    )
