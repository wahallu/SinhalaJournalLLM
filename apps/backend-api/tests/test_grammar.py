"""
Tests for the Grammar Checker API.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_root():
    """Health check endpoint returns OK."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_grammar_check_empty_text():
    """Grammar check rejects empty text."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/grammar/check",
            json={"text": ""},
        )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_grammar_check_valid_text():
    """Grammar check processes valid Sinhala text."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/grammar/check",
            json={"text": "මම ගෙදර යනව"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "corrected" in data
    assert "corrections" in data
    assert "correction_count" in data
    assert data["correction_count"] >= 1
    # The dummy rule should correct යනව → යනවා
    assert "යනවා" in data["corrected"]
