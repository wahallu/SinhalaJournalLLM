"""
The model gateway must take its provider from runtime settings, not env, so
an admin can switch providers from the dashboard without a redeploy.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import runtime_settings
from app.main import app

_TEXT = "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් ජයග්‍රහණයක් වාර්තා කළේය."


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_provider_comes_from_runtime_settings(fake_supabase):
    """The default fixture seeds mock; a generation must report it."""
    async with _client() as c:
        r = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"})
    assert r.json()["model_used"] == "mock"


@pytest.mark.asyncio
async def test_changing_the_stored_provider_changes_the_chain(fake_supabase):
    """
    Switching model.provider in the settings store must change what the
    gateway tries first — without touching env or restarting.
    """
    from app.core.model_gateway import _provider_chain

    assert await _provider_chain() == ["mock"]  # seeded, fallback off

    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "openrouter", "updated_at": "2026-01-01T00:00:00Z"},
        {"key": "model.fallback_enabled", "value": True, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()

    chain = await _provider_chain()
    assert chain[0] == "openrouter"
    assert set(chain) == {"sinllama", "openrouter", "mock"}


@pytest.mark.asyncio
async def test_unknown_provider_degrades_to_mock(fake_supabase):
    """A bad stored value must not take inference down."""
    from app.core.model_gateway import _provider_chain

    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "gpt4", "updated_at": "2026-01-01T00:00:00Z"},
        {"key": "model.fallback_enabled", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()

    assert await _provider_chain() == ["mock"]


@pytest.mark.asyncio
async def test_health_reports_the_runtime_provider(fake_supabase):
    """/health/model must show what is actually in force, not the env value."""
    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "openrouter", "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()

    async with _client() as c:
        r = await c.get("/health/model")
    assert r.json()["primary"] == "openrouter"
