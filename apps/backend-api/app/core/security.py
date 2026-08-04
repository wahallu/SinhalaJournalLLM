"""
Password hashing and token issuance for self-hosted authentication.

Replaces Supabase Auth. Supabase remains the database — this module only
owns credentials and session tokens.

bcrypt is used directly rather than through passlib: passlib's last release
was 2020 and it breaks against bcrypt 4+ (it reads a removed `__about__`
attribute and its startup probe trips the 72-byte limit). bcrypt's own API
is small enough that the wrapper bought nothing.

Tokens are HS256 signed with JWT_SECRET and carry a `type` claim, so a
refresh token cannot be replayed as an access token — see decode_token.
"""

import hashlib
import hmac
import logging
import secrets
import time

import bcrypt
import jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"

# bcrypt hashes at most 72 bytes and raises past that rather than
# truncating. Refusing loudly is the right call: silently hashing only the
# first 72 bytes would make two different long passwords interchangeable.
MAX_PASSWORD_BYTES = 72


class InvalidToken(Exception):
    """Token is malformed, expired, wrongly typed, or fails verification."""


# Verified against when no such user exists, so a login attempt costs the
# same bcrypt work either way. Without it, "unknown address" returns
# noticeably faster than "wrong password" and the endpoint becomes a way to
# discover which addresses are registered. The value is a real bcrypt hash
# of a random string; nothing can match it.
DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.7VXCkYJdgcCVQ0RTa1oGkV6mOaBsQ1u"


def _secret() -> str:
    secret = get_settings().JWT_SECRET
    if not secret:
        raise RuntimeError(
            "JWT_SECRET is not set — refusing to issue or verify tokens. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    return secret


# ── Passwords ──

def hash_password(password: str) -> str:
    """
    bcrypt hash of `password`.

    Raises:
        ValueError: when the password exceeds bcrypt's 72-byte ceiling.
            Measured in bytes, not characters — Sinhala is 3 bytes per
            character in UTF-8, so a 30-character passphrase is already 90.
    """
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password is {len(encoded)} bytes; bcrypt accepts at most {MAX_PASSWORD_BYTES}."
        )
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """
    Whether `password` matches `hashed`. Fails closed on anything
    unparseable rather than raising, so a corrupted row cannot 500 a login.

    Verifies Supabase/GoTrue's `$2a$` hashes as well as the `$2b$` this
    module writes, which is what lets existing users migrate without
    resetting their password.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        logger.warning("Password verification failed against a malformed hash")
        return False


# ── Session tokens ──

def _create_token(subject: str, token_type: str, expires_in: int, **extra) -> str:
    now = int(time.time())
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_in,
        **extra,
    }
    return jwt.encode(payload, _secret(), algorithm=_ALGORITHM)


def create_access_token(subject: str, expires_in: int | None = None, **extra) -> str:
    """Short-lived token sent on every API call."""
    ttl = expires_in if expires_in is not None else get_settings().ACCESS_TOKEN_TTL_MINUTES * 60
    return _create_token(subject, "access", ttl, **extra)


def create_refresh_token(subject: str, expires_in: int | None = None) -> str:
    """Long-lived token whose only power is minting access tokens."""
    ttl = expires_in if expires_in is not None else get_settings().REFRESH_TOKEN_TTL_DAYS * 86400
    return _create_token(subject, "refresh", ttl)


def decode_token(token: str, *, expected_type: str) -> dict:
    """
    Verify signature, expiry and purpose; return the claims.

    `expected_type` is not optional on purpose. A refresh token is
    deliberately long-lived, so accepting one wherever an access token is
    expected would turn a stolen refresh token into direct API access
    instead of only the ability to mint a short-lived one.

    Raises:
        InvalidToken: on any failure. The underlying reason is logged at
            debug level but never surfaced — telling a caller why their
            token failed is an information leak.
    """
    try:
        claims = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    except Exception as exc:
        logger.debug("Token verification failed: %s", exc)
        raise InvalidToken("Invalid or expired token") from exc

    if claims.get("type") != expected_type:
        logger.debug("Token type mismatch: got %r, wanted %r", claims.get("type"), expected_type)
        raise InvalidToken("Invalid or expired token")
    if not claims.get("sub"):
        raise InvalidToken("Invalid or expired token")
    return claims


# ── Single-use email tokens (password reset, address verification) ──

def generate_url_token() -> str:
    """Opaque, URL-safe secret to put in an emailed link."""
    return secrets.token_urlsafe(32)


def hash_url_token(raw: str) -> str:
    """
    What gets stored. Only the hash is persisted, so a leaked database row
    cannot be replayed as a working reset link — the same reason passwords
    are not stored in the clear.

    SHA-256 rather than bcrypt: these values are already 256 bits of
    entropy from a CSPRNG, so there is nothing to brute-force and the
    lookup stays a cheap indexed equality check.
    """
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def url_tokens_match(raw: str, stored_hash: str) -> bool:
    """Constant-time comparison, to keep lookups free of a timing oracle."""
    return hmac.compare_digest(hash_url_token(raw), stored_hash)
