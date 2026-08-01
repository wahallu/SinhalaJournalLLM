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
import logging

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.repositories.telemetry_repository import count_recent_by_ip
from app.schemas.auth import AuthUser

logger = logging.getLogger(__name__)

_WINDOW_SECONDS = 3600


def _limit() -> int:
    return get_settings().ANON_REQUESTS_PER_HOUR


def hash_ip(ip: str) -> str:
    """One-way, salted hash of a client IP."""
    salt = get_settings().IP_HASH_SALT
    return hashlib.sha256(f"{ip}{salt}".encode()).hexdigest()


def client_ip(request: Request) -> str:
    """
    Caller's IP, read from the right-hand end of X-Forwarded-For.

    Proxies APPEND to this header, so the leftmost entry is whatever the
    caller sent and is entirely attacker-controlled — trusting it let anyone
    rotate `X-Forwarded-For` per request and bypass the rate limit outright.
    Only the last TRUSTED_PROXY_COUNT entries were written by infrastructure
    we control, so the client is the entry just before them.

    With the default of one proxy (Render's load balancer) that is the
    rightmost entry. Set TRUSTED_PROXY_COUNT to match the real chain if you
    put a CDN in front; too high and callers can spoof again, too low and
    everyone behind the proxy shares one bucket.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        depth = max(1, get_settings().TRUSTED_PROXY_COUNT)
        if len(hops) >= depth:
            return hops[-depth]
        # Fewer hops than configured means the request did not traverse the
        # expected chain; fall back to the socket peer rather than trusting
        # a header we cannot place.
    return request.client.host if request.client else "unknown"


async def enforce_anonymous_limit(request: Request, user: AuthUser | None) -> None:
    """Raise 429 when an anonymous caller has exceeded the hourly cap."""
    if user is not None:
        return

    ip_hash = hash_ip(client_ip(request))
    try:
        used = await count_recent_by_ip(ip_hash, _WINDOW_SECONDS)
    except Exception:
        # The counter is derived from telemetry; if that read fails the
        # request should still be served. Failing closed here turns a
        # storage blip into a total outage for anonymous users, which is a
        # worse outcome than briefly not enforcing a cost control.
        logger.exception("Rate-limit lookup failed — allowing the request")
        return

    if used >= _limit():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Anonymous usage limit reached. "
                "Sign in to keep going and to save your history."
            ),
        )
