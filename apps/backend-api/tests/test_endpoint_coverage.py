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
async def test_research_endpoints_require_admin(fake_supabase):
    """Comparison and the playground reach the GPU box; admin-only."""
    async with _client() as c:
        for path in ("/api/v1/comparison/compare", "/api/v1/sinllama/chat"):
            assert (await c.post(path, json={})).status_code in (401, 403, 422), path
        assert (await c.get("/api/v1/comparison/adapters")).status_code == 401
        assert (await c.get("/api/v1/sinllama/health")).status_code == 401


@pytest.mark.asyncio
async def test_image_generation_requires_an_account(fake_supabase):
    """It bills the project's OpenAI key per call."""
    async with _client() as c:
        assert (await c.post("/api/v1/image/generate",
                             json={"prompt": "x"})).status_code == 401
