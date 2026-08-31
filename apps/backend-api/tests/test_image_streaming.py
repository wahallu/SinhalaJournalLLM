"""
Regression tests for image generation timing out on the platform, and for the
admin-selectable image model.

Reported symptom: image generation failed every time, with

    OpenAI image generation failed after 2 attempts.
    Could not reach OpenAI image generation. Please try again.
    POST .../api/v1/image/generate  502

Cause, and it was structural rather than intermittent. OpenAI documents image
latency as reaching "up to 2 minutes"; the Heroku router in front of this app
(confirmed by the `via: 1.1 heroku-router` response header) terminates any
request that has not produced its FIRST BYTE within 30 seconds, and that limit
is not configurable. Every generation slower than 30s was killed by the
platform before it could answer. Worse, per Heroku's own documentation, "your
application will not know that the request it is processing has reached a
time-out, and will continue to work on the request" -- so the service's retry
loop (3 attempts x a 180s timeout) kept billing OpenAI for images that could
never be delivered.

The fix uses the other half of the same rule: after the first byte, the router
allows a rolling 55 seconds between bytes. The endpoint now streams NDJSON,
emitting a "working" line before OpenAI is called at all and heartbeating
until the image is ready, so the 30-second rule is satisfied in milliseconds
and the model gets as long as it needs.
"""

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import runtime_settings, security
from app.main import app
from app.schemas.image_generation import IMAGE_MODELS, resolve_image_model

ADMIN_ID = "22222222-2222-2222-2222-222222222222"
ENDPOINT = "/api/v1/image/generate"


def _auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {security.create_access_token(ADMIN_ID)}"}


@pytest.fixture(autouse=True)
def _admin(fake_supabase):
    fake_supabase.store["profiles"] = [{
        "id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin",
        "status": "active", "category_id": None,
        "created_at": "2026-01-01T00:00:00Z",
    }]
    runtime_settings.invalidate()
    yield fake_supabase
    runtime_settings.invalidate()


def _events(text: str) -> list[dict]:
    return [json.loads(line) for line in text.splitlines() if line.strip()]


@pytest.mark.asyncio
async def test_first_byte_arrives_before_openai_is_called(monkeypatch):
    """The whole fix in one assertion: the byte the 30-second rule measures is
    emitted before the slow call starts, so platform timing no longer depends
    on how long the model takes."""
    started = asyncio.Event()

    async def slow_generate(prompt: str, model: str | None = None) -> str:
        started.set()
        await asyncio.sleep(0.2)
        return "data:image/png;base64,aGVsbG8="

    monkeypatch.setattr("app.api.v1.image_generation.generate_image", slow_generate)
    monkeypatch.setattr("app.api.v1.image_generation.HEARTBEAT_SECONDS", 0.02)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.stream(
            "POST", ENDPOINT, json={"prompt": "A news photograph"}, headers=_auth(),
        ) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("application/x-ndjson")
            first = None
            async for line in response.aiter_lines():
                if line.strip():
                    first = json.loads(line)
                    break

    assert first == {"status": "working", "model": "gpt-image-2"}


@pytest.mark.asyncio
async def test_heartbeats_keep_the_connection_alive_while_the_model_works(monkeypatch):
    """After the first byte the router allows 55s between bytes. A generation
    that takes minutes must keep refreshing that window."""

    async def slow_generate(prompt: str, model: str | None = None) -> str:
        await asyncio.sleep(0.25)
        return "data:image/png;base64,aGVsbG8="

    monkeypatch.setattr("app.api.v1.image_generation.generate_image", slow_generate)
    monkeypatch.setattr("app.api.v1.image_generation.HEARTBEAT_SECONDS", 0.02)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            ENDPOINT, json={"prompt": "A news photograph"}, headers=_auth(),
        )

    events = _events(response.text)
    beats = [e for e in events if e["status"] == "working"]
    assert len(beats) > 1, "a long generation must emit more than the opening byte"
    assert events[-1]["status"] == "done"
    assert events[-1]["image_data"] == "data:image/png;base64,aGVsbG8="


@pytest.mark.asyncio
async def test_failure_is_reported_in_band_with_the_real_message(monkeypatch):
    """The status line is already committed to 200 once the stream opens, so a
    failure has to arrive as a terminal event. The message must survive --
    it's the only thing that tells an admin what to do."""

    async def failing(prompt: str, model: str | None = None) -> str:
        raise RuntimeError("OpenAI image generation is not authorized. Check the backend OPENAI_API_KEY.")

    monkeypatch.setattr("app.api.v1.image_generation.generate_image", failing)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            ENDPOINT, json={"prompt": "A news photograph"}, headers=_auth(),
        )

    assert response.status_code == 200
    terminal = _events(response.text)[-1]
    assert terminal["status"] == "error"
    assert "OPENAI_API_KEY" in terminal["detail"]


@pytest.mark.asyncio
async def test_cheap_failures_are_still_ordinary_http_errors(monkeypatch):
    """Only the OpenAI call needs the stream. Validation still answers with a
    real status code, so the client isn't forced to parse a stream to learn it
    sent a bad request."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(ENDPOINT, json={"prompt": ""}, headers=_auth())

    assert response.status_code == 422


# ── admin-selectable model ──

@pytest.mark.asyncio
async def test_admin_setting_chooses_the_model(monkeypatch, fake_supabase):
    """The requested admin control: switching image.model must reach OpenAI."""
    fake_supabase.store["app_settings"] = [{"key": "image.model", "value": "gpt-image-1"}]
    runtime_settings.invalidate()
    seen = {}

    async def fake_generate(prompt: str, model: str | None = None) -> str:
        seen["model"] = model
        return "data:image/png;base64,aGVsbG8="

    monkeypatch.setattr("app.api.v1.image_generation.generate_image", fake_generate)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            ENDPOINT, json={"prompt": "A news photograph"}, headers=_auth(),
        )

    assert seen["model"] == "gpt-image-1"
    assert _events(response.text)[-1]["model"] == "gpt-image-1"


def test_both_requested_models_are_selectable():
    assert set(IMAGE_MODELS) == {"gpt-image-1", "gpt-image-2"}


def test_a_stale_or_unknown_model_falls_back_instead_of_failing():
    """A value left in the settings table after this list changes must not take
    image generation down."""
    assert resolve_image_model("dall-e-3") == "gpt-image-2"
    assert resolve_image_model(None) == "gpt-image-2"
    assert resolve_image_model("gpt-image-1") == "gpt-image-1"
