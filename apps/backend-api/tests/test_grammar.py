"""
Tests for the Grammar Checker API and correction derivation.

MODEL_PROVIDER=mock in .env keeps these offline: the mock provider applies
the rule table in app/core/mock_provider.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.grammar.grammar_service import derive_corrections


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_root():
    """Health check endpoint returns OK."""
    async with _client() as client:
        response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health():
    """Liveness probe stays fast and dependency-free."""
    async with _client() as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_grammar_check_empty_text():
    """Grammar check rejects empty text."""
    async with _client() as client:
        response = await client.post("/api/v1/grammar/check", json={"text": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_grammar_check_valid_text():
    """Grammar check corrects text and reports the corrections."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/grammar/check",
            json={"text": "මම ගෙදර යනව"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "යනවා" in data["corrected"]
    assert data["correction_count"] >= 1
    assert data["corrections"][0]["original"] == "යනව"
    assert data["corrections"][0]["corrected"] == "යනවා"
    assert data["model_used"] == "mock"
    assert data["id"]


@pytest.mark.asyncio
async def test_grammar_history_after_check(fake_supabase):
    """A check lands in the paginated history feed."""
    async with _client() as client:
        await client.post("/api/v1/grammar/check", json={"text": "මම ගෙදර යනව"})
        response = await client.get("/api/v1/grammar/history?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["corrected"] == "මම ගෙදර යනවා"


def test_derive_corrections_word_replacement():
    """Word-level diff pinpoints the changed token and its offset."""
    corrections = derive_corrections("මම ගෙදර යනව", "මම ගෙදර යනවා")
    assert len(corrections) == 1
    assert corrections[0].original == "යනව"
    assert corrections[0].corrected == "යනවා"
    assert corrections[0].position == 8  # offset of යනව in the original


def test_derive_corrections_no_change():
    """Identical texts produce no corrections."""
    assert derive_corrections("මම ගෙදර යනවා", "මම ගෙදර යනවා") == []
