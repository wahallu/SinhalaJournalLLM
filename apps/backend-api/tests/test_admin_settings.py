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
def _secret(monkeypatch):
    from app.core import auth as auth_module

    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


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
