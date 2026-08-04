"""
Per-user history isolation.

Two guarantees are asserted here:
  1. anonymous tool calls still work (the Chrome extension and Docs add-on
     depend on this) and are NOT persisted;
  2. an authenticated call is persisted against that user and is invisible
     to everyone else.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app

# Kept as a module-level name because most other test modules import it, but
# it no longer configures anything: tokens are minted by the application's
# own issuer now (core/security), signed with the JWT_SECRET that
# conftest sets for the whole suite. Before self-hosted auth this file hand-
# rolled Supabase-shaped JWTs and monkeypatched auth._jwt_secret to match.
TEST_SECRET = "test-only-signing-key-not-used-anywhere-real"
USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"

_ARTICLE = (
    "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් විශිෂ්ට ජයග්‍රහණයක් වාර්තා කළේය. "
    "මෙම ජයග්‍රහණයත් සමඟ ඔවුන් තරඟාවලියේ පෙරමුණ ගැනීමට සමත් විය."
)


def _token(sub: str) -> str:
    """A real access token from the application's own issuer, so these
    tests exercise the same verification path production does."""
    return security.create_access_token(sub)


def _auth(sub: str) -> dict:
    return {"Authorization": f"Bearer {_token(sub)}"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_A, "email": "a@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_B, "email": "b@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_anonymous_summarize_still_works(fake_supabase):
    """No Authorization header must still return 200 — extension depends on it."""
    async with _client() as c:
        r = await c.post("/api/v1/summarize", json={"text": _ARTICLE, "length": "short"})
    assert r.status_code == 200
    assert r.json()["summary"]


@pytest.mark.asyncio
async def test_anonymous_result_is_not_persisted(fake_supabase):
    """'Login to save' means anonymous runs leave no row."""
    async with _client() as c:
        await c.post("/api/v1/summarize", json={"text": _ARTICLE, "length": "short"})
    assert fake_supabase.store.get("summaries", []) == []


@pytest.mark.asyncio
async def test_authenticated_result_is_persisted_with_user_id(fake_supabase):
    async with _client() as c:
        r = await c.post(
            "/api/v1/summarize",
            json={"text": _ARTICLE, "length": "short"},
            headers=_auth(USER_A),
        )
    assert r.status_code == 200
    rows = fake_supabase.store["summaries"]
    assert len(rows) == 1
    assert rows[0]["user_id"] == USER_A


@pytest.mark.asyncio
async def test_history_is_isolated_between_users(fake_supabase):
    async with _client() as c:
        await c.post("/api/v1/summarize",
                     json={"text": _ARTICLE, "length": "short"}, headers=_auth(USER_A))
        await c.post("/api/v1/summarize",
                     json={"text": _ARTICLE, "length": "short"}, headers=_auth(USER_B))

        a = await c.get("/api/v1/summarize/history", headers=_auth(USER_A))
        b = await c.get("/api/v1/summarize/history", headers=_auth(USER_B))

    assert a.json()["total"] == 1
    assert b.json()["total"] == 1
    assert a.json()["items"][0]["id"] != b.json()["items"][0]["id"]


@pytest.mark.asyncio
async def test_history_requires_auth(fake_supabase):
    async with _client() as c:
        r = await c.get("/api/v1/summarize/history")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unified_history_requires_auth(fake_supabase):
    async with _client() as c:
        r = await c.get("/api/v1/history")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_legacy_rows_invisible_to_users(fake_supabase):
    """Pre-auth rows (user_id NULL) must not appear in anyone's history."""
    fake_supabase.store["summaries"] = [
        {"id": "legacy", "user_id": None, "original_text": "old", "summary_text": "old",
         "length": "short", "created_at": "2025-01-01T00:00:00Z"},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/summarize/history", headers=_auth(USER_A))
    assert r.json()["total"] == 0


@pytest.mark.asyncio
async def test_unified_history_is_isolated_between_users(fake_supabase):
    """
    The unified feed must not leak across users.

    This covers a different code path from the per-tool history tests above:
    /api/v1/history goes through list_recent -> fetch_recent, while
    /summarize/history goes through fetch_page. A filter dropped from
    fetch_recent alone would leak every user's activity here with no other
    test failing.
    """
    async with _client() as c:
        await c.post("/api/v1/summarize",
                     json={"text": _ARTICLE, "length": "short"}, headers=_auth(USER_A))
        await c.post("/api/v1/grammar/check",
                     json={"text": _ARTICLE}, headers=_auth(USER_B))

        a = await c.get("/api/v1/history", headers=_auth(USER_A))
        b = await c.get("/api/v1/history", headers=_auth(USER_B))

    a_tools = [item["tool"] for item in a.json()["items"]]
    b_tools = [item["tool"] for item in b.json()["items"]]

    assert a_tools == ["summarizer"], f"user A saw {a_tools}"
    assert b_tools == ["grammar"], f"user B saw {b_tools}"


@pytest.mark.parametrize("endpoint", [
    "/api/v1/history",
    "/api/v1/summarize/history",
    "/api/v1/grammar/history",
    "/api/v1/headlines/history",
    "/api/v1/rewrite/history",
])
@pytest.mark.asyncio
async def test_each_history_read_uses_the_caller_scoped_client(
    fake_supabase, monkeypatch, endpoint
):
    """
    Every user-facing history read must go through the RLS-enforcing client,
    not the service-role one.

    Parametrized per endpoint on purpose: asserting across all of them at once
    would still pass when a single route quietly reverted to the service-role
    client, because the others would keep the assertion satisfied.

    The service-role client bypasses Row Level Security entirely, so such a
    revert loses the database-level guarantee while every filtering test keeps
    passing — the explicit filters would simply be doing all the work.
    """
    seen_tokens = []

    async def _spy(jwt: str):
        seen_tokens.append(jwt)
        return fake_supabase

    monkeypatch.setattr("app.core.user_client.user_postgrest", _spy)

    async with _client() as c:
        response = await c.get(endpoint, headers=_auth(USER_A))

    assert response.status_code == 200
    assert seen_tokens, f"{endpoint} did not build a caller-scoped client"
    assert all(t == _token(USER_A) for t in seen_tokens)


@pytest.mark.asyncio
async def test_detail_by_id_is_scoped_to_its_owner(fake_supabase):
    """
    Regression: GET /grammar/{id} originally had no auth dependency and no
    owner filter, so any caller could read any user's correction by id
    (IDOR). Another user's record must read as not-found — 404 rather than
    403, so the response does not confirm the id exists.
    """
    async with _client() as c:
        created = await c.post("/api/v1/grammar/check", json={"text": _ARTICLE},
                               headers=_auth(USER_A))
        record_id = created.json()["id"]

        as_owner = await c.get(f"/api/v1/grammar/{record_id}", headers=_auth(USER_A))
        as_other = await c.get(f"/api/v1/grammar/{record_id}", headers=_auth(USER_B))
        as_anon = await c.get(f"/api/v1/grammar/{record_id}")

    assert as_owner.status_code == 200
    assert as_other.status_code == 404
    assert as_anon.status_code == 401


@pytest.mark.asyncio
async def test_legacy_null_owner_row_is_not_readable_by_id(fake_supabase):
    """Pre-auth rows must not be reachable by guessing or replaying an id."""
    legacy_id = "aaaaaaaa-0000-0000-0000-000000000001"
    fake_supabase.store["grammar_corrections"] = [{
        "id": legacy_id, "user_id": None,
        "original_text": "legacy", "corrected_text": "legacy fixed",
        "corrections": [], "correction_count": 0,
        "created_at": "2025-01-01T00:00:00Z",
    }]
    async with _client() as c:
        anon = await c.get(f"/api/v1/grammar/{legacy_id}")
        signed_in = await c.get(f"/api/v1/grammar/{legacy_id}", headers=_auth(USER_A))

    assert anon.status_code == 401
    assert signed_in.status_code == 404
