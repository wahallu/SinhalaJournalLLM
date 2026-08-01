"""
JWT verification unit tests. Tokens are minted locally with a test secret —
no Supabase project and no network involved.
"""

import time

import jwt
import pytest

from app.core.auth import InvalidToken, decode_token, extract_bearer

TEST_SECRET = "test-jwt-secret-not-a-real-one-but-long-enough-to-avoid-warnings"


def _token(**overrides) -> str:
    claims = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "reporter@sinai.lk",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    claims.update(overrides)
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    """Point the verifier at the test secret."""
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


def test_decode_valid_token():
    claims = decode_token(_token())
    assert claims["sub"] == "11111111-1111-1111-1111-111111111111"
    assert claims["email"] == "reporter@sinai.lk"


def test_expired_token_rejected():
    with pytest.raises(InvalidToken):
        decode_token(_token(exp=int(time.time()) - 10))


def test_wrong_signature_rejected():
    forged = jwt.encode(
        {"sub": "x", "aud": "authenticated"},
        "wrong-secret-but-also-long-enough-to-avoid-key-length-warnings",
        algorithm="HS256",
    )
    with pytest.raises(InvalidToken):
        decode_token(forged)


def test_wrong_audience_rejected():
    with pytest.raises(InvalidToken):
        decode_token(_token(aud="something-else"))


def test_malformed_token_rejected():
    with pytest.raises(InvalidToken):
        decode_token("not.a.jwt")


def test_none_algorithm_rejected():
    """An unsigned 'alg: none' token must never be accepted."""
    forged = jwt.encode({"sub": "x", "aud": "authenticated"}, None, algorithm="none")
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
