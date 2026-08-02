"""
Admin Chats view: every user's tool runs in one feed, with token usage.

Reads the four history tables directly rather than request_telemetry —
telemetry has the token columns but no text, and there is no key joining a
telemetry row to the history row it describes, so tokens are stored on both.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from test_user_scoping import TEST_SECRET, _auth

_ADMIN = "77777777-7777-7777-7777-777777777777"
_ALICE = "88888888-8888-8888-8888-888888888888"
_BOB = "99999999-9999-9999-9999-999999999999"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture
def _seeded(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": _ADMIN, "email": "admin@sinai.lk", "role": "admin", "status": "active"},
        {"id": _ALICE, "email": "alice@sinai.lk", "role": "user", "status": "active"},
        {"id": _BOB, "email": "bob@sinai.lk", "role": "user", "status": "active"},
    ]
    fake_supabase.store["grammar_corrections"] = [
        {
            "id": "g1", "user_id": _ALICE, "original_text": "වැරදි පෙළ",
            "corrected_text": "නිවැරදි පෙළ", "correction_count": 1,
            "model_provider": "sinllama", "latency_ms": 120,
            "input_tokens": 12, "output_tokens": 5,
            "created_at": "2026-08-02T10:00:00Z",
        },
    ]
    fake_supabase.store["summaries"] = [
        {
            "id": "s1", "user_id": _BOB, "original_text": "දිගු ලිපිය",
            "summary_text": "කෙටි සාරාංශය", "length": "short",
            "model_provider": "mock", "latency_ms": 40,
            "input_tokens": None, "output_tokens": None,
            "created_at": "2026-08-02T11:00:00Z",
        },
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_chats_requires_admin(_seeded):
    async with _client() as c:
        anon = await c.get("/api/v1/admin/activity/chats")
        as_user = await c.get("/api/v1/admin/activity/chats", headers=_auth(_ALICE))
    assert anon.status_code == 401
    assert as_user.status_code == 403


@pytest.mark.asyncio
async def test_chats_returns_every_users_runs_newest_first(_seeded):
    async with _client() as c:
        response = await c.get("/api/v1/admin/activity/chats", headers=_auth(_ADMIN))

    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["tool"] for i in items] == ["summarizer", "grammar"]  # newest first
    assert {i["user_email"] for i in items} == {"alice@sinai.lk", "bob@sinai.lk"}


@pytest.mark.asyncio
async def test_chats_carry_token_usage(_seeded):
    async with _client() as c:
        response = await c.get("/api/v1/admin/activity/chats", headers=_auth(_ADMIN))

    items = {i["tool"]: i for i in response.json()["items"]}
    assert items["grammar"]["input_tokens"] == 12
    assert items["grammar"]["output_tokens"] == 5
    assert items["grammar"]["total_tokens"] == 17


@pytest.mark.asyncio
async def test_unreported_tokens_stay_null(_seeded):
    """A mock/openrouter run reported nothing; that must not read as 0."""
    async with _client() as c:
        response = await c.get("/api/v1/admin/activity/chats", headers=_auth(_ADMIN))

    items = {i["tool"]: i for i in response.json()["items"]}
    assert items["summarizer"]["input_tokens"] is None
    assert items["summarizer"]["total_tokens"] is None


@pytest.mark.asyncio
async def test_chats_include_content_previews(_seeded):
    async with _client() as c:
        response = await c.get("/api/v1/admin/activity/chats", headers=_auth(_ADMIN))

    items = {i["tool"]: i for i in response.json()["items"]}
    assert items["grammar"]["input_preview"] == "වැරදි පෙළ"
    assert items["grammar"]["output_preview"] == "නිවැරදි පෙළ"


@pytest.mark.asyncio
async def test_totals_summarize_the_page(_seeded):
    async with _client() as c:
        response = await c.get("/api/v1/admin/activity/chats", headers=_auth(_ADMIN))

    body = response.json()
    assert body["total"] == 2
    # Only the sinllama run reported usage.
    assert body["total_tokens"] == 17
