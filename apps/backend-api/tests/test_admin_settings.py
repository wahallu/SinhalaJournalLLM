"""
Admin settings endpoint behaviour.

Authorization is covered by the route-enumerating test in test_admin_auth.py;
this file covers validation, persistence, cache invalidation and auditing.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import runtime_settings
from app.main import app
from tests.test_admin_auth import ADMIN_ID, TEST_SECRET, USER_ID, _auth


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")




@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_list_returns_every_registry_key():
    from app.core.settings_registry import REGISTRY

    async with _client() as c:
        r = await c.get("/api/v1/admin/settings", headers=_auth(ADMIN_ID))

    assert r.status_code == 200
    assert {row["key"] for row in r.json()} == set(REGISTRY)


@pytest.mark.asyncio
async def test_list_includes_the_spec_the_ui_needs():
    async with _client() as c:
        r = await c.get("/api/v1/admin/settings", headers=_auth(ADMIN_ID))

    provider = next(row for row in r.json() if row["key"] == "model.provider")
    assert provider["kind"] == "enum"
    assert set(provider["choices"]) == {"sinllama", "openrouter", "mock"}
    assert provider["description"].strip()
    assert provider["group"] == "Model gateway"


@pytest.mark.asyncio
async def test_settings_are_grouped_per_tool_for_the_admin_settings_pages():
    """
    The admin Settings UI is one common page (Model gateway, Limits) plus one
    page per tool, each built by filtering this same list to its own
    group(s) — see web-app's admin/pages/settings/*.jsx. Grammar is the only
    tool with a second, "Advanced" group today.
    """
    async with _client() as c:
        r = await c.get("/api/v1/admin/settings", headers=_auth(ADMIN_ID))

    group_by_key = {row["key"]: row["group"] for row in r.json()}

    assert group_by_key["features.grammar"] == "Grammar"
    assert group_by_key["adapters.grammar"] == "Grammar Advanced"
    assert group_by_key["grammar.ensemble_size"] == "Grammar Advanced"
    assert group_by_key["grammar.chunk_chars"] == "Grammar Advanced"

    assert group_by_key["features.headlines"] == "Headline Generator"
    assert group_by_key["defaults.headline_count"] == "Headline Generator"
    assert group_by_key["adapters.headline"] == "Headline Generator"

    assert group_by_key["features.rewriter"] == "Style Rewriter"
    assert group_by_key["defaults.tone"] == "Style Rewriter"
    assert group_by_key["adapters.style"] == "Style Rewriter"

    assert group_by_key["features.summarizer"] == "News Summarizer"
    assert group_by_key["defaults.length"] == "News Summarizer"
    assert group_by_key["adapters.summarizer"] == "News Summarizer"

    # Common groups stay common — not claimed by any one tool's page.
    assert group_by_key["model.provider"] == "Model gateway"
    assert group_by_key["model.fallback_enabled"] == "Model gateway"
    assert group_by_key["limits.anon_per_hour"] == "Limits"


@pytest.mark.asyncio
async def test_ensemble_size_int_bounds():
    async with _client() as c:
        too_low = await c.patch("/api/v1/admin/settings/grammar.ensemble_size",
                                json={"value": 0}, headers=_auth(ADMIN_ID))
        too_high = await c.patch("/api/v1/admin/settings/grammar.ensemble_size",
                                 json={"value": 6}, headers=_auth(ADMIN_ID))
        ok = await c.patch("/api/v1/admin/settings/grammar.ensemble_size",
                           json={"value": 3}, headers=_auth(ADMIN_ID))

    assert too_low.status_code == 400
    assert too_high.status_code == 400
    assert ok.status_code == 200
    assert ok.json()["value"] == 3


@pytest.mark.asyncio
async def test_update_persists_and_takes_effect(fake_supabase):
    async with _client() as c:
        r = await c.patch("/api/v1/admin/settings/defaults.headline_count",
                          json={"value": 8}, headers=_auth(ADMIN_ID))

    assert r.status_code == 200
    assert r.json()["value"] == 8
    assert r.json()["is_overridden"] is True
    # Cache was invalidated, so the new value is live immediately.
    assert await runtime_settings.get("defaults.headline_count") == 8


@pytest.mark.asyncio
async def test_update_writes_an_audit_row(fake_supabase):
    async with _client() as c:
        await c.patch("/api/v1/admin/settings/features.grammar",
                      json={"value": False}, headers=_auth(ADMIN_ID))

    entry = fake_supabase.store["audit_log"][0]
    assert entry["action"] == "setting.update"
    assert entry["target_id"] == "features.grammar"
    assert entry["before"] == {"features.grammar": True}
    assert entry["after"] == {"features.grammar": False}
    assert entry["actor_email"] == "admin@sinai.lk"


@pytest.mark.asyncio
async def test_unknown_key_is_rejected(fake_supabase):
    """An open key/value endpoint would be arbitrary config injection."""
    async with _client() as c:
        r = await c.patch("/api/v1/admin/settings/model.secret_backdoor",
                          json={"value": "x"}, headers=_auth(ADMIN_ID))

    assert r.status_code == 400
    assert fake_supabase.store.get("app_settings_written") is None


@pytest.mark.asyncio
async def test_invalid_enum_value_is_rejected():
    async with _client() as c:
        r = await c.patch("/api/v1/admin/settings/model.provider",
                          json={"value": "gpt4"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_out_of_range_int_is_rejected():
    async with _client() as c:
        r = await c.patch("/api/v1/admin/settings/limits.anon_per_hour",
                          json={"value": -5}, headers=_auth(ADMIN_ID))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_wrong_type_is_rejected():
    async with _client() as c:
        r = await c.patch("/api/v1/admin/settings/features.grammar",
                          json={"value": "yes"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_no_secret_is_exposed_by_the_api():
    """The settings surface must never carry credentials or service URLs."""
    async with _client() as c:
        r = await c.get("/api/v1/admin/settings", headers=_auth(ADMIN_ID))

    body = r.text.lower()
    for leak in ("service_role", "sk-", "eyj", "ngrok", "supabase.co", "api_key"):
        assert leak not in body, f"settings response leaked {leak!r}"
