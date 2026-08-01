"""
Anonymous request rate limiting.

The four writing tools are usable without an account, which means
unauthenticated traffic reaches GPU inference. This caps that per client
IP. Authenticated callers are exempt — they are attributable, and abuse by
a known account is handled by suspension instead.

IPs are never stored raw. Only sha256(ip + IP_HASH_SALT) is persisted:
enough to rate-limit and investigate abuse, not a plaintext record of who
read what.
"""

import hashlib

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.repositories.telemetry_repository import count_recent_by_ip
from app.schemas.auth import AuthUser

_WINDOW_SECONDS = 3600


def _limit() -> int:
    return get_settings().ANON_REQUESTS_PER_HOUR


def hash_ip(ip: str) -> str:
    """One-way, salted hash of a client IP."""
    salt = get_settings().IP_HASH_SALT
    return hashlib.sha256(f"{ip}{salt}".encode()).hexdigest()


def client_ip(request: Request) -> str:
    """
    Caller's IP. Render terminates TLS at a proxy, so X-Forwarded-For's
    first entry is the real client; fall back to the socket peer.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce_anonymous_limit(request: Request, user: AuthUser | None) -> None:
    """Raise 429 when an anonymous caller has exceeded the hourly cap."""
    if user is not None:
        return

    ip_hash = hash_ip(client_ip(request))
    used = await count_recent_by_ip(ip_hash, _WINDOW_SECONDS)
    if used >= _limit():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Anonymous usage limit reached. "
                "Sign in to keep going and to save your history."
            ),
        )
