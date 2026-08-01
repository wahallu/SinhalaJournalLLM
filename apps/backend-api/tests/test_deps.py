"""
Auth dependency behaviour. Uses a throwaway FastAPI app so the tests
describe the dependencies themselves, not any particular product route.
"""

import time

import jwt
import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.deps import optional_user, require_admin, require_user
from app.schemas.auth import AuthUser

TEST_SECRET = "test-jwt-secret-not-a-real-one-but-long-enough-to-avoid-warnings"
USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_ID = "22222222-2222-2222-2222-222222222222"


def _token(sub=USER_ID, email="reporter@sinai.lk", **overrides) -> str:
    claims = {
        "sub": sub, "email": email, "aud": "authenticated",
        "exp": int(time.time()) + 3600, "iat": int(time.time()),
    }
    claims.update(overrides)
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture
def app_with_deps():
    app = FastAPI()

    @app.get("/anon")
    async def anon(user: AuthUser | None = Depends(optional_user)):
        return {"user": user.id if user else None}

    @app.get("/private")
    async def private(user: AuthUser = Depends(require_user)):
        return {"user": user.id}

    @app.get("/admin")
    async def admin(user: AuthUser = Depends(require_admin)):
        return {"user": user.id}

    return app


def _client(app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def seed_profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID,  "email": "reporter@sinai.lk", "role": "user",
         "status": "active", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": ADMIN_ID, "email": "boss@sinai.lk", "role": "admin",
         "status": "active", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_optional_user_allows_anonymous(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/anon")
    assert r.status_code == 200
    assert r.json()["user"] is None


@pytest.mark.asyncio
async def test_optional_user_resolves_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/anon", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200
    assert r.json()["user"] == USER_ID


@pytest.mark.asyncio
async def test_require_user_401_without_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/private")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_require_user_401_with_bad_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/private", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_require_user_allows_valid_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/private", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_require_admin_403_for_normal_user(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/admin", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_allows_admin(app_with_deps, seed_profiles):
    token = _token(sub=ADMIN_ID, email="boss@sinai.lk")
    async with _client(app_with_deps) as c:
        r = await c.get("/admin", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_suspended_user_rejected_everywhere(app_with_deps, fake_supabase):
    """A suspended account is 403 on both require_user and optional_user."""
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "reporter@sinai.lk", "role": "user",
         "status": "suspended", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    headers = {"Authorization": f"Bearer {_token()}"}
    async with _client(app_with_deps) as c:
        assert (await c.get("/private", headers=headers)).status_code == 403
        assert (await c.get("/anon", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_valid_token_without_profile_is_401(app_with_deps, fake_supabase):
    """A token whose profile row is gone must not authenticate."""
    fake_supabase.store["profiles"] = []
    async with _client(app_with_deps) as c:
        r = await c.get("/private", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 401
