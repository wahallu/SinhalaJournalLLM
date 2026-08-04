"""
Analytics and activity endpoints.

Authorization is covered by the route-enumerating test in test_admin_auth.py;
this file covers the aggregation itself.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.test_admin_auth import ADMIN_ID, TEST_SECRET, USER_ID, _auth


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()




@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


def _seed_raw(fake_supabase, rows):
    fake_supabase.store["request_telemetry"] = rows


@pytest.mark.asyncio
async def test_series_has_an_entry_for_every_day_including_empty_ones(fake_supabase):
    """A day with no traffic must render as zero, not vanish from the line."""
    _seed_raw(fake_supabase, [
        {"id": "t1", "user_id": USER_ID, "tool": "summarizer", "provider": "mock",
         "status_code": 200, "latency_ms": 10, "created_at": _iso(0)},
    ])
    async with _client() as c:
        r = await c.get("/api/v1/admin/analytics?days=7", headers=_auth(ADMIN_ID))

    body = r.json()
    assert len(body["series"]) == 7
    assert sum(d["requests"] for d in body["series"]) == 1
    assert all("requests" in d and "errors" in d for d in body["series"])


@pytest.mark.asyncio
async def test_tool_and_provider_breakdowns(fake_supabase):
    _seed_raw(fake_supabase, [
        {"id": "a", "user_id": USER_ID, "tool": "summarizer", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
        {"id": "b", "user_id": USER_ID, "tool": "summarizer", "provider": "mock",
         "status_code": 200, "created_at": _iso(1)},
        {"id": "c", "user_id": None, "tool": "grammar", "provider": "openrouter",
         "status_code": 500, "created_at": _iso(1)},
    ])
    async with _client() as c:
        r = await c.get("/api/v1/admin/analytics?days=7", headers=_auth(ADMIN_ID))

    body = r.json()
    assert body["by_tool"] == {"summarizer": 2, "grammar": 1}
    assert body["by_provider"] == {"mock": 2, "openrouter": 1}
    assert sum(d["errors"] for d in body["series"]) == 1


@pytest.mark.asyncio
async def test_rollup_is_preferred_when_present(fake_supabase):
    """With rolled-up rows available, the raw table must not be scanned."""
    fake_supabase.store["usage_daily"] = [
        {"id": "r1", "day": datetime.now(timezone.utc).date().isoformat(),
         "user_id": USER_ID, "tool": "summarizer", "provider": "mock",
         "request_count": 42, "error_count": 2},
    ]
    _seed_raw(fake_supabase, [
        {"id": "ignored", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
    ])
    async with _client() as c:
        r = await c.get("/api/v1/admin/analytics?days=7", headers=_auth(ADMIN_ID))

    body = r.json()
    assert body["source"] == "usage_daily"
    assert body["by_tool"] == {"summarizer": 42}


@pytest.mark.asyncio
async def test_falls_back_to_raw_before_the_first_rollup(fake_supabase):
    """A fresh install must show real numbers, not empty charts."""
    _seed_raw(fake_supabase, [
        {"id": "a", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
    ])
    async with _client() as c:
        r = await c.get("/api/v1/admin/analytics?days=7", headers=_auth(ADMIN_ID))

    assert r.json()["source"] == "request_telemetry"


@pytest.mark.asyncio
async def test_anonymous_traffic_excluded_from_top_users(fake_supabase):
    _seed_raw(fake_supabase, [
        {"id": "a", "user_id": None, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
        {"id": "b", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "created_at": _iso(0)},
    ])
    async with _client() as c:
        r = await c.get("/api/v1/admin/analytics?days=7", headers=_auth(ADMIN_ID))

    top = r.json()["top_users"]
    assert [u["user_id"] for u in top] == [USER_ID]


@pytest.mark.asyncio
async def test_days_is_clamped():
    async with _client() as c:
        assert (await c.get("/api/v1/admin/analytics?days=9999",
                            headers=_auth(ADMIN_ID))).status_code == 422
        assert (await c.get("/api/v1/admin/analytics?days=0",
                            headers=_auth(ADMIN_ID))).status_code == 422


@pytest.mark.asyncio
async def test_audit_log_is_paginated_and_newest_first(fake_supabase):
    fake_supabase.store["audit_log"] = [
        {"id": "1", "actor_id": ADMIN_ID, "actor_email": "admin@sinai.lk",
         "action": "user.update", "target_type": "user", "target_id": USER_ID,
         "before": {"role": "user"}, "after": {"role": "admin"},
         "ip_hash": "abc", "created_at": _iso(2)},
        {"id": "2", "actor_id": ADMIN_ID, "actor_email": "admin@sinai.lk",
         "action": "setting.update", "target_type": "setting",
         "target_id": "features.grammar", "before": {}, "after": {},
         "ip_hash": "abc", "created_at": _iso(1)},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/admin/activity/audit", headers=_auth(ADMIN_ID))

    body = r.json()
    assert body["total"] == 2
    assert body["items"][0]["action"] == "setting.update"  # newest first


@pytest.mark.asyncio
async def test_telemetry_filters_by_tool(fake_supabase):
    _seed_raw(fake_supabase, [
        {"id": "a", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "ip_hash": "h", "created_at": _iso(0)},
        {"id": "b", "user_id": USER_ID, "tool": "summarizer", "provider": "mock",
         "status_code": 200, "ip_hash": "h", "created_at": _iso(0)},
    ])
    async with _client() as c:
        r = await c.get("/api/v1/admin/activity/telemetry?tool=grammar",
                        headers=_auth(ADMIN_ID))

    assert [i["tool"] for i in r.json()["items"]] == ["grammar"]


@pytest.mark.asyncio
async def test_no_endpoint_returns_a_raw_ip(fake_supabase):
    """Only the salted hash is ever stored or surfaced."""
    _seed_raw(fake_supabase, [
        {"id": "a", "user_id": USER_ID, "tool": "grammar", "provider": "mock",
         "status_code": 200, "ip_hash": "deadbeef", "created_at": _iso(0)},
    ])
    async with _client() as c:
        telemetry = await c.get("/api/v1/admin/activity/telemetry", headers=_auth(ADMIN_ID))
        audit = await c.get("/api/v1/admin/activity/audit", headers=_auth(ADMIN_ID))

    for response in (telemetry, audit):
        assert '"ip"' not in response.text
        assert "ip_address" not in response.text
