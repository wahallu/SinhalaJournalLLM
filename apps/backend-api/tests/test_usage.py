"""
Personal usage — what /profile's Usage tab reads.

Distinct from test_admin_analytics.py, which covers the admin-wide
aggregation. This is one account's own history, scoped by user_id.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.test_admin_auth import TEST_SECRET, USER_ID, _auth

OTHER_ID = "33333333-3333-3333-3333-333333333333"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _day(days_ago: int) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=days_ago)).isoformat()


@pytest.fixture(autouse=True)
def _seed(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "plan_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_requires_a_session():
    async with _client() as c:
        r = await c.get("/api/v1/usage/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_series_covers_90_days_including_empty_ones(fake_supabase):
    """A quiet day must render as zero, not vanish and distort the shape."""
    fake_supabase.store["request_telemetry"] = [
        {"id": "t1", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/usage/me", headers=_auth(USER_ID))
    body = r.json()
    assert len(body["series"]) == 90
    assert body["series"][-1]["day"] == _today()
    assert sum(p["requests"] for p in body["series"]) == 1


@pytest.mark.asyncio
async def test_series_is_scoped_to_the_caller(fake_supabase):
    """Another account's traffic must never appear in this one's history."""
    fake_supabase.store["request_telemetry"] = [
        {"id": "mine", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
        {"id": "theirs", "user_id": OTHER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
        {"id": "anon", "user_id": None, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/usage/me", headers=_auth(USER_ID))
    assert sum(p["requests"] for p in r.json()["series"]) == 1


@pytest.mark.asyncio
async def test_week_and_active_days_are_derived_from_the_last_7(fake_supabase):
    fake_supabase.store["request_telemetry"] = [
        {"id": "a", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
        {"id": "b", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
        {"id": "c", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(2)},
        # Outside the 7-day window — must not count toward week_requests.
        {"id": "d", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(20)},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/usage/me", headers=_auth(USER_ID))
    body = r.json()
    assert body["week_requests"] == 3
    assert body["active_days"] == 2


@pytest.mark.asyncio
async def test_today_reads_live_even_when_the_rollup_has_run(fake_supabase):
    """
    usage_daily is written by a nightly job, so it never has a row for the
    day still in progress. Today must come from request_telemetry regardless
    of which source supplied the older days, or a request made seconds ago
    would show as zero.
    """
    fake_supabase.store["usage_daily"] = [
        {"id": "r1", "day": _day(3), "user_id": USER_ID, "tool": "grammar",
         "provider": "mock", "request_count": 4, "error_count": 0},
    ]
    fake_supabase.store["request_telemetry"] = [
        {"id": "live", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/usage/me", headers=_auth(USER_ID))
    series = {p["day"]: p["requests"] for p in r.json()["series"]}
    assert series[_today()] == 1
    assert series[_day(3)] == 4


@pytest.mark.asyncio
async def test_today_quota_state_is_included(fake_supabase):
    fake_supabase.store["request_telemetry"] = []
    async with _client() as c:
        r = await c.get("/api/v1/usage/me", headers=_auth(USER_ID))
    body = r.json()
    # No plan seeded in this fixture set, so today is None rather than a 500 —
    # matches quota_state()'s own "no catalog yet" behaviour.
    assert body["today"] is None
