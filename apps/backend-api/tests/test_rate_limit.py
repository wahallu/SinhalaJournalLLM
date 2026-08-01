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
