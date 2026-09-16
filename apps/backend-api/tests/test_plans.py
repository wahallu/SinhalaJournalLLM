"""Plan catalog: limits validation and catalog CRUD."""

import pytest
from pydantic import ValidationError

from app.schemas.plan import MAX_HEADLINE_COUNT, PlanLimits, TOOL_NAMES


def test_limits_reject_unknown_keys():
    """
    An admin typo must not store silently.

    `plans.limits` is jsonb, so without extra="forbid" a misspelled
    "requests_per_dayy" would be accepted and the quota would read as
    unlimited forever — a silent removal of the cap.
    """
    with pytest.raises(ValidationError):
        PlanLimits(requests_per_dayy=50)


def test_limits_reject_unknown_tool():
    with pytest.raises(ValidationError):
        PlanLimits(tools=["grammar", "telepathy"])


def test_limits_accept_every_known_tool():
    limits = PlanLimits(tools=list(TOOL_NAMES))
    assert limits.tools == list(TOOL_NAMES)


def test_limits_reject_headline_count_above_registry_max():
    """Above the registry's own defaults.headline_count bound is rejected,
    not silently capped — the admin should see their input refused."""
    with pytest.raises(ValidationError):
        PlanLimits(max_headline_count=MAX_HEADLINE_COUNT + 1)


def test_limits_reject_negative_requests():
    with pytest.raises(ValidationError):
        PlanLimits(requests_per_day=-1)


def test_limits_all_optional():
    limits = PlanLimits()
    assert limits.requests_per_day is None
    assert limits.tools is None
    assert limits.max_headline_count is None


@pytest.mark.parametrize("value", [None, 0])
def test_none_and_zero_are_unlimited(value):
    assert PlanLimits(requests_per_day=value).is_unlimited is True


def test_a_positive_limit_is_not_unlimited():
    assert PlanLimits(requests_per_day=1).is_unlimited is False


# ── CTA link safety ───────────────────────────────────────────────────────
#
# cta_href is set by an admin and rendered as an <a href> on /plans, which
# is PUBLIC. A javascript: URL there is stored XSS against every visitor,
# so the scheme is whitelisted rather than sanitized. Admin-only is not a
# sufficient defence: one compromised admin account should not be able to
# reach every anonymous visitor.

import pytest as _pytest  # noqa: E402
from app.schemas.plan import PlanCreate  # noqa: E402


@_pytest.mark.parametrize("href", [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "jAvAsCrIpT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com",
])
def test_dangerous_cta_hrefs_are_rejected(href):
    with _pytest.raises(ValidationError):
        PlanCreate(slug="x", name="X", cta_label="Go", cta_href=href)


@_pytest.mark.parametrize("href", [
    "https://example.com/waitlist",
    "http://example.com",
    "mailto:hello@sin-ai.app",
    "/signup",
])
def test_safe_cta_hrefs_are_accepted(href):
    plan = PlanCreate(slug="x", name="X", cta_label="Go", cta_href=href)
    assert plan.cta_href == href


def test_cta_label_without_href_is_rejected():
    """A labelled button that goes nowhere is the dead button being removed."""
    with _pytest.raises(ValidationError):
        PlanCreate(slug="x", name="X", cta_label="Go")


def test_no_cta_at_all_is_fine():
    """The default: no button renders until an admin sets one."""
    plan = PlanCreate(slug="x", name="X")
    assert plan.cta_label is None
    assert plan.cta_href is None


# ── Catalog API ──────────────────────────────────────────────────────────
#
# Authorization is covered in test_admin_auth.py; this covers what the
# endpoints do once a legitimate admin is through the gate.

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.main import app  # noqa: E402
from tests.test_admin_auth import ADMIN_ID, USER_ID, _auth  # noqa: E402

FREE_ID = "f0000000-0000-0000-0000-000000000001"
PRO_ID = "f0000000-0000-0000-0000-000000000002"
HIDDEN_ID = "f0000000-0000-0000-0000-000000000003"


def _api() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def seeded(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
         "category_id": None, "plan_id": FREE_ID, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "plan_id": FREE_ID, "created_at": "2026-01-01T00:00:00Z"},
    ]
    fake_supabase.store["plans"] = [
        {"id": FREE_ID, "slug": "free", "name": "Free", "description": "",
         "badge": None, "features": ["a"], "limits": {"requests_per_day": 50},
         "sort_order": 0, "is_default": True, "is_visible": True, "archived_at": None},
        {"id": PRO_ID, "slug": "pro", "name": "Pro", "description": "",
         "badge": None, "features": ["b"], "limits": {"requests_per_day": None},
         "sort_order": 1, "is_default": False, "is_visible": True, "archived_at": None},
        {"id": HIDDEN_ID, "slug": "secret", "name": "Secret", "description": "",
         "badge": None, "features": [], "limits": {},
         "sort_order": 2, "is_default": False, "is_visible": False, "archived_at": None},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_public_catalog_hides_invisible_plans(seeded):
    """A tier an admin hid must not appear on the pricing page."""
    async with _api() as c:
        r = await c.get("/api/v1/plans")
    assert r.status_code == 200
    assert sorted(p["slug"] for p in r.json()) == ["free", "pro"]


@pytest.mark.asyncio
async def test_public_catalog_is_readable_signed_out(seeded):
    """/plans has to render for a visitor with no session."""
    async with _api() as c:
        r = await c.get("/api/v1/plans")
    assert r.status_code == 200
    assert r.json()


@pytest.mark.asyncio
async def test_admin_catalog_includes_hidden(seeded):
    async with _api() as c:
        r = await c.get("/api/v1/admin/plans", headers=_auth(ADMIN_ID))
    assert r.status_code == 200
    assert "secret" in [p["slug"] for p in r.json()]


@pytest.mark.asyncio
async def test_create_rejects_duplicate_slug(seeded):
    async with _api() as c:
        r = await c.post(
            "/api/v1/admin/plans",
            json={"slug": "free", "name": "Another Free"},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_create_rejects_bad_limits(seeded):
    """The jsonb column's guard rail, exercised through the API."""
    async with _api() as c:
        r = await c.post(
            "/api/v1/admin/plans",
            json={"slug": "typo", "name": "Typo", "limits": {"requests_per_dayy": 5}},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_promoting_a_plan_demotes_the_incumbent(seeded):
    """The partial unique index makes two defaults impossible."""
    async with _api() as c:
        r = await c.patch(
            f"/api/v1/admin/plans/{PRO_ID}",
            json={"is_default": True},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 200
    by_id = {p["id"]: p for p in seeded.store["plans"]}
    assert by_id[PRO_ID]["is_default"] is True
    assert by_id[FREE_ID]["is_default"] is False


@pytest.mark.asyncio
async def test_cannot_clear_the_only_default(seeded):
    """Leaving no default would strand every new signup."""
    async with _api() as c:
        r = await c.patch(
            f"/api/v1/admin/plans/{FREE_ID}",
            json={"is_default": False},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cannot_archive_the_default_plan(seeded):
    async with _api() as c:
        r = await c.delete(f"/api/v1/admin/plans/{FREE_ID}", headers=_auth(ADMIN_ID))
    assert r.status_code == 400
    assert "default" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_archive_a_non_default_plan(seeded):
    async with _api() as c:
        r = await c.delete(f"/api/v1/admin/plans/{PRO_ID}", headers=_auth(ADMIN_ID))
    assert r.status_code == 200
    archived = {p["id"]: p for p in seeded.store["plans"]}[PRO_ID]
    assert archived["archived_at"] is not None


@pytest.mark.asyncio
async def test_assigning_an_unknown_plan_is_rejected(seeded):
    """Otherwise the account silently resolves to the default forever."""
    async with _api() as c:
        r = await c.patch(
            f"/api/v1/admin/users/{USER_ID}",
            json={"plan_id": "99999999-9999-9999-9999-999999999999"},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_assigning_a_known_plan_succeeds(seeded):
    async with _api() as c:
        r = await c.patch(
            f"/api/v1/admin/users/{USER_ID}",
            json={"plan_id": PRO_ID},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 200
    assert r.json()["plan_id"] == PRO_ID
