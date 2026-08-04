"""
Bearer-token verification as the request path sees it.

core/auth is now a thin adapter over core/security — it exists so that
core/deps, and therefore every route, needed no changes when authentication
moved off Supabase. What is asserted here is that adapter's contract: only
a valid *access* token from our own issuer is accepted.

The signing and hashing primitives themselves are covered in
test_security.py; this file covers what deps.py actually calls.
"""

import time

import jwt
import pytest

from app.core import security
from app.core.auth import InvalidToken, decode_token, extract_bearer

USER_ID = "11111111-1111-1111-1111-111111111111"


def test_decode_valid_access_token():
    claims = decode_token(security.create_access_token(USER_ID))
    assert claims["sub"] == USER_ID


def test_expired_token_rejected():
    with pytest.raises(InvalidToken):
        decode_token(security.create_access_token(USER_ID, expires_in=-10))


def test_wrong_signature_rejected():
    forged = jwt.encode(
        {"sub": USER_ID, "type": "access", "exp": int(time.time()) + 3600},
        "wrong-secret-but-also-long-enough-to-avoid-key-length-warnings",
        algorithm="HS256",
    )
    with pytest.raises(InvalidToken):
        decode_token(forged)


def test_refresh_token_rejected_on_the_request_path():
    """
    The whole point of the type claim: a refresh token is long-lived, so
    accepting one here would turn a stolen refresh token into direct API
    access rather than only the ability to mint a short-lived one.
    """
    with pytest.raises(InvalidToken):
        decode_token(security.create_refresh_token(USER_ID))


def test_token_without_a_subject_rejected():
    forged = jwt.encode(
        {"type": "access", "exp": int(time.time()) + 3600},
        security._secret(), algorithm="HS256",
    )
    with pytest.raises(InvalidToken):
        decode_token(forged)


def test_malformed_token_rejected():
    with pytest.raises(InvalidToken):
        decode_token("not.a.jwt")


def test_none_algorithm_rejected():
    """An unsigned 'alg: none' token must never be accepted."""
    forged = jwt.encode({"sub": USER_ID, "type": "access"}, None, algorithm="none")
    with pytest.raises(InvalidToken):
        decode_token(forged)


@pytest.mark.parametrize("header,expected", [
    ("Bearer abc.def.ghi", "abc.def.ghi"),
    ("bearer abc.def.ghi", "abc.def.ghi"),
    ("Basic abc", None),
    ("", None),
    (None, None),
    ("Bearer", None),
])
def test_extract_bearer(header, expected):
    assert extract_bearer(header) == expected
