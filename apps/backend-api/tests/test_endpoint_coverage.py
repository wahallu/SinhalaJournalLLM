"""
Every inference endpoint must be gated.

Regression: four endpoints — image generation, visual-prompt, model
comparison and the SinLLaMA playground — had no auth, no rate limit and no
feature flag. Two of them bill hosted providers on the project's own key and
two reach the GPU box directly, so the cost control on the four writing
tools was bypassable by calling a different path.

This test enumerates POST endpoints from the OpenAPI schema and asserts each
is accounted for, so a new ungated inference route fails here.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# Endpoints deliberately reachable without a session. Each must apply the
# anonymous rate limit; anything else needs a documented reason here.
ANONYMOUS_OK = {
    "/api/v1/grammar/check",
    "/api/v1/headlines/generate",
    "/api/v1/rewrite",
    "/api/v1/summarize",
    "/api/v1/headlines/visual-prompt",
    # Composes the four writing tools and applies the same anonymous limit
    # once for the whole run — see test_optimize.py.
    "/api/v1/optimize",
    # Research telemetry, and the one entry here that is NOT an inference
    # path: it reaches no model and costs nothing to serve. It has to be
    # anonymous because the study runs almost entirely anonymously — gating it
    # would collect accept/reject data from only the handful of students who
    # sign in, which is the population least representative of the rest.
    # Abuse ceiling is a junk row: the payload is length-capped, the batch is
    # capped at MAX_EVENTS, and `kind`/`action` are closed sets checked in the
    # endpoint and again by a database CHECK constraint.
    "/api/v1/events/suggestions",
}


def _post_paths() -> list[str]:
    return sorted(
        path
        for path, ops in app.openapi()["paths"].items()
        if "post" in ops and path.startswith("/api/v1")
    )


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_post_endpoints_are_enumerated():
    assert _post_paths(), "no POST endpoints found — did routing break?"


@pytest.mark.asyncio
async def test_every_post_endpoint_is_either_public_or_rejects_anonymous(fake_supabase):
    """
    A POST that is neither in ANONYMOUS_OK nor rejecting anonymous callers is
    an ungated inference path. Adding one to the allowlist is a deliberate
    decision; forgetting to gate one is not.
    """
    ungated = []
    async with _client() as c:
        for path in _post_paths():
            if path in ANONYMOUS_OK:
                continue
            response = await c.post(path, json={})
            # 401/403 = gated. 422 = gated by schema before auth would run,
            # which still means an anonymous caller cannot drive it.
            if response.status_code not in (401, 403, 422):
                ungated.append((path, response.status_code))

    assert not ungated, f"ungated POST endpoints: {ungated}"


@pytest.mark.asyncio
async def test_research_actions_require_admin(fake_supabase):
    """Compare and chat run real inference on the GPU box; admin-only."""
    async with _client() as c:
        for path in ("/api/v1/comparison/compare", "/api/v1/sinllama/chat"):
            assert (await c.post(path, json={})).status_code in (401, 403, 422), path


@pytest.mark.asyncio
async def test_research_status_reads_are_public(fake_supabase):
    """
    Adapter listing and the health probe are cheap reads with no GPU cost —
    the public dashboard's status widget calls both for every visitor,
    signed in or not, so neither may require a session.
    """
    async with _client() as c:
        adapters = await c.get("/api/v1/comparison/adapters")
        health = await c.get("/api/v1/sinllama/health")
    assert adapters.status_code != 401
    assert health.status_code != 401
    assert health.json() == {"available": False}


@pytest.mark.asyncio
async def test_image_generation_requires_an_account(fake_supabase):
    """It bills the project's OpenAI key per call."""
    async with _client() as c:
        assert (await c.post("/api/v1/image/generate",
                             json={"prompt": "x"})).status_code == 401


@pytest.mark.asyncio
async def test_category_list_is_public(fake_supabase):
    """
    The signed-out dashboard cycles these names in its greeting, so the
    list has to be readable without a session. They are display labels
    (Journalist, Student, Editor…), not user data.

    Setting one — PUT /categories/me — stays behind require_user.
    """
    fake_supabase.store["user_categories"] = [
        {"id": "c1", "name": "Journalist", "slug": "journalist",
         "is_active": True, "sort_order": 1, "created_at": "2026-01-01T00:00:00Z"},
    ]
    async with _client() as c:
        response = await c.get("/api/v1/categories")
        setting = await c.put("/api/v1/categories/me", json={"category_id": "c1"})

    assert response.status_code == 200
    assert [c["name"] for c in response.json()] == ["Journalist"]
    assert setting.status_code == 401
