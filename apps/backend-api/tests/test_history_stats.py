"""
GET /history/stats — exact run counts for the dashboard tiles.

The dashboard used to fill "Total runs", "Today", "This week" and "Most used"
by counting the rows returned from GET /history, which returns at most `limit`
(default 50, hard cap 100). Every tile therefore saturated: a user with 300
runs and a user with exactly 50 saw the same number, and "Most used" was
decided by whichever tool happened to dominate the newest 50 rows.

The first test here is that regression — it fails against any implementation
that derives totals from a page of history.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app

_COLOMBO = timezone(timedelta(hours=5, minutes=30))
_USER = "11111111-1111-1111-1111-111111111111"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {security.create_access_token(_USER)}"}


def _seed(fake_supabase, table: str, count: int, *, days_ago: float = 0.0) -> None:
    when = datetime.now(_COLOMBO) - timedelta(days=days_ago)
    rows = fake_supabase.store.setdefault(table, [])
    for i in range(count):
        rows.append({
            "id": f"{table}-{days_ago}-{i}",
            "user_id": _USER,
            "original_text": "text",
            "article_text": "text",
            "corrected_text": "out",
            "rewritten_text": "out",
            "summary_text": "out",
            "headlines": ["out"],
            "created_at": when.isoformat(),
        })


@pytest.fixture(autouse=True)
def _profile(fake_supabase):
    fake_supabase.store["profiles"] = [{
        "id": _USER, "email": "a@b.c", "role": "user", "status": "active",
    }]
    return fake_supabase


@pytest.mark.asyncio
async def test_total_is_not_capped_by_the_history_page_size(fake_supabase):
    """The regression: 120 runs must report 120, not the 50-row page size."""
    _seed(fake_supabase, "grammar_corrections", 120)

    async with _client() as client:
        response = await client.get("/api/v1/history/stats", headers=_auth())

    assert response.status_code == 200
    assert response.json()["total"] == 120


@pytest.mark.asyncio
async def test_counts_split_by_day_and_week(fake_supabase):
    _seed(fake_supabase, "grammar_corrections", 3)                 # today
    _seed(fake_supabase, "grammar_corrections", 5, days_ago=2)     # this week
    _seed(fake_supabase, "grammar_corrections", 7, days_ago=30)    # older

    async with _client() as client:
        body = (await client.get("/api/v1/history/stats", headers=_auth())).json()

    assert body["total"] == 15
    assert body["today"] == 3
    assert body["week"] == 8


@pytest.mark.asyncio
async def test_top_tool_reflects_all_runs_not_the_newest_page(fake_supabase):
    _seed(fake_supabase, "grammar_corrections", 80)
    _seed(fake_supabase, "summaries", 5)

    async with _client() as client:
        body = (await client.get("/api/v1/history/stats", headers=_auth())).json()

    assert body["top_tool"] == "grammar"
    assert body["per_tool"]["grammar"] == 80
    assert body["per_tool"]["summarizer"] == 5


@pytest.mark.asyncio
async def test_no_runs_reports_zeroes_and_no_top_tool(fake_supabase):
    async with _client() as client:
        body = (await client.get("/api/v1/history/stats", headers=_auth())).json()

    assert body["total"] == 0
    assert body["today"] == 0
    assert body["week"] == 0
    assert body["top_tool"] is None


@pytest.mark.asyncio
async def test_stats_require_authentication(fake_supabase):
    """Counts are per-user; an anonymous caller must not get a number at all."""
    async with _client() as client:
        response = await client.get("/api/v1/history/stats")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stats_are_scoped_to_the_caller(fake_supabase):
    _seed(fake_supabase, "grammar_corrections", 4)
    fake_supabase.store["grammar_corrections"].append({
        "id": "someone-else", "user_id": "22222222-2222-2222-2222-222222222222",
        "original_text": "x", "corrected_text": "y",
        "created_at": datetime.now(_COLOMBO).isoformat(),
    })

    async with _client() as client:
        body = (await client.get("/api/v1/history/stats", headers=_auth())).json()

    assert body["total"] == 4
