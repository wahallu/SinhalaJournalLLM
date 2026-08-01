"""
Admin category CRUD behaviour.

Authorization is covered in test_admin_auth.py; this file covers what the
endpoints do once a legitimate admin is through the gate.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.test_admin_auth import ADMIN_ID, TEST_SECRET, USER_ID, _auth

CATEGORY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module

    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture(autouse=True)
def _seed(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    fake_supabase.store["user_categories"] = [
        {"id": CATEGORY_ID, "name": "Journalist", "slug": "journalist",
         "description": "Working newsroom journalist", "is_active": True,
         "sort_order": 1, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_list_categories():
    async with _client() as c:
        r = await c.get("/api/v1/admin/categories", headers=_auth(ADMIN_ID))
    assert r.status_code == 200
    assert [c_["slug"] for c_ in r.json()] == ["journalist"]


@pytest.mark.asyncio
async def test_create_category(fake_supabase):
    async with _client() as c:
        r = await c.post(
            "/api/v1/admin/categories",
            json={"name": "Student", "slug": "student", "description": "Media student",
                  "is_active": True, "sort_order": 2},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 201
    assert r.json()["slug"] == "student"
    assert len(fake_supabase.store["user_categories"]) == 2


@pytest.mark.asyncio
async def test_create_writes_audit_row(fake_supabase):
    async with _client() as c:
        await c.post(
            "/api/v1/admin/categories",
            json={"name": "Student", "slug": "student"},
            headers=_auth(ADMIN_ID),
        )
    entry = fake_supabase.store["audit_log"][0]
    assert entry["action"] == "category.create"
    assert entry["after"]["slug"] == "student"
    assert entry["actor_email"] == "admin@sinai.lk"


@pytest.mark.asyncio
async def test_update_category_records_before_and_after(fake_supabase):
    async with _client() as c:
        r = await c.patch(
            f"/api/v1/admin/categories/{CATEGORY_ID}",
            json={"name": "Reporter", "slug": "reporter", "is_active": False, "sort_order": 5},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 200
    assert r.json()["slug"] == "reporter"

    entry = fake_supabase.store["audit_log"][0]
    assert entry["action"] == "category.update"
    assert entry["before"]["slug"] == "journalist"
    assert entry["after"]["slug"] == "reporter"


@pytest.mark.asyncio
async def test_delete_category(fake_supabase):
    async with _client() as c:
        r = await c.delete(f"/api/v1/admin/categories/{CATEGORY_ID}", headers=_auth(ADMIN_ID))
    assert r.status_code == 204
    assert fake_supabase.store["user_categories"] == []

    entry = fake_supabase.store["audit_log"][0]
    assert entry["action"] == "category.delete"
    assert entry["before"]["slug"] == "journalist"


@pytest.mark.asyncio
async def test_delete_unknown_category_is_404():
    async with _client() as c:
        r = await c.delete("/api/v1/admin/categories/99999999-9999-9999-9999-999999999999",
                           headers=_auth(ADMIN_ID))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_unknown_category_is_404():
    async with _client() as c:
        r = await c.patch("/api/v1/admin/categories/99999999-9999-9999-9999-999999999999",
                          json={"name": "X", "slug": "x"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_invalid_slug_is_rejected():
    """Slugs are used in URLs and comparisons; the pattern is enforced server-side."""
    async with _client() as c:
        r = await c.post("/api/v1/admin/categories",
                         json={"name": "Bad", "slug": "Not A Slug!"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_empty_name_is_rejected():
    async with _client() as c:
        r = await c.post("/api/v1/admin/categories",
                         json={"name": "", "slug": "ok"}, headers=_auth(ADMIN_ID))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_user_category_list_excludes_inactive(fake_supabase):
    """The user-facing list must not offer a category an admin retired."""
    fake_supabase.store["user_categories"].append(
        {"id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "name": "Retired", "slug": "retired",
         "description": None, "is_active": False, "sort_order": 9,
         "created_at": "2026-01-01T00:00:00Z"}
    )
    async with _client() as c:
        r = await c.get("/api/v1/categories", headers=_auth(USER_ID))

    assert r.status_code == 200
    assert [c_["slug"] for c_ in r.json()] == ["journalist"]


@pytest.mark.asyncio
async def test_user_category_list_requires_auth():
    async with _client() as c:
        r = await c.get("/api/v1/categories")
    assert r.status_code == 401
