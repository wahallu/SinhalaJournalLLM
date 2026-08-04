"""
Optimize Article — the four writing tools run as one ordered pipeline.

The properties worth protecting are the ones a client-side loop over the
four existing endpoints would get wrong:

  - headlines and the summary are produced from the *final* text, so a style
    rewrite cannot leave a headline describing copy that no longer exists;
  - the whole run costs one unit of the anonymous rate limit and writes one
    telemetry row, not four;
  - a disabled tool removes its stage instead of 503-ing the run;
  - one failing stage does not discard the stages that already succeeded.
"""

import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import runtime_settings, security
from app.main import app

USER_ID = "11111111-1111-1111-1111-111111111111"

_TEXT = "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් ජයග්‍රහණයක් වාර්තා කළේය."


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth() -> dict:
    return {"Authorization": f"Bearer {security.create_access_token(USER_ID)}"}


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


async def _run(client: AsyncClient, **payload) -> list[dict]:
    """POST /optimize and return the parsed NDJSON events."""
    body = {"text": _TEXT, **payload}
    response = await client.post("/api/v1/optimize", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/x-ndjson")
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def _by_stage(events: list[dict], status: str) -> dict[str, dict]:
    return {e["stage"]: e for e in events if e["status"] == status}


def _final(events: list[dict]) -> dict:
    closing = events[-1]
    assert closing["stage"] == "pipeline" and closing["status"] == "done"
    return closing["data"]


# ── Shape ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stream_opens_with_a_plan_and_closes_with_a_result(fake_supabase):
    async with _client() as c:
        events = await _run(c)

    opening = events[0]
    assert opening == {
        "stage": "pipeline",
        "status": "running",
        "data": {"plan": {
            "grammar": "queued",
            "style": "not_requested",
            "headline": "queued",
            "summary": "not_requested",
        }},
    }

    result = _final(events)
    assert result["original_text"] == _TEXT
    assert result["final_text"]
    assert sorted(result["stages_run"]) == ["grammar", "headline"]
    assert result["stages_failed"] == {}


@pytest.mark.asyncio
async def test_default_run_is_grammar_and_headlines_only(fake_supabase):
    """
    Style and summary are opt-in. Making all four optional would turn a
    one-click action into a form; making all four mandatory would bill every
    user for stages they did not ask for.
    """
    async with _client() as c:
        events = await _run(c)

    done = _by_stage(events, "done")
    skipped = _by_stage(events, "skipped")
    assert set(done) == {"grammar", "headline", "pipeline"}
    assert skipped["style"]["reason"] == "not_requested"
    assert skipped["summary"]["reason"] == "not_requested"


@pytest.mark.asyncio
async def test_every_stage_runs_when_all_are_requested(fake_supabase):
    async with _client() as c:
        events = await _run(c, restyle=True, summarize=True, tone="sports", length="short")

    result = _final(events)
    assert sorted(result["stages_run"]) == ["grammar", "headline", "style", "summary"]
    assert result["stages_skipped"] == {}
    assert result["style"]["tone"] == "sports"
    assert result["summary"]["length"] == "short"
    assert result["headline"]["headlines"]


@pytest.mark.asyncio
async def test_each_stage_payload_matches_its_own_endpoint(fake_supabase):
    """
    Stages carry the very same body the tool's own endpoint returns, so a
    client needs no second renderer for an optimize run.
    """
    async with _client() as c:
        events = await _run(c, restyle=True, summarize=True)
        direct = await c.post("/api/v1/grammar/check", json={"text": _TEXT})

    grammar = _by_stage(events, "done")["grammar"]["data"]
    assert set(direct.json()) <= set(grammar)
    assert {"corrected", "corrections", "correction_count"} <= set(grammar)


# ── Ordering: the reason this is a pipeline and not a fan-out ──────────

@pytest.mark.asyncio
async def test_headline_and_summary_are_generated_from_the_restyled_text():
    """
    The bug this prevents: a headline that describes the article as it was
    before the style rewrite regenerated it.
    """
    seen: dict[str, str] = {}

    async def _spy(name):
        async def _inner(text, *args, **kwargs):
            seen[name] = text
            return await _originals[name](text, *args, **kwargs)
        return _inner

    from app.services.optimize import optimize_service as svc

    _originals = {
        "headline": svc.generate_headlines,
        "summary": svc.summarize_text,
    }
    svc.generate_headlines = await _spy("headline")
    svc.summarize_text = await _spy("summary")
    try:
        async with _client() as c:
            events = await _run(c, restyle=True, summarize=True)
    finally:
        svc.generate_headlines = _originals["headline"]
        svc.summarize_text = _originals["summary"]

    result = _final(events)
    restyled = result["style"]["rewritten"]
    assert result["final_text"] == restyled
    assert seen["headline"] == restyled
    assert seen["summary"] == restyled


@pytest.mark.asyncio
async def test_final_text_is_the_corrected_text_when_style_is_off(fake_supabase):
    async with _client() as c:
        events = await _run(c)
    result = _final(events)
    assert result["final_text"] == result["grammar"]["corrected"]


# ── Cost: one run is one unit, not four ────────────────────────────────

@pytest.mark.asyncio
async def test_a_run_writes_exactly_one_telemetry_row(fake_supabase):
    async with _client() as c:
        await _run(c, restyle=True, summarize=True)

    rows = fake_supabase.store.get("request_telemetry", [])
    assert len(rows) == 1, rows
    assert rows[0]["tool"] == "optimize"
    assert rows[0]["endpoint"] == "/api/v1/optimize"
    assert rows[0]["status_code"] == 200


@pytest.mark.asyncio
async def test_a_run_costs_one_unit_of_the_anonymous_limit(fake_supabase, monkeypatch):
    """
    The limiter counts telemetry rows per IP. Four rows per click would give
    an anonymous visitor a quarter as many optimize runs as tool runs.
    """
    from app.core import rate_limit
    monkeypatch.setattr(rate_limit, "_limit", lambda: 2)
    headers = {"X-Forwarded-For": "203.0.113.7"}

    async with _client() as c:
        first = await c.post("/api/v1/optimize", json={"text": _TEXT}, headers=headers)
        second = await c.post("/api/v1/optimize", json={"text": _TEXT}, headers=headers)
        third = await c.post("/api/v1/optimize", json={"text": _TEXT}, headers=headers)

    assert (first.status_code, second.status_code) == (200, 200)
    assert third.status_code == 429


@pytest.mark.asyncio
async def test_stages_persist_under_their_own_tool_history(fake_supabase):
    """
    No new history table: each stage saves through its own service, so an
    optimize run shows up in the unified feed as the work it actually did.
    Anonymous runs still persist nothing.
    """
    async with _client() as c:
        await _run(c)  # anonymous
        assert not fake_supabase.store.get("grammar_corrections")

        body = {"text": _TEXT, "restyle": True, "summarize": True}
        response = await c.post("/api/v1/optimize", json=body, headers=_auth())
        assert response.status_code == 200

    for table in ("grammar_corrections", "style_rewrites", "summaries", "headline_generations"):
        rows = fake_supabase.store.get(table, [])
        assert len(rows) == 1, f"{table}: {rows}"
        assert rows[0]["user_id"] == USER_ID


# ── Degradation ────────────────────────────────────────────────────────

def _disable(fake_supabase, *keys: str) -> None:
    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "mock", "updated_at": "2026-01-01T00:00:00Z"},
        {"key": "model.fallback_enabled", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
        *[{"key": k, "value": False, "updated_at": "2026-01-01T00:00:00Z"} for k in keys],
    ]
    runtime_settings.invalidate()


@pytest.mark.asyncio
async def test_a_disabled_tool_skips_its_stage_rather_than_failing_the_run(fake_supabase):
    _disable(fake_supabase, "features.rewriter")
    async with _client() as c:
        events = await _run(c, restyle=True)

    result = _final(events)
    assert result["stages_skipped"]["style"] == "disabled"
    assert "grammar" in result["stages_run"] and "headline" in result["stages_run"]
    # Skipping the rewrite must not silently drop the correction either.
    assert result["final_text"] == result["grammar"]["corrected"]


@pytest.mark.asyncio
async def test_pipeline_503s_only_when_nothing_essential_is_left(fake_supabase):
    _disable(fake_supabase, "features.grammar", "features.headlines")
    async with _client() as c:
        response = await c.post("/api/v1/optimize", json={"text": _TEXT})
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_one_failing_stage_does_not_discard_the_others(fake_supabase):
    """
    Headlines are four generations behind one call. Losing them must not also
    lose a grammar pass the user already waited for.
    """
    from app.services.optimize import optimize_service as svc

    async def _boom(*_args, **_kwargs):
        raise RuntimeError("headline server exploded")

    original = svc.generate_headlines
    svc.generate_headlines = _boom
    try:
        async with _client() as c:
            events = await _run(c)
    finally:
        svc.generate_headlines = original

    result = _final(events)
    assert result["stages_failed"]["headline"] == "headline server exploded"
    assert result["stages_run"] == ["grammar"]
    assert result["grammar"]["corrected"]
    assert result["final_text"] == result["grammar"]["corrected"]

    rows = fake_supabase.store.get("request_telemetry", [])
    assert rows[0]["status_code"] == 207


@pytest.mark.asyncio
async def test_a_failing_grammar_stage_leaves_the_text_untouched(fake_supabase):
    from app.services.optimize import optimize_service as svc

    async def _boom(*_args, **_kwargs):
        raise RuntimeError("grammar adapter offline")

    original = svc.check_grammar
    svc.check_grammar = _boom
    try:
        async with _client() as c:
            events = await _run(c)
    finally:
        svc.check_grammar = original

    result = _final(events)
    assert result["stages_failed"]["grammar"]
    assert result["final_text"] == _TEXT
    # The headline still runs — off the original text, which is the best
    # available copy once correction has failed.
    assert "headline" in result["stages_run"]


@pytest.mark.asyncio
async def test_oversized_input_is_rejected_before_any_model_call(fake_supabase):
    async with _client() as c:
        response = await c.post("/api/v1/optimize", json={"text": "අ" * 10_001})
    assert response.status_code == 422
    assert not fake_supabase.store.get("request_telemetry")
