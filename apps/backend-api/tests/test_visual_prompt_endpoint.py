"""
Regression test for the visual-prompt endpoint's exception handling.

The service migrated from OpenRouter to Groq (see groq_client.py), but
app/api/v1/headline.py kept catching the old OpenRouterUnavailable instead of
GroqUnavailable. Since GroqUnavailable is what the Groq-backed service
actually raises on a missing/invalid GROQ_API_KEY or an exhausted-retries
failure, every such failure fell through both except clauses and became an
unhandled 500 -- which also drops CORS headers, since it propagates past
CORSMiddleware to Starlette's ServerErrorMiddleware instead of being caught
and turned into a normal response. This test pins the fix: the endpoint must
turn GroqUnavailable into a clean 503, not an unhandled 500.
"""

import pytest
from httpx import ASGITransport, AsyncClient

import app.api.v1.headline as headline_module
from app.core.groq_client import GroqUnavailable
from app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_groq_unavailable_becomes_a_clean_503(monkeypatch):
    async def _raise_groq_unavailable(*_args, **_kwargs):
        raise GroqUnavailable("GROQ_API_KEY is not configured")

    monkeypatch.setattr(headline_module, "generate_visual_prompt", _raise_groq_unavailable)

    async with _client() as client:
        response = await client.post(
            "/api/v1/headlines/visual-prompt",
            json={"article_text": "පුවත් ලිපියක් මෙහි ඇත.", "headline": "මාතෘකාව"},
        )

    assert response.status_code == 503
    assert "Visual prompt generation unavailable" in response.json()["detail"]


@pytest.mark.asyncio
async def test_empty_completion_becomes_a_clean_502(monkeypatch):
    async def _raise_runtime_error(*_args, **_kwargs):
        raise RuntimeError("Groq returned an empty visual prompt")

    monkeypatch.setattr(headline_module, "generate_visual_prompt", _raise_runtime_error)

    async with _client() as client:
        response = await client.post(
            "/api/v1/headlines/visual-prompt",
            json={"article_text": "පුවත් ලිපියක් මෙහි ඇත.", "headline": "මාතෘකාව"},
        )

    assert response.status_code == 502
