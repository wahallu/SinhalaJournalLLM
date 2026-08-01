"""
Tests for headline generation, style rewriting, summarization, meta, and the
unified history feed. All run offline via the mock provider + fake Supabase.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

_LONG_ARTICLE = (
    "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් විශිෂ්ට ජයග්‍රහණයක් වාර්තා කළේය. "
    "මෙම ජයග්‍රහණයත් සමඟ ඔවුන් තරඟාවලියේ පෙරමුණ ගැනීමට සමත් විය. "
    "අවසන් ඕවරයේ දී ලබාගත් ලකුණු හතරක් තරඟයේ ඉරණම වෙනස් කළේය. "
    "පුහුණුකරු පැවසුවේ කණ්ඩායමේ කැපවීම ගැන ආඩම්බර වන බවයි."
)


# Spelled out rather than imported from app.core.prompts so the test pins the
# published contract — a band edit has to be a deliberate change here too.
HEADLINE_LENGTHS_EXPECTED = {
    "short": (3, 5),
    "medium": (6, 7),
    "long": (8, 10),
}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Headlines ──

@pytest.mark.asyncio
async def test_generate_headlines():
    """Headline generation returns distinct candidates plus metadata."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": _LONG_ARTICLE, "count": 3, "category": "Sports"},
        )
    assert response.status_code == 200
    data = response.json()
    assert 1 <= len(data["headlines"]) <= 3
    assert len(set(data["headlines"])) == len(data["headlines"])  # deduped
    assert data["model_used"] == "mock"
    assert data["id"]



@pytest.mark.asyncio
@pytest.mark.parametrize("length", ["short", "medium", "long"])
async def test_generate_headlines_respects_length_band(length):
    """Every returned headline lands inside the requested word band, and the
    band it was held to comes back on the response."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": _LONG_ARTICLE, "count": 3, "length": length},
        )
    assert response.status_code == 200
    data = response.json()

    band = data["length"]
    assert band["id"] == length
    assert (band["min_words"], band["max_words"]) == HEADLINE_LENGTHS_EXPECTED[length]

    for headline in data["headlines"]:
        assert len(headline.split()) <= band["max_words"], headline


@pytest.mark.asyncio
async def test_generate_headlines_defaults_and_trims(monkeypatch):
    """An unknown length falls back to medium, and output over the band
    ceiling is trimmed to it even when every regeneration overshoots."""
    from app.core.model_gateway import GatewayResult
    from app.services.headline import headline_service

    overlong = " ".join(f"වචන{i}" for i in range(15))

    async def _always_overlong(*_args, **_kwargs):
        return GatewayResult(text=overlong, provider="mock", latency_ms=1)

    monkeypatch.setattr(headline_service, "model_generate", _always_overlong)

    async with _client() as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": _LONG_ARTICLE, "count": 3, "length": "nonsense"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["length"]["id"] == "medium"
    assert all(len(h.split()) == 7 for h in data["headlines"])


@pytest.mark.asyncio
async def test_headline_history(fake_supabase):
    """Generations are persisted and served from history."""
    async with _client() as client:
        await client.post(
            "/api/v1/headlines/generate",
            json={"text": _LONG_ARTICLE, "count": 3},
        )
        response = await client.get("/api/v1/headlines/history")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["headlines"]


# ── Style rewriter ──

@pytest.mark.asyncio
async def test_rewrite_style():
    """Style rewriter returns original, tone, resolved style, and rewrite."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/rewrite",
            json={"text": "මම ක්‍රීඩා පිටියට ගියා", "tone": "formal"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["tone"] == "formal"
    assert data["style"] == "formal"
    assert data["rewritten"]
    assert "ගියා" in data["original"]
    assert data["model_used"] == "mock"


@pytest.mark.asyncio
async def test_rewrite_style_legacy_alias():
    """Legacy tone values map onto trained styles (casual → youth)."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/rewrite",
            json={"text": "මම ක්‍රීඩා පිටියට ගියා", "tone": "casual"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["tone"] == "casual"
    assert data["style"] == "youth"


# ── Summarizer ──

@pytest.mark.asyncio
async def test_summarize_news():
    """Summarizer respects the requested length category."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/summarize",
            json={"text": _LONG_ARTICLE, "length": "short"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["length"] == "short"
    assert data["summary"]
    assert len(data["summary"]) < len(_LONG_ARTICLE)
    assert data["model_used"] == "mock"


@pytest.mark.asyncio
async def test_summarize_invalid_length_falls_back():
    """Unknown length values fall back to medium instead of erroring."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/summarize",
            json={"text": _LONG_ARTICLE, "length": "gigantic"},
        )
    assert response.status_code == 200
    assert response.json()["length"] == "medium"


# ── Meta ──

@pytest.mark.asyncio
async def test_meta_capabilities():
    """/meta lists the model's real tasks, styles, and lengths."""
    async with _client() as client:
        response = await client.get("/api/v1/meta")
    assert response.status_code == 200
    data = response.json()
    assert set(data["tasks"]) == {"grammar", "headline", "summarizer", "style"}
    assert {s["id"] for s in data["styles"]} == {
        "formal", "sports", "youth", "editorial", "feature",
    }
    assert {l["id"] for l in data["lengths"]} == {"short", "medium", "long"}
    assert data["model"]["providers"]["mock"]["available"] is True


# ── Unified history ──

@pytest.mark.asyncio
async def test_unified_history(fake_supabase):
    """Activity from different tools merges into one newest-first feed."""
    async with _client() as client:
        await client.post("/api/v1/grammar/check", json={"text": "මම ගෙදර යනව"})
        await client.post(
            "/api/v1/summarize",
            json={"text": _LONG_ARTICLE, "length": "short"},
        )
        response = await client.get("/api/v1/history?limit=10")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 2
    assert {item["tool"] for item in items} == {"grammar", "summarizer"}
    assert items[0]["input_preview"]


# ── Gateway fallback ──

@pytest.mark.asyncio
async def test_gateway_falls_back_to_mock(monkeypatch):
    """
    With sinllama as primary but the server unreachable and no OpenRouter
    key, the gateway falls through to mock instead of failing.
    """
    from app.core.config import get_settings

    real = get_settings()
    patched = real.model_copy(update={
        "MODEL_PROVIDER": "sinllama",
        "MODEL_FALLBACK": True,
        "SINLLAMA_API_URL": "http://127.0.0.1:9",  # closed port → fast refusal
        "SINLLAMA_TIMEOUT_SECONDS": 2.0,
        "OPENROUTER_API_KEY": "",
    })
    monkeypatch.setattr("app.core.model_gateway.get_settings", lambda: patched)
    monkeypatch.setattr("app.models.sinllama_loader.get_settings", lambda: patched)
    monkeypatch.setattr("app.core.openrouter_client.get_settings", lambda: patched)

    async with _client() as client:
        response = await client.post(
            "/api/v1/grammar/check",
            json={"text": "මම ගෙදර යනව"},
        )
    assert response.status_code == 200
    assert response.json()["model_used"] == "mock"
