"""Team member contact links: public listing and admin editing."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app

ADMIN_ID = "22222222-2222-2222-2222-222222222222"
USER_ID = "11111111-1111-1111-1111-111111111111"


def _auth(sub: str = ADMIN_ID) -> dict[str, str]:
    return {"Authorization": f"Bearer {security.create_access_token(sub)}"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _seed(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    fake_supabase.store["portfolio_team_contacts"] = [
        {"student_id": "IT22207272", "name": "Nisal Fonseka", "phone": None,
         "linkedin_url": "https://www.linkedin.com/in/nisalfonseka/",
         "github_url": "https://github.com/nisalfonseka", "sort_order": 0,
         "updated_at": "2026-10-19T00:00:00Z"},
        {"student_id": "IT22246332", "name": "Sandun Hettiarachchi", "phone": None,
         "linkedin_url": None, "github_url": "https://github.com/sandunlak", "sort_order": 3,
         "updated_at": "2026-10-19T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_public_listing_exposes_only_contact_fields():
    async with _client() as client:
        resp = await client.get("/api/v1/portfolio/team-contacts")
    assert resp.status_code == 200
    rows = resp.json()
    assert [r["student_id"] for r in rows] == ["IT22207272", "IT22246332"]
    assert set(rows[0]) == {"student_id", "phone", "linkedin_url", "github_url"}


@pytest.mark.asyncio
async def test_admin_sets_and_clears_contact_fields(fake_supabase):
    async with _client() as client:
        resp = await client.patch(
            "/api/v1/admin/portfolio-team/IT22246332",
            json={"phone": " +94 77 123  4567 ", "linkedin_url": "https://lk.linkedin.com/in/sandun"},
            headers=_auth(),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["phone"] == "+94 77 123 4567"
        assert resp.json()["linkedin_url"] == "https://lk.linkedin.com/in/sandun"
        # Fields not sent are left alone.
        assert resp.json()["github_url"] == "https://github.com/sandunlak"

        resp = await client.patch(
            "/api/v1/admin/portfolio-team/IT22246332", json={"phone": ""}, headers=_auth()
        )
        assert resp.json()["phone"] is None

    actions = [row["action"] for row in fake_supabase.store.get("audit_log", [])]
    assert actions.count("portfolio_team_contact.update") == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"github_url": "https://gitlab.com/someone"},
        {"github_url": "http://github.com/someone"},
        {"linkedin_url": "https://evil.example/linkedin.com/in/x"},
        {"linkedin_url": "javascript:alert(1)"},
        {"phone": "call me maybe"},
        {"phone": "123"},
    ],
)
async def test_admin_rejects_bad_values(body):
    async with _client() as client:
        resp = await client.patch(
            "/api/v1/admin/portfolio-team/IT22207272", json=body, headers=_auth()
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_unknown_member_is_404():
    async with _client() as client:
        resp = await client.patch(
            "/api/v1/admin/portfolio-team/IT00000000", json={"phone": "+94771234567"}, headers=_auth()
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_non_admin_cannot_edit():
    async with _client() as client:
        resp = await client.patch(
            "/api/v1/admin/portfolio-team/IT22207272", json={"phone": "+94771234567"},
            headers=_auth(USER_ID),
        )
    assert resp.status_code == 403
