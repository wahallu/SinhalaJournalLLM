"""
Tests for headline generation, style rewriting, and news summarization APIs.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_generate_headlines():
    """Headline generation endpoint returns a list of headlines."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": "ලංකාවේ නව ආර්ථික ප්‍රතිසංස්කරණ", "count": 3},
        )
    assert response.status_code == 200
    data = response.json()
    assert "headlines" in data
    assert isinstance(data["headlines"], list)
    assert len(data["headlines"]) == 3
    assert all("ලංකාවේ නව ආර්ථික ප්‍රතිසංස්කරණ" in h or h.startswith("SinAI") or "ප්‍රවෘත්ති" in h for h in data["headlines"])


@pytest.mark.asyncio
async def test_rewrite_style():
    """Style rewriter endpoint returns original, tone, and rewritten text."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/rewrite",
            json={"text": "මම ක්‍රීඩා පිටියට ගියා", "tone": "formal"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "original" in data
    assert "rewritten" in data
    assert "tone" in data
    assert data["tone"] == "formal"
    assert "ගියා" in data["original"]
    assert "formal" in data["rewritten"]


@pytest.mark.asyncio
async def test_summarize_news():
    """News summarizer endpoint returns original, length, and summary text."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/summarize",
            json={"text": "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් විශිෂ්ට ජයග්‍රහණයක් වාර්තා කළේය. මෙම ජයග්‍රහණයත් සමඟ ඔවුන් තරඟාවලියේ පෙරමුණ ගැනීමට සමත් විය.", "length": "short"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "original" in data
    assert "summary" in data
    assert "length" in data
    assert data["length"] == "short"
    assert "සාරාංශය - කෙටි" in data["summary"]
