"""
Feature flags: an admin can take a tool offline without a redeploy.

A disabled tool refuses new work but keeps its history readable — a user who
already produced results should not lose access to them because an operator
turned the generator off.
"""


import pytest

from app.core import security
from httpx import ASGITransport, AsyncClient

from app.core import runtime_settings
from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one-padded-out-to-sixty-four-chars!!"
USER_ID = "11111111-1111-1111-1111-111111111111"

_TEXT = "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් ජයග්‍රහණයක් වාර්තා කළේය."


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth() -> dict:
    return {"Authorization": f"Bearer {security.create_access_token(USER_ID)}"}




@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


def _disable(fake_supabase, key: str) -> None:
    """Turn one feature off, keeping the offline provider seed intact."""
    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "mock", "updated_at": "2026-01-01T00:00:00Z"},
        {"key": "model.fallback_enabled", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
        {"key": key, "value": False, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()


@pytest.mark.asyncio
async def test_disabled_tool_returns_503(fake_supabase):
    _disable(fake_supabase, "features.summarizer")
    async with _client() as c:
        r = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"})
    assert r.status_code == 503
    assert "unavailable" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_disabling_one_tool_leaves_the_others_working(fake_supabase):
    _disable(fake_supabase, "features.summarizer")
    async with _client() as c:
        assert (await c.post("/api/v1/grammar/check", json={"text": _TEXT})).status_code == 200
        assert (
            await c.post("/api/v1/headlines/generate", json={"text": _TEXT, "count": 2})
        ).status_code == 200
        assert (
            await c.post("/api/v1/rewrite", json={"text": _TEXT, "tone": "formal"})
        ).status_code == 200


@pytest.mark.asyncio
async def test_history_stays_readable_when_a_tool_is_disabled(fake_supabase):
    """
    Turning off the generator must not hide work a user already produced.
    """
    async with _client() as c:
        await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                     headers=_auth())

        _disable(fake_supabase, "features.summarizer")

        blocked = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                               headers=_auth())
        history = await c.get("/api/v1/summarize/history", headers=_auth())

    assert blocked.status_code == 503
    assert history.status_code == 200
    assert history.json()["total"] == 1


@pytest.mark.asyncio
async def test_all_tools_enabled_by_default(fake_supabase):
    async with _client() as c:
        r = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_meta_reports_feature_flags(fake_supabase):
    """The frontend hides disabled tools rather than letting users hit a 503."""
    _disable(fake_supabase, "features.rewriter")
    async with _client() as c:
        r = await c.get("/api/v1/meta")

    features = r.json()["features"]
    assert features["rewriter"] is False
    assert features["grammar"] is True


@pytest.mark.asyncio
async def test_meta_reports_global_defaults(fake_supabase):
    async with _client() as c:
        r = await c.get("/api/v1/meta")

    defaults = r.json()["defaults"]
    assert defaults["headline_count"] == 5
    assert defaults["length"] == "short"
