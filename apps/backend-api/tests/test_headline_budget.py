"""
Regression tests for the request wall-clock budget, and for errors reaching
the browser readably.

Reported symptom: the Headline Generator showed "Generation failed / Failed
to fetch" on every attempt, with this in the console --

    Access to fetch at '.../api/v1/headlines/generate' from origin
    'https://chat.sin-ai.app' has been blocked by CORS policy: No
    'Access-Control-Allow-Origin' header is present on the requested resource.
    POST .../api/v1/headlines/generate net::ERR_FAILED 503 (Service Unavailable)

The CORS message was a symptom, not the cause. The deployment runs on Heroku
(confirmed via the `via: 1.1 heroku-router` response header), whose router
terminates any request that hasn't produced a response byte within 30 seconds
and answers with an H12 503 of its own. That 503 is generated upstream of
this app, so it carries none of the CORS headers main.py installs -- which is
why the browser could not read it and the UI had nothing to report but
"Failed to fetch".

What made the request that slow: generation fans out to 8 candidates and then
repaired them in four back-to-back rounds (two length, then missing-number,
invented-number and nonsense-word), up to 48 serialised generations for one
request. The repair rounds are now a single deadline-aware loop that sends
every applicable corrective in one merged hint, and the whole request runs
inside HEADLINE_BUDGET_SECONDS -- so a slow model server degrades into fewer
or rougher headlines instead of into an unreadable 503.
"""

import asyncio
import pytest
from httpx import ASGITransport, AsyncClient
from types import SimpleNamespace

from app.core.config import get_settings
from app.main import app
from app.services.headline import headline_service as hs

# Read from settings rather than hardcoded: CORS_ORIGINS differs between
# the local .env and the deployed config, and what's asserted here is that
# an allowed origin gets its header back, not which origins are allowed.
_ORIGIN = get_settings().cors_origin_list[0]


_ARTICLE = (
    "නේපාලයේ හටගත් හදිසි ගංවතුර තත්ත්වය හේතුවෙන් මියගිය පුද්ගලයින් සංඛ්‍යාව "
    "734 දක්වා ඉහළ ගොස් ඇති බව එරට බලධාරීන් තහවුරු කරනවා."
)
# 6 words: under the "long" band (8-10) and carrying none of the article's
# figures -- so it needs both a length corrective and a number one.
_WEAK = "නේපාලයේ ගංවතුර තත්ත්වය හේතුවෙන් මියගිය සංඛ්‍යාව"


def _stub(text: str) -> SimpleNamespace:
    return SimpleNamespace(
        text=text, provider="sinllama", latency_ms=1,
        meta={"adapter": "headline_sinllama_v19", "input_tokens": 1, "output_tokens": 1},
    )


async def _persist(fn, record, user_id, actor):
    return {"id": "test-id", "created_at": None}


@pytest.mark.asyncio
async def test_both_correctives_travel_in_one_call(monkeypatch):
    """A candidate that is both out-of-band and figureless used to cost three
    serialised generations across three rounds. It now costs one call that
    names both problems."""
    hints_seen: list[str] = []

    async def fake(task, text, *, variation_hint=None, **kwargs):
        hints_seen.append(variation_hint or "")
        return _stub(_WEAK)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", [""])
    monkeypatch.setattr(hs, "model_generate", fake)
    monkeypatch.setattr(hs, "persist_if_owned", _persist)

    await hs.generate_headlines(_ARTICLE, count=1, length="long")

    repair_hints = [h for h in hints_seen if "අවම වශයෙන්" in h]
    assert repair_hints, "expected a length corrective"
    # The same hint carries the missing-number corrective.
    assert all("අසම්පූර්ණය" in h for h in repair_hints)


@pytest.mark.asyncio
async def test_slow_model_server_degrades_instead_of_timing_out(monkeypatch):
    """The fan-out itself is deadline-bounded: when the model server is slower
    than the budget, the candidates that did arrive are returned rather than
    the whole request running on into an H12."""

    async def fake(task, text, *, variation_hint=None, **kwargs):
        # One slot answers immediately; the rest outlive the budget. Keyed on
        # the hint prefix because this article reports a figure, so every
        # slot's hint carries the merged key-number corrective.
        if (variation_hint or "").startswith("fast"):
            return _stub(_WEAK)
        await asyncio.sleep(30)
        return _stub(_WEAK)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["fast", "slow1", "slow2"])
    monkeypatch.setattr(hs, "model_generate", fake)
    monkeypatch.setattr(hs, "persist_if_owned", _persist)
    monkeypatch.setattr(hs, "HEADLINE_BUDGET_SECONDS", 0.25)

    result = await hs.generate_headlines(_ARTICLE, count=3, length="long")

    assert result.headlines, "a slow server must still yield what arrived in time"


@pytest.mark.asyncio
async def test_nothing_in_time_raises_budget_exhausted_not_a_bare_runtime_error(monkeypatch):
    """Distinct exception so the endpoint can answer 503 itself instead of
    letting the router answer with an unreadable one."""

    async def fake(task, text, *, variation_hint=None, **kwargs):
        await asyncio.sleep(30)
        return _stub(_WEAK)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["", "b"])
    monkeypatch.setattr(hs, "model_generate", fake)
    monkeypatch.setattr(hs, "persist_if_owned", _persist)
    monkeypatch.setattr(hs, "HEADLINE_BUDGET_SECONDS", 0.25)

    with pytest.raises(hs.HeadlineBudgetExhausted):
        await hs.generate_headlines(_ARTICLE, count=2, length="long")


@pytest.mark.asyncio
async def test_budget_exhaustion_is_a_readable_503(monkeypatch):
    """The response the browser could not get from the router: a real status
    with a real message, and CORS headers on it."""
    import app.api.v1.headline as headline_module

    async def _raise(*_a, **_kw):
        raise hs.HeadlineBudgetExhausted("nothing completed in time")

    monkeypatch.setattr(headline_module, "generate_headlines", _raise)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": _ARTICLE, "count": 2},
            headers={"Origin": _ORIGIN},
        )

    assert response.status_code == 503
    assert "too slow" in response.json()["detail"].lower()
    assert response.headers["access-control-allow-origin"] == _ORIGIN


@pytest.mark.asyncio
async def test_unhandled_error_still_carries_cors_headers(monkeypatch):
    """Starlette's built-in 500 comes from ServerErrorMiddleware, which wraps
    CORSMiddleware -- so before the catch-all in main.py an unhandled
    exception reached the browser as an opaque cross-origin failure and the
    frontend could only say "Failed to fetch". Any 500 must be readable."""
    import app.api.v1.headline as headline_module

    async def _boom(*_a, **_kw):
        raise ValueError("something nobody anticipated")

    monkeypatch.setattr(headline_module, "generate_headlines", _boom)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": _ARTICLE, "count": 2},
            headers={"Origin": _ORIGIN},
        )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == _ORIGIN
