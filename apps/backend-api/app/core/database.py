"""
Supabase async client singleton.

create_async_client() itself is a coroutine, so the client can't be built at
import time. It's created lazily on first use rather than in a FastAPI
lifespan handler — ASGI lifespan events aren't guaranteed to fire under
every runner/test harness (e.g. httpx's ASGITransport doesn't trigger them
by default), so a lifespan-only init would silently break in contexts that
never run startup.
"""

from supabase import AsyncClient, create_async_client

from app.core.config import get_settings

settings = get_settings()

_client: AsyncClient | None = None


async def get_supabase() -> AsyncClient:
    """Return the Supabase async client, creating it on first call."""
    global _client
    if _client is None:
        _client = await create_async_client(
            settings.PUBLIC_SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client
