"""
Plan pricing and the bank-transfer upgrade workflow.

There is no payment gateway: an upgrade is a request an admin confirms after
the money lands. These cover the rules that keep that honest — one open
request per user, only an admin moves a plan, and a decided request cannot
be silently re-decided.
"""

import pytest
from pydantic import ValidationError

from app.schemas.plan import PlanCreate, UpgradeRequestCreate, UpgradeReview


# ── Pricing ──

def test_price_is_minor_units_only():
    """Money is integer cents; a float price is rejected outright."""
    with pytest.raises(ValidationError):
        PlanCreate(slug="p", name="P", price_cents=2500.50)


def test_negative_price_is_rejected():
    with pytest.raises(ValidationError):
        PlanCreate(slug="p", name="P", price_cents=-1)


def test_price_is_optional():
    """Free shows no price at all."""
    plan = PlanCreate(slug="free", name="Free")
    assert plan.price_cents is None
    assert plan.annual_price_cents is None


def test_currency_defaults_to_lkr_and_is_normalised():
    assert PlanCreate(slug="p", name="P").currency == "LKR"
    assert PlanCreate(slug="p", name="P", currency="lkr").currency == "LKR"


def test_unknown_currency_is_rejected():
    with pytest.raises(ValidationError):
        PlanCreate(slug="p", name="P", currency="NOTACURRENCY")


def test_billing_period_is_a_closed_set():
    for ok in ("monthly", "yearly", "one_off"):
        assert PlanCreate(slug="p", name="P", billing_period=ok).billing_period == ok
    with pytest.raises(ValidationError):
        PlanCreate(slug="p", name="P", billing_period="weekly")


def test_annual_price_above_monthly_times_twelve_is_rejected():
    """
    The annual price renders as a saving against 12 monthly payments. One
    that is HIGHER would render a negative discount and quietly misprice the
    plan on a public page.
    """
    with pytest.raises(ValidationError):
        PlanCreate(slug="p", name="P", price_cents=1000, annual_price_cents=13000)


def test_annual_price_at_or_below_twelve_months_is_fine():
    plan = PlanCreate(slug="p", name="P", price_cents=1000, annual_price_cents=10000)
    assert plan.annual_price_cents == 10000


# ── Upgrade requests ──

def test_payment_reference_is_required_and_trimmed():
    """The reference is the only thing tying a transfer to a request."""
    with pytest.raises(ValidationError):
        UpgradeRequestCreate(plan_id="p-1", payment_reference="   ")
    req = UpgradeRequestCreate(plan_id="p-1", payment_reference="  TXN-99  ")
    assert req.payment_reference == "TXN-99"


def test_review_decision_is_a_closed_set():
    assert UpgradeReview(status="approved").status == "approved"
    assert UpgradeReview(status="declined").status == "declined"
    with pytest.raises(ValidationError):
        UpgradeReview(status="pending")
    with pytest.raises(ValidationError):
        UpgradeReview(status="whatever")


# ── The workflow, end to end ──────────────────────────────────────────────

import pytest_asyncio  # noqa: E402,F401
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.main import app  # noqa: E402
from tests.test_admin_auth import ADMIN_ID, USER_ID, _auth  # noqa: E402

FREE_ID = "f0000000-0000-0000-0000-00000000f001"
PLUS_ID = "f0000000-0000-0000-0000-00000000f002"


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
        {"id": FREE_ID, "slug": "free", "name": "Free", "description": "", "badge": None,
         "features": [], "limits": {"requests_per_day": 50}, "sort_order": 0,
         "is_default": True, "is_visible": True, "archived_at": None},
        {"id": PLUS_ID, "slug": "plus", "name": "Plus", "description": "", "badge": None,
         "features": [], "limits": {"requests_per_day": 500}, "sort_order": 1,
         "is_default": False, "is_visible": True, "archived_at": None,
         "price_cents": 250000, "currency": "LKR", "billing_period": "monthly"},
    ]
    fake_supabase.store["plan_upgrade_requests"] = []
    return fake_supabase


@pytest.mark.asyncio
async def test_requesting_an_upgrade_does_not_move_the_plan(seeded):
    """
    The whole point of the workflow: no gateway means a request is an intent,
    not a purchase. A self-service move here would just be a free upgrade.
    """
    async with _api() as c:
        r = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-1"},
            headers=_auth(USER_ID),
        )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
    user = {p["id"]: p for p in seeded.store["profiles"]}[USER_ID]
    assert user["plan_id"] == FREE_ID, "plan must not move before review"


@pytest.mark.asyncio
async def test_a_second_pending_request_is_refused(seeded):
    async with _api() as c:
        first = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-1"},
            headers=_auth(USER_ID),
        )
        assert first.status_code == 201
        second = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-2"},
            headers=_auth(USER_ID),
        )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_cannot_request_the_plan_already_held(seeded):
    async with _api() as c:
        r = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": FREE_ID, "payment_reference": "TXN-1"},
            headers=_auth(USER_ID),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_unknown_plan_is_refused(seeded):
    async with _api() as c:
        r = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": "99999999-9999-9999-9999-999999999999",
                  "payment_reference": "TXN-1"},
            headers=_auth(USER_ID),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_approval_moves_the_plan(seeded):
    async with _api() as c:
        created = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-7"},
            headers=_auth(USER_ID),
        )
        request_id = created.json()["id"]
        review = await c.patch(
            f"/api/v1/admin/upgrades/{request_id}",
            json={"status": "approved"},
            headers=_auth(ADMIN_ID),
        )
    assert review.status_code == 200
    assert review.json()["status"] == "approved"
    user = {p["id"]: p for p in seeded.store["profiles"]}[USER_ID]
    assert user["plan_id"] == PLUS_ID


@pytest.mark.asyncio
async def test_declining_leaves_the_plan_alone(seeded):
    async with _api() as c:
        created = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-8"},
            headers=_auth(USER_ID),
        )
        request_id = created.json()["id"]
        r = await c.patch(
            f"/api/v1/admin/upgrades/{request_id}",
            json={"status": "declined", "reviewer_note": "No payment found."},
            headers=_auth(ADMIN_ID),
        )
    assert r.status_code == 200
    user = {p["id"]: p for p in seeded.store["profiles"]}[USER_ID]
    assert user["plan_id"] == FREE_ID


@pytest.mark.asyncio
async def test_a_decided_request_cannot_be_re_decided(seeded):
    """Two admins working the same queue must not both apply a decision."""
    async with _api() as c:
        created = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-9"},
            headers=_auth(USER_ID),
        )
        request_id = created.json()["id"]
        await c.patch(f"/api/v1/admin/upgrades/{request_id}",
                      json={"status": "declined"}, headers=_auth(ADMIN_ID))
        again = await c.patch(f"/api/v1/admin/upgrades/{request_id}",
                              json={"status": "approved"}, headers=_auth(ADMIN_ID))
    assert again.status_code == 409
    user = {p["id"]: p for p in seeded.store["profiles"]}[USER_ID]
    assert user["plan_id"] == FREE_ID, "the losing race must not move the plan"


@pytest.mark.asyncio
async def test_a_user_cannot_cancel_someone_elses_request(seeded):
    """
    The service-role client bypasses RLS, so the ownership check in the
    endpoint is the only thing enforcing this.
    """
    async with _api() as c:
        created = await c.post(
            "/api/v1/plans/upgrade-requests",
            json={"plan_id": PLUS_ID, "payment_reference": "TXN-10"},
            headers=_auth(USER_ID),
        )
        request_id = created.json()["id"]
        r = await c.post(f"/api/v1/plans/upgrade-requests/{request_id}/cancel",
                         headers=_auth(ADMIN_ID))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_upgrade_endpoints_require_a_session(seeded):
    async with _api() as c:
        r = await c.post("/api/v1/plans/upgrade-requests",
                         json={"plan_id": PLUS_ID, "payment_reference": "X"})
        details = await c.get("/api/v1/plans/payment-details")
    assert r.status_code == 401
    assert details.status_code == 401
