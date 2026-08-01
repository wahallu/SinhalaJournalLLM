"""
Supabase JWT verification.

Tokens are verified locally against project key material rather than by
calling Supabase on every request — an auth round-trip per API call would
double the latency of every endpoint.

Supabase projects sign either with a shared HS256 secret (older projects)
or asymmetrically with keys published at a JWKS endpoint (newer ones).
Both are supported: JWKS is tried when configured, HS256 otherwise.

Note: the `role` claim inside the JWT is the *Postgres* role
("authenticated") — NOT the application role. Application role lives in
profiles.role and is resolved separately in deps.py.
"""

import logging

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_ALGORITHMS = ["HS256", "ES256", "RS256"]
_AUDIENCE = "authenticated"

_jwks_client: PyJWKClient | None = None


class InvalidToken(Exception):
    """Token is absent, malformed, expired, or fails signature verification."""


def _jwt_secret() -> str:
    return get_settings().SUPABASE_JWT_SECRET


def _get_jwks_client() -> PyJWKClient | None:
    """Cached JWKS client; None when the project uses a shared secret."""
    global _jwks_client
    url = get_settings().SUPABASE_JWKS_URL
    if not url:
        return None
    if _jwks_client is None:
        _jwks_client = PyJWKClient(url, cache_keys=True)
    return _jwks_client


def extract_bearer(header: str | None) -> str | None:
    """Pull the token out of an `Authorization: Bearer <token>` header."""
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def decode_token(token: str) -> dict:
    """
    Verify signature, expiry, and audience; return the claims.

    Raises:
        InvalidToken: on any verification failure. The underlying reason is
            logged at debug level but never surfaced — telling a caller
            *why* their token failed is an information leak.
    """
    try:
        jwks = _get_jwks_client()
        if jwks is not None:
            key = jwks.get_signing_key_from_jwt(token).key
        else:
            key = _jwt_secret()
            if not key:
                raise InvalidToken("No JWT key material configured")

        return jwt.decode(
            token,
            key,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
            options={"require": ["exp", "sub"]},
        )
    except InvalidToken:
        raise
    except Exception as exc:
        logger.debug("JWT verification failed: %s", exc)
        raise InvalidToken("Invalid or expired token") from exc
