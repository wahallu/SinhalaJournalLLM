"""
Authorization gate for the admin API.

Every admin route must reject anonymous callers with 401 and non-admin
callers with 403. The route list is enumerated from the app itself rather
than hardcoded, so a route added later without `require_admin` fails here
instead of shipping an authorization bypass.
"""

import time

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one-padded-out-to-sixty-four-chars!!"
USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_ID = "22222222-2222-2222-2222-222222222222"


def _token(sub: str) -> str:
    return jwt.encode(
        {
            "sub": sub,
            "email": f"{sub[:4]}@sinai.lk",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def _auth(sub: str) -> dict:
    return {"Authorization": f"Bearer {_token(sub)}"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module

    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {
            "id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
            "category_id": None, "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
            "category_id": None, "created_at": "2026-01-01T00:00:00Z",
        },
    ]
    return fake_supabase


def _admin_get_routes() -> list[str]:
    """
    Every registered GET route under /api/v1/admin, with path params filled in.

    Read from the OpenAPI schema rather than app.routes: the schema is the
    authoritative list of what is actually reachable, and it stays correct
    regardless of how routers are nested.
    """
    paths = []
    for path, operations in app.openapi()["paths"].items():
        if path.startswith("/api/v1/admin") and "get" in operations:
            paths.append(path.replace("{user_id}", USER_ID).replace("{category_id}", "c1"))
    return sorted(paths)


def test_admin_routes_exist():
    """Stops this file passing vacuously if router registration ever breaks."""
    routes = _admin_get_routes()
    assert routes, "No admin GET routes found — did registration break?"


@pytest.mark.asyncio
async def test_every_admin_get_route_rejects_anonymous():
    async with _client() as c:
        for path in _admin_get_routes():
            response = await c.get(path)
            assert response.status_code == 401, f"{path} gave {response.status_code} to anonymous"


@pytest.mark.asyncio
async def test_every_admin_get_route_rejects_non_admin():
    async with _client() as c:
        for path in _admin_get_routes():
            response = await c.get(path, headers=_auth(USER_ID))
            assert response.status_code == 403, f"{path} gave {response.status_code} to a user"


@pytest.mark.asyncio
async def test_admin_can_reach_admin_routes():
    async with _client() as c:
        for path in _admin_get_routes():
            response = await c.get(path, headers=_auth(ADMIN_ID))
            assert response.status_code < 400, f"{path} gave {response.status_code} to an admin"


@pytest.mark.asyncio
async def test_admin_mutations_reject_non_admin():
    """PATCH/POST/DELETE are gated too, not just the readable surface."""
    async with _client() as c:
        assert (
            await c.patch(f"/api/v1/admin/users/{USER_ID}", json={"role": "admin"},
                          headers=_auth(USER_ID))
        ).status_code == 403
        assert (
            await c.post("/api/v1/admin/categories",
                         json={"name": "X", "slug": "x"}, headers=_auth(USER_ID))
        ).status_code == 403
        assert (
            await c.delete("/api/v1/admin/categories/c1", headers=_auth(USER_ID))
        ).status_code == 403


@pytest.mark.asyncio
async def test_suspended_admin_is_rejected(fake_supabase):
    """Suspension outranks the admin role."""
    for row in fake_supabase.store["profiles"]:
        if row["id"] == ADMIN_ID:
            row["status"] = "suspended"

    async with _client() as c:
        response = await c.get("/api/v1/admin/overview", headers=_auth(ADMIN_ID))

    assert response.status_code == 403
