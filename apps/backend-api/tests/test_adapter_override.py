"""
Per-tool adapter override.

The model server owns the authoritative list; this side only stores a name,
sends it when set, and copes when the server refuses it.
"""

import httpx
import pytest

from app.core import runtime_settings
from app.core.settings_registry import validate


def _seed(fake_supabase, **settings):
    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "sinllama", "updated_at": "2026-01-01T00:00:00Z"},
        {"key": "model.fallback_enabled", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
        *[
            {"key": k, "value": v, "updated_at": "2026-01-01T00:00:00Z"}
            for k, v in settings.items()
        ],
    ]
    runtime_settings.invalidate()


# ── Validation ──

def test_empty_means_use_the_task_default():
    assert validate("adapters.grammar", "") == ""


def test_folder_name_is_accepted():
    assert validate("adapters.grammar", "grammar_sinllama_v13") == "grammar_sinllama_v13"


@pytest.mark.parametrize("bad", ["../etc/passwd", "a/b", "x" * 200, 7, None])
def test_unsafe_values_are_rejected(bad):
    with pytest.raises(ValueError):
        validate("adapters.grammar", bad)


# ── Wiring ──

@pytest.mark.asyncio
async def test_adapter_is_sent_when_set(fake_supabase, monkeypatch):
    _seed(fake_supabase, **{"adapters.grammar": "grammar_sinllama_v13"})
    sent = {}

    async def _fake_generate(prompt, task, style=None, adapter=None):
        sent["adapter"] = adapter
        return {"response": "ok", "adapter": adapter}

    monkeypatch.setattr("app.core.model_gateway.sinllama_generate", _fake_generate)

    from app.core.model_gateway import model_generate

    await model_generate("grammar", "පෙළ")
    assert sent["adapter"] == "grammar_sinllama_v13"


@pytest.mark.asyncio
async def test_no_adapter_sent_when_unset(fake_supabase, monkeypatch):
    _seed(fake_supabase)
    sent = {}

    async def _fake_generate(prompt, task, style=None, adapter=None):
        sent["adapter"] = adapter
        return {"response": "ok"}

    monkeypatch.setattr("app.core.model_gateway.sinllama_generate", _fake_generate)

    from app.core.model_gateway import model_generate

    await model_generate("grammar", "පෙළ")
    assert sent["adapter"] is None


@pytest.mark.asyncio
async def test_rejected_adapter_falls_back_to_the_task_default(fake_supabase, monkeypatch):
    """
    A renamed or deleted adapter must not break every request. The server
    answers 422; we retry once without the override.
    """
    _seed(fake_supabase, **{"adapters.grammar": "deleted_adapter_v99"})
    calls = []

    async def _fake_generate(prompt, task, style=None, adapter=None):
        calls.append(adapter)
        if adapter:
            raise httpx.HTTPStatusError(
                "unprocessable",
                request=httpx.Request("POST", "http://model/generate"),
                response=httpx.Response(422, request=httpx.Request("POST", "http://model/generate")),
            )
        return {"response": "recovered"}

    monkeypatch.setattr("app.core.model_gateway.sinllama_generate", _fake_generate)

    from app.core.model_gateway import model_generate

    result = await model_generate("grammar", "පෙළ")

    assert calls == ["deleted_adapter_v99", None]
    assert result.text == "recovered"


@pytest.mark.asyncio
async def test_other_http_errors_are_not_swallowed(fake_supabase, monkeypatch):
    """Only 422 means "bad adapter"; a 500 must still surface."""
    _seed(fake_supabase, **{"adapters.grammar": "grammar_sinllama_v13"})

    async def _fake_generate(prompt, task, style=None, adapter=None):
        raise httpx.HTTPStatusError(
            "boom",
            request=httpx.Request("POST", "http://model/generate"),
            response=httpx.Response(500, request=httpx.Request("POST", "http://model/generate")),
        )

    monkeypatch.setattr("app.core.model_gateway.sinllama_generate", _fake_generate)

    from app.core.model_gateway import model_generate

    with pytest.raises(httpx.HTTPStatusError):
        await model_generate("grammar", "පෙළ")
