"""Anonymous IP rate limiting. Authenticated callers are never limited here."""

import time

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one-but-long-enough-to-avoid-warnings"
USER_A = "11111111-1111-1111-1111-111111111111"
_TEXT = "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් ජයග්‍රහණයක් වාර්තා කළේය."


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture(autouse=True)
def _small_limit(monkeypatch):
    """Drop the limit to 2 so the test does not need 20 requests."""
    from app.core import rate_limit
    monkeypatch.setattr(rate_limit, "_limit", lambda: 2)


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_A, "email": "a@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


def test_hash_ip_is_stable_and_not_reversible():
    from app.core.rate_limit import hash_ip
    assert hash_ip("203.0.113.7") == hash_ip("203.0.113.7")
    assert hash_ip("203.0.113.7") != hash_ip("203.0.113.8")
    assert "203.0.113.7" not in hash_ip("203.0.113.7")


@pytest.mark.asyncio
async def test_anonymous_blocked_after_limit(fake_supabase):
    headers = {"X-Forwarded-For": "203.0.113.7"}
    async with _client() as c:
        assert (await c.post("/api/v1/summarize",
                json={"text": _TEXT, "length": "short"}, headers=headers)).status_code == 200
        assert (await c.post("/api/v1/summarize",
                json={"text": _TEXT, "length": "short"}, headers=headers)).status_code == 200
        third = await c.post("/api/v1/summarize",
                json={"text": _TEXT, "length": "short"}, headers=headers)
    assert third.status_code == 429


@pytest.mark.asyncio
async def test_limit_is_per_ip(fake_supabase):
    async with _client() as c:
        for _ in range(2):
            await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                         headers={"X-Forwarded-For": "203.0.113.7"})
        other = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                             headers={"X-Forwarded-For": "198.51.100.4"})
    assert other.status_code == 200


@pytest.mark.asyncio
async def test_authenticated_callers_are_not_limited(fake_supabase):
    token = jwt.encode(
        {"sub": USER_A, "email": "a@sinai.lk", "aud": "authenticated",
         "exp": int(time.time()) + 3600, "iat": int(time.time())},
        TEST_SECRET, algorithm="HS256")
    headers = {"X-Forwarded-For": "203.0.113.7", "Authorization": f"Bearer {token}"}
    async with _client() as c:
        for _ in range(4):
            r = await c.post("/api/v1/summarize",
                             json={"text": _TEXT, "length": "short"}, headers=headers)
            assert r.status_code == 200


@pytest.mark.asyncio
async def test_rotating_x_forwarded_for_cannot_evade_the_limit(fake_supabase):
    """
    Regression: client_ip originally trusted the LEFTMOST X-Forwarded-For
    entry, which is entirely caller-controlled — proxies append. Rotating the
    header per request gave unlimited free GPU inference.

    With one trusted proxy the client is the rightmost entry, so a caller
    varying the left-hand entries lands in the same bucket.
    """
    async with _client() as c:
        codes = []
        for i in range(4):
            r = await c.post(
                "/api/v1/summarize",
                json={"text": _TEXT, "length": "short"},
                # Attacker varies what they send; the proxy appends the real
                # peer as the final hop.
                headers={"X-Forwarded-For": f"8.8.8.{i}, 203.0.113.7"},
            )
            codes.append(r.status_code)

    assert codes[:2] == [200, 200]
    assert 429 in codes[2:], f"rotation evaded the limit: {codes}"


@pytest.mark.asyncio
async def test_distinct_real_clients_still_get_separate_buckets(fake_supabase):
    """The fix must not collapse every caller behind the proxy into one bucket."""
    async with _client() as c:
        for _ in range(2):
            await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                         headers={"X-Forwarded-For": "10.0.0.1, 203.0.113.7"})
        other = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                             headers={"X-Forwarded-For": "10.0.0.1, 198.51.100.4"})

    assert other.status_code == 200


@pytest.mark.asyncio
async def test_request_is_served_when_the_counter_is_unreadable(fake_supabase, monkeypatch):
    """
    A telemetry-read failure must not 500 the user's request. This was live:
    request_telemetry lacked a service_role grant, so every anonymous call
    raised before inference was attempted.
    """
    async def _boom(*_args, **_kwargs):
        raise RuntimeError("permission denied for table request_telemetry")

    monkeypatch.setattr("app.core.rate_limit.count_recent_by_ip", _boom)

    async with _client() as c:
        r = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"})

    assert r.status_code == 200
