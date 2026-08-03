"""
Admin user management behaviour.

Authorization is covered in test_admin_auth.py; this file covers what the
endpoints actually do once a legitimate admin is through the gate.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.test_admin_auth import ADMIN_ID, TEST_SECRET, USER_ID, _auth

OTHER_ID = "33333333-3333-3333-3333-333333333333"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")




@pytest.fixture(autouse=True)
def _seed(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "reporter@sinai.lk", "full_name": "Nimal Perera",
         "role": "user", "status": "active", "category_id": None,
         "created_at": "2026-01-02T00:00:00Z"},
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "full_name": "Site Admin",
         "role": "admin", "status": "active", "category_id": None,
         "created_at": "2026-01-01T00:00:00Z"},
        {"id": OTHER_ID, "email": "editor@example.com", "full_name": "Kamala Silva",
         "role": "user", "status": "suspended", "category_id": None,
         "created_at": "2026-01-03T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_list_returns_every_user():
    async with _client() as c:
        r = await c.get("/api/v1/admin/users", headers=_auth(ADMIN_ID))
    body = r.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3


@pytest.mark.asyncio
async def test_search_filters_by_email_substring():
    async with _client() as c:
        r = await c.get("/api/v1/admin/users?search=example.com", headers=_auth(ADMIN_ID))
    emails = [u["email"] for u in r.json()["items"]]
    assert emails == ["editor@example.com"]


@pytest.mark.asyncio
async def test_search_also_matches_full_name():
    async with _client() as c:
        r = await c.get("/api/v1/admin/users?search=Nimal", headers=_auth(ADMIN_ID))
    assert [u["email"] for u in r.json()["items"]] == ["reporter@sinai.lk"]


@pytest.mark.asyncio
async def test_filter_by_role():
    async with _client() as c:
        r = await c.get("/api/v1/admin/users?role=admin", headers=_auth(ADMIN_ID))
    assert [u["id"] for u in r.json()["items"]] == [ADMIN_ID]


@pytest.mark.asyncio
async def test_filter_by_status():
    async with _client() as c:
        r = await c.get("/api/v1/admin/users?status=suspended", headers=_auth(ADMIN_ID))
    assert [u["id"] for u in r.json()["items"]] == [OTHER_ID]


@pytest.mark.asyncio
async def test_promote_user_to_admin(fake_supabase):
    async with _client() as c:
        r = await c.patch(f"/api/v1/admin/users/{USER_ID}",
                          json={"role": "admin"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    stored = [u for u in fake_supabase.store["profiles"] if u["id"] == USER_ID][0]
    assert stored["role"] == "admin"


@pytest.mark.asyncio
async def test_update_writes_audit_row_with_before_and_after(fake_supabase):
    async with _client() as c:
        await c.patch(f"/api/v1/admin/users/{USER_ID}",
                      json={"status": "suspended"}, headers=_auth(ADMIN_ID))

    entries = fake_supabase.store["audit_log"]
    assert len(entries) == 1
    entry = entries[0]
    assert entry["action"] == "user.update"
    assert entry["target_id"] == USER_ID
    assert entry["actor_email"] == "admin@sinai.lk"
    assert entry["before"] == {"status": "active"}
    assert entry["after"] == {"status": "suspended"}
    # The raw IP must never be stored — only its salted hash.
    assert entry["ip_hash"] and "." not in entry["ip_hash"]


@pytest.mark.asyncio
async def test_admin_cannot_demote_themselves():
    async with _client() as c:
        r = await c.patch(f"/api/v1/admin/users/{ADMIN_ID}",
                          json={"role": "user"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 400
    assert "own administrator role" in r.json()["detail"]


@pytest.mark.asyncio
async def test_admin_cannot_suspend_themselves():
    async with _client() as c:
        r = await c.patch(f"/api/v1/admin/users/{ADMIN_ID}",
                          json={"status": "suspended"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_self_lockout_guard_leaves_state_untouched(fake_supabase):
    """A rejected self-demotion must not write a partial change or an audit row."""
    async with _client() as c:
        await c.patch(f"/api/v1/admin/users/{ADMIN_ID}",
                      json={"role": "user"}, headers=_auth(ADMIN_ID))

    stored = [u for u in fake_supabase.store["profiles"] if u["id"] == ADMIN_ID][0]
    assert stored["role"] == "admin"
    assert fake_supabase.store.get("audit_log", []) == []


@pytest.mark.asyncio
async def test_update_unknown_user_is_404():
    async with _client() as c:
        r = await c.patch("/api/v1/admin/users/99999999-9999-9999-9999-999999999999",
                          json={"role": "admin"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_invalid_role_value_is_rejected():
    async with _client() as c:
        r = await c.patch(f"/api/v1/admin/users/{USER_ID}",
                          json={"role": "superuser"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_admin_sees_a_specific_users_history(fake_supabase):
    """The history endpoint returns the target user's rows, not the admin's."""
    fake_supabase.store["summaries"] = [
        {"id": "s1", "user_id": USER_ID, "original_text": "theirs",
         "summary_text": "theirs", "length": "short", "created_at": "2026-01-05T00:00:00Z"},
        {"id": "s2", "user_id": ADMIN_ID, "original_text": "mine",
         "summary_text": "mine", "length": "short", "created_at": "2026-01-06T00:00:00Z"},
    ]
    async with _client() as c:
        r = await c.get(f"/api/v1/admin/users/{USER_ID}/history", headers=_auth(ADMIN_ID))

    previews = [item["output_preview"] for item in r.json()["items"]]
    assert previews == ["theirs"]
