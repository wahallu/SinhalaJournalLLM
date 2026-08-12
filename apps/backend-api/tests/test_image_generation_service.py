"""Focused tests for the server-side GPT Image 2 proxy."""

import json
from types import SimpleNamespace

import httpx
import pytest

from app.services import image_generation_service as service


def _settings(api_key: str = "test-openai-key") -> SimpleNamespace:
    return SimpleNamespace(OPENAI_API_KEY=api_key)


def _mock_client(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda **kwargs: real_async_client(transport=transport, **kwargs),
    )


@pytest.mark.asyncio
async def test_generate_image_calls_gpt_image_2_and_returns_data_url(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == service.OPENAI_IMAGE_ENDPOINT
        assert request.headers["authorization"] == "Bearer test-openai-key"
        payload = json.loads(request.content)
        assert payload == {
            "model": "gpt-image-2",
            "prompt": "A precise news photograph",
            "n": 1,
            "size": "1536x1024",
            "quality": "high",
        }
        return httpx.Response(200, json={"data": [{"b64_json": "aGVsbG8="}]})

    monkeypatch.setattr(service, "get_settings", _settings)
    _mock_client(monkeypatch, handler)

    result = await service.generate_image("  A precise news photograph  ")

    assert result == "data:image/png;base64,aGVsbG8="


@pytest.mark.asyncio
async def test_generate_image_requires_openai_api_key(monkeypatch):
    monkeypatch.setattr(service, "get_settings", lambda: _settings(api_key=""))

    with pytest.raises(RuntimeError, match="OPENAI_API_KEY is not configured"):
        await service.generate_image("A news photograph")


@pytest.mark.asyncio
async def test_user_error_is_not_retried(monkeypatch):
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            400,
            json={
                "error": {
                    "type": "image_generation_user_error",
                    "code": "moderation_blocked",
                }
            },
        )

    monkeypatch.setattr(service, "get_settings", _settings)
    _mock_client(monkeypatch, handler)

    with pytest.raises(RuntimeError, match="safety requirements"):
        await service.generate_image("A blocked prompt")

    assert calls == 1


@pytest.mark.asyncio
async def test_rate_limit_is_retried(monkeypatch):
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429, json={"error": {"code": "rate_limit_exceeded"}})
        return httpx.Response(200, json={"data": [{"b64_json": "aGVsbG8="}]})

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(service, "get_settings", _settings)
    monkeypatch.setattr(service, "_retry_delay", no_sleep)
    _mock_client(monkeypatch, handler)

    result = await service.generate_image("A news photograph")

    assert result.startswith("data:image/png;base64,")
    assert calls == 2
