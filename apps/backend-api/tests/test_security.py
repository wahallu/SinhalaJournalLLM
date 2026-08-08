"""
Password hashing and token issuance for self-hosted auth.

Replaces Supabase Auth. Two properties matter most and are pinned here:
hashes Supabase already wrote must keep verifying (so existing users are not
forced to reset), and a token must not be accepted for a purpose it was not
issued for.
"""

import time
from types import SimpleNamespace

import bcrypt
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import security


# ── Password hashing ──

def test_hash_then_verify_round_trip():
    hashed = security.hash_password("correct horse battery")
    assert security.verify_password("correct horse battery", hashed)


def test_wrong_password_is_rejected():
    hashed = security.hash_password("correct horse battery")
    assert not security.verify_password("wrong horse battery", hashed)


def test_hash_is_salted_so_equal_passwords_differ():
    assert security.hash_password("same") != security.hash_password("same")


def test_verifies_supabase_written_hashes():
    """
    Supabase/GoTrue writes $2a$ bcrypt. Existing rows are copied into
    app_users verbatim by the migration, so those hashes must keep working
    or every current user is locked out.
    """
    supabase_style = bcrypt.hashpw(b"ExistingUserPw1", bcrypt.gensalt(prefix=b"2a")).decode()
    assert security.verify_password("ExistingUserPw1", supabase_style)


def test_verify_returns_false_on_a_malformed_hash():
    """A corrupt or truncated hash must fail closed, not raise."""
    assert not security.verify_password("anything", "not-a-bcrypt-hash")


def test_password_over_the_bcrypt_limit_is_refused():
    """
    bcrypt cannot take more than 72 bytes and raises rather than truncating.
    Refusing loudly here beats silently hashing only the first 72 bytes,
    which would make two different long passwords interchangeable.
    """
    with pytest.raises(ValueError):
        security.hash_password("x" * 73)


def test_multibyte_password_is_measured_in_bytes_not_characters():
    """Sinhala is 3 bytes per character in UTF-8, so 30 characters is 90
    bytes — over the limit even though it looks short."""
    with pytest.raises(ValueError):
        security.hash_password("අ" * 30)


# ── Tokens ──

def test_access_token_round_trip():
    token = security.create_access_token("user-123")
    claims = security.decode_token(token, expected_type="access")
    assert claims["sub"] == "user-123"


def test_refresh_token_round_trip():
    token = security.create_refresh_token("user-123")
    claims = security.decode_token(token, expected_type="refresh")
    assert claims["sub"] == "user-123"


def test_a_refresh_token_is_not_accepted_as_an_access_token():
    """
    Otherwise a stolen refresh token — which is long-lived by design —
    would grant API access directly instead of only the ability to mint a
    short-lived one.
    """
    refresh = security.create_refresh_token("user-123")
    with pytest.raises(security.InvalidToken):
        security.decode_token(refresh, expected_type="access")


def test_an_access_token_is_not_accepted_as_a_refresh_token():
    access = security.create_access_token("user-123")
    with pytest.raises(security.InvalidToken):
        security.decode_token(access, expected_type="refresh")


def test_expired_token_is_rejected():
    token = security.create_access_token("user-123", expires_in=-1)
    with pytest.raises(security.InvalidToken):
        security.decode_token(token, expected_type="access")


def test_tampered_token_is_rejected():
    token = security.create_access_token("user-123")
    tampered = token[:-4] + ("aaaa" if not token.endswith("aaaa") else "bbbb")
    with pytest.raises(security.InvalidToken):
        security.decode_token(tampered, expected_type="access")


def test_garbage_is_rejected():
    with pytest.raises(security.InvalidToken):
        security.decode_token("not.a.jwt", expected_type="access")


def test_tokens_carry_an_issued_at_and_expiry():
    token = security.create_access_token("user-123")
    claims = security.decode_token(token, expected_type="access")
    assert claims["iat"] <= int(time.time()) + 1
    assert claims["exp"] > int(time.time())


# ── Single-use email tokens (reset / verification) ──

def test_email_token_hash_is_stable_for_lookup():
    """Stored hashed so a leaked database row cannot be replayed as a link."""
    raw = security.generate_url_token()
    assert security.hash_url_token(raw) == security.hash_url_token(raw)


def test_email_tokens_are_unique_per_call():
    assert security.generate_url_token() != security.generate_url_token()


def test_email_token_hash_differs_from_the_raw_value():
    raw = security.generate_url_token()
    assert security.hash_url_token(raw) != raw


# ── Google Sign-In ──
#
# verify_google_id_token's own signature check runs for real against a
# throwaway RSA keypair standing in for Google's — only the network fetch
# of Google's actual JWKS is faked, via google_keypair below, so aud/iss/exp
# validation is exercised exactly as it runs in production.

def _google_id_token(private_key, **claim_overrides):
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "test-client-id",
        "sub": "1234567890",
        "email": "user@example.com",
        "email_verified": True,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        **claim_overrides,
    }
    return jwt.encode(claims, private_key, algorithm="RS256")


@pytest.fixture
def google_keypair(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(
        security._google_jwk_client,
        "get_signing_key_from_jwt",
        lambda _token: SimpleNamespace(key=private_key.public_key()),
    )
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    security.get_settings.cache_clear()
    return private_key


def test_valid_google_token_is_accepted(google_keypair):
    claims = security.verify_google_id_token(_google_id_token(google_keypair))
    assert claims["email"] == "user@example.com"


def test_google_token_accepts_the_bare_domain_issuer_form(google_keypair):
    """Google's own tokens and documentation use both forms interchangeably."""
    token = _google_id_token(google_keypair, iss="accounts.google.com")
    assert security.verify_google_id_token(token)["email"] == "user@example.com"


def test_google_token_for_a_different_client_is_rejected(google_keypair):
    """
    aud identifies which OAuth client the token was minted for. Accepting a
    mismatched aud would let a token minted for someone else's Google
    client sign in here.
    """
    token = _google_id_token(google_keypair, aud="someone-elses-client-id")
    with pytest.raises(security.InvalidGoogleToken):
        security.verify_google_id_token(token)


def test_google_token_with_an_unrecognized_issuer_is_rejected(google_keypair):
    token = _google_id_token(google_keypair, iss="https://not-google.example.com")
    with pytest.raises(security.InvalidGoogleToken):
        security.verify_google_id_token(token)


def test_google_token_without_an_email_is_rejected(google_keypair):
    token = _google_id_token(google_keypair, email="")
    with pytest.raises(security.InvalidGoogleToken):
        security.verify_google_id_token(token)


def test_expired_google_token_is_rejected(google_keypair):
    token = _google_id_token(google_keypair, exp=int(time.time()) - 10)
    with pytest.raises(security.InvalidGoogleToken):
        security.verify_google_id_token(token)


def test_google_sign_in_is_refused_when_unconfigured():
    """GOOGLE_CLIENT_ID defaults empty, which must disable the endpoint
    outright rather than accept a token meant for no client in particular."""
    with pytest.raises(security.InvalidGoogleToken):
        security.verify_google_id_token("irrelevant-without-a-configured-client-id")
