"""
Bearer-token verification for incoming requests.

Tokens are issued by this backend (see core/security.py) and signed with
JWT_SECRET. This module used to verify Supabase-issued JWTs against project
key material — via JWKS or a shared HS256 secret — and that indirection is
gone along with Supabase Auth.

The exported names — InvalidToken, decode_token, extract_bearer — are kept
exactly as they were, so core/deps.py and therefore every route's
optional_user / require_user / require_admin needed no changes at all.

Note: no role is read from the token. Application role lives in
profiles.role and is resolved separately in deps.py, which means promoting
someone to admin takes effect on their next request instead of waiting for
their current token to expire.
"""

from app.core.security import InvalidToken
from app.core.security import decode_token as _decode_typed

__all__ = ["InvalidToken", "decode_token", "extract_bearer"]


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
    Verify an access token and return its claims.

    Only `type: "access"` is accepted. A refresh token presented here is
    rejected: it is long-lived by design, so honouring it would turn a
    stolen refresh token into direct API access rather than only the
    ability to mint a short-lived one.

    Raises:
        InvalidToken: on any verification failure. The reason is logged at
            debug level but never surfaced — telling a caller why their
            token failed is an information leak.
    """
    return _decode_typed(token, expected_type="access")
