"""Sports-relevance classifier: reply parsing, provider fallback, endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.groq_client import GroqUnavailable
from app.core.openrouter_client import OpenRouterUnavailable
from app.main import app
from app.services.style import sports_classifier as sc


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_parse_label_accepts_wrapped_json():
    raw = 'Sure!\n```json\n{"label": "not_sports_related", "reason": "budget"}\n```'
    assert sc.parse_label(raw) == ("NOT_SPORTS_RELATED", "budget")


@pytest.mark.parametrize("raw", ["no json", '{"label": "MAYBE"}', "{bad json}"])
def test_parse_label_rejects_unusable_replies(raw):
    with pytest.raises(ValueError):
        sc.parse_label(raw)


@pytest.mark.asyncio
async def test_falls_back_to_openrouter_when_groq_fails(monkeypatch):
    async def groq(*a, **k):
        raise GroqUnavailable("down")

    async def openrouter(*a, **k):
        return '{"label": "SPORTS_RELATED", "reason": "match report"}'

    monkeypatch.setattr(sc, "groq_chat", groq)
    monkeypatch.setattr(sc, "openrouter_chat", openrouter)
    result = await sc.classify_sports_relevance("article")
    assert (result.label, result.classifier) == ("SPORTS_RELATED", "llm")


@pytest.mark.asyncio
async def test_all_providers_failing_is_uncertain_never_sports(monkeypatch):
    async def groq(*a, **k):
        raise GroqUnavailable("down")

    async def openrouter(*a, **k):
        raise OpenRouterUnavailable("down")

    monkeypatch.setattr(sc, "groq_chat", groq)
    monkeypatch.setattr(sc, "openrouter_chat", openrouter)
    result = await sc.classify_sports_relevance("article")
    assert (result.label, result.classifier) == ("UNCERTAIN", "unavailable")


@pytest.mark.asyncio
async def test_garbled_reply_is_uncertain(monkeypatch):
    async def groq(*a, **k):
        return "I think it is about sports"

    monkeypatch.setattr(sc, "groq_chat", groq)
    result = await sc.classify_sports_relevance("article")
    assert (result.label, result.classifier) == ("UNCERTAIN", "unavailable")


@pytest.mark.asyncio
async def test_prompt_judges_source_article_with_sinhala_guidance(monkeypatch):
    seen = {}

    async def groq(messages, **k):
        seen["messages"] = messages
        return '{"label": "NOT_SPORTS_RELATED"}'

    monkeypatch.setattr(sc, "groq_chat", groq)
    await sc.classify_sports_relevance("අයවැය විවාදය")
    system, user = (m["content"] for m in seen["messages"])
    assert "ක්‍රීඩා" in system and "Sinhala" in system and "passing" in system
    assert "අයවැය විවාදය" in user


@pytest.mark.asyncio
async def test_endpoint_returns_classification(monkeypatch):
    async def groq(*a, **k):
        return '{"label": "SPORTS_RELATED", "reason": "x"}'

    monkeypatch.setattr(sc, "groq_chat", groq)
    async with _client() as client:
        response = await client.post(
            "/api/v1/rewrite/classify-sports", json={"text": "ක්‍රිකට් තරගය"}
        )
    assert response.status_code == 200
    assert response.json()["label"] == "SPORTS_RELATED"
