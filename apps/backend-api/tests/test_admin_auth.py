"""
Authorization gate for the admin API.

Every admin route must reject anonymous callers with 401 and non-admin
callers with 403. The route list is enumerated from the app itself rather
than hardcoded, so a route added later without `require_admin` fails here
instead of shipping an authorization bypass.
"""


import pytest

from app.core import security
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one-padded-out-to-sixty-four-chars!!"
USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_ID = "22222222-2222-2222-2222-222222222222"


def _token(sub: str) -> str:
    return security.create_access_token(sub)


def _auth(sub: str) -> dict:
    return {"Authorization": f"Bearer {_token(sub)}"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")




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


def _fill(path: str) -> str:
    return (
        path.replace("{user_id}", USER_ID)
        .replace("{category_id}", "c1")
        .replace("{key}", "features.grammar")
    )


def _admin_routes() -> list[tuple[str, str]]:
    """
    Every registered admin route as (method, path), params filled in.

    All verbs, not just GET. An earlier version enumerated GET only and
    relied on a hardcoded list for the rest — which already missed
    PATCH /admin/categories/{category_id}, so a mutation added without
    require_admin would have shipped silently.

    Read from the OpenAPI schema rather than app.routes: the schema is the
    authoritative list of what is reachable, regardless of router nesting.
    """
    routes = []
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith("/api/v1/admin"):
            continue
        for method in operations:
            if method.lower() in {"get", "post", "patch", "put", "delete"}:
                routes.append((method.lower(), _fill(path)))
    return sorted(routes)


def _admin_get_routes() -> list[str]:
    return sorted(path for method, path in _admin_routes() if method == "get")


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
async def test_every_admin_route_rejects_anonymous_on_every_verb():
    """Enumerated across all verbs, so a new mutation cannot slip through."""
    async with _client() as c:
        for method, path in _admin_routes():
            response = await c.request(method.upper(), path, json={})
            assert response.status_code == 401, (
                f"{method.upper()} {path} gave {response.status_code} to anonymous"
            )


@pytest.mark.asyncio
async def test_every_admin_route_rejects_non_admin_on_every_verb():
    async with _client() as c:
        for method, path in _admin_routes():
            response = await c.request(method.upper(), path, json={},
                                       headers=_auth(USER_ID))
            assert response.status_code == 403, (
                f"{method.upper()} {path} gave {response.status_code} to a user"
            )


def test_all_verbs_are_covered():
    """Guards against the enumeration silently narrowing to GET again."""
    verbs = {method for method, _ in _admin_routes()}
    assert {"get", "patch", "post", "delete"} <= verbs, verbs


@pytest.mark.asyncio
async def test_suspended_admin_is_rejected(fake_supabase):
    """Suspension outranks the admin role."""
    for row in fake_supabase.store["profiles"]:
        if row["id"] == ADMIN_ID:
            row["status"] = "suspended"

    async with _client() as c:
        response = await c.get("/api/v1/admin/overview", headers=_auth(ADMIN_ID))

    assert response.status_code == 403
