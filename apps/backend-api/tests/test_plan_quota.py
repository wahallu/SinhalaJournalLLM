"""
Per-plan daily quota enforcement.

The plan lookup and the telemetry count are both monkeypatched here. That is
deliberate: the logic worth testing is the decision — who is exempt, what
counts as unlimited, what happens when the count fails — and asserting it
through a fake PostgREST query chain would test the fake, not the rule.
"""

import pytest
from fastapi import HTTPException

from app.core import plan_quota
from app.schemas.auth import AuthUser
from app.schemas.plan import PlanLimits, TOOL_NAMES


def _user(role="user", user_id="u-1"):
    return AuthUser(id=user_id, email="a@b.c", role=role, status="active", token="t")


def _fake_count(n):
    async def _count(user_id, since_iso):
        return n
    return _count


def _fake_plan(limits_dict, name="Free", slug="free"):
    async def _resolve(user):
        return {"slug": slug, "name": name}, PlanLimits(**limits_dict)
    return _resolve


@pytest.mark.asyncio
async def test_admin_bypasses_quota(monkeypatch):
    """An admin locked out by a quota they configured cannot undo it."""
    async def _boom(*args, **kwargs):
        raise AssertionError("must not resolve a plan for an admin")
    monkeypatch.setattr(plan_quota, "resolve_plan", _boom)
    await plan_quota.enforce_plan_quota(None, _user(role="admin"), "grammar")


@pytest.mark.asyncio
async def test_anonymous_is_not_checked(monkeypatch):
    """Anonymous traffic is already capped per IP by enforce_anonymous_limit."""
    async def _boom(*args, **kwargs):
        raise AssertionError("must not resolve a plan for an anonymous caller")
    monkeypatch.setattr(plan_quota, "resolve_plan", _boom)
    await plan_quota.enforce_plan_quota(None, None, "grammar")


@pytest.mark.asyncio
async def test_under_limit_passes(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(10))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 50}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_at_limit_raises_429_with_quota_payload(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(50))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 50}))

    with pytest.raises(HTTPException) as excinfo:
        await plan_quota.enforce_plan_quota(None, _user(), "grammar")

    assert excinfo.value.status_code == 429
    quota = excinfo.value.detail["quota"]
    assert quota["used"] == 50
    assert quota["limit"] == 50
    assert quota["plan_name"] == "Free"
    assert "resets_at" in quota
    # The client distinguishes "come back tomorrow" from "needs another plan".
    assert excinfo.value.detail["reason"] == "quota_exceeded"


@pytest.mark.asyncio
async def test_over_limit_also_raises(monkeypatch):
    """A limit lowered below a user's existing usage still blocks."""
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(80))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 50}))
    with pytest.raises(HTTPException) as excinfo:
        await plan_quota.enforce_plan_quota(None, _user(), "grammar")
    assert excinfo.value.status_code == 429


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [None, 0])
async def test_null_and_zero_are_unlimited(monkeypatch, limit):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(10_000))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": limit}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_tool_not_in_plan_raises_403(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(0))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"tools": ["grammar"]}))

    with pytest.raises(HTTPException) as excinfo:
        await plan_quota.enforce_plan_quota(None, _user(), "summarizer")

    assert excinfo.value.status_code == 403
    assert excinfo.value.detail["reason"] == "tool_not_in_plan"


@pytest.mark.asyncio
async def test_tool_in_plan_passes(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(0))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"tools": ["grammar"]}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_omitted_tools_allows_everything(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(0))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({}))
    for tool in TOOL_NAMES:
        await plan_quota.enforce_plan_quota(None, _user(), tool)


@pytest.mark.asyncio
async def test_telemetry_failure_fails_open(monkeypatch):
    """
    A storage blip must not become an outage.

    Matches enforce_anonymous_limit, which documents the same trade: briefly
    not enforcing a cost control beats locking out every signed-in user.
    """
    async def _explode(*args, **kwargs):
        raise RuntimeError("telemetry unreachable")
    monkeypatch.setattr(plan_quota, "_count_today", _explode)
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 1}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_no_plan_at_all_passes(monkeypatch):
    """An empty catalog must not deny every request."""
    async def _none(user):
        return None, PlanLimits()
    monkeypatch.setattr(plan_quota, "resolve_plan", _none)
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_unreadable_limits_treated_as_unlimited(monkeypatch):
    """
    A row hand-edited in the SQL console bypasses PlanLimits validation.
    Denying every request because of it would be the worse failure.
    """
    async def _get(plan_id):
        return {"slug": "free", "name": "Free", "limits": {"nonsense": True}}
    monkeypatch.setattr(plan_quota.plan_repository, "get", _get)
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(10_000))

    user = _user()
    user.plan_id = "p-1"
    await plan_quota.enforce_plan_quota(None, user, "grammar")


@pytest.mark.asyncio
async def test_resolve_falls_back_to_default_plan(monkeypatch):
    """A profile whose plan was archived resolves to the default, not a denial."""
    async def _get(plan_id):
        return None
    async def _default():
        return {"slug": "free", "name": "Free", "limits": {"requests_per_day": 5}}
    monkeypatch.setattr(plan_quota.plan_repository, "get", _get)
    monkeypatch.setattr(plan_quota.plan_repository, "get_default", _default)

    user = _user()
    user.plan_id = "gone"
    plan, limits = await plan_quota.resolve_plan(user)
    assert plan["slug"] == "free"
    assert limits.requests_per_day == 5


def test_day_window_is_utc_midnight():
    """Matches usage_daily.day, so the quota and the rollup agree."""
    start = plan_quota.day_start_utc()
    assert (start.hour, start.minute, start.second, start.microsecond) == (0, 0, 0, 0)
    assert plan_quota.next_reset_utc() > start


def test_tool_names_match_the_call_sites():
    """
    Guards the one thing grep cannot: that TOOL_NAMES matches the strings
    actually passed at the six enforcement call sites.
    """
    assert set(TOOL_NAMES) == {
        "grammar", "headlines", "rewriter", "summarizer", "optimize",
    }
