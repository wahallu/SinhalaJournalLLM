"""
Token counts must reach persistence.

The gateway has always captured input_tokens/output_tokens from the
inference server into GatewayResult.meta, and request_telemetry has always
had columns for them — but no service passed them on and no record_request
call included them, so every row was NULL. These tests pin the wiring.

Only sinllama reports tokens; openrouter and mock return none, and a run
under those providers must store NULL rather than 0, so "no data" stays
distinguishable from "genuinely zero tokens".
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.model_gateway import GatewayResult
from app.main import app
from app.services.grammar import grammar_service
from app.services.headline import headline_service
from app.services.style import style_service
from app.services.summarizer import summarizer_service
from test_user_scoping import TEST_SECRET, _auth

_USER = "66666666-6666-6666-6666-666666666666"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")




@pytest.fixture
def _profile(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": _USER, "email": "tokens@sinai.lk", "role": "user",
         "status": "active", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


def _with_tokens(text, input_tokens, output_tokens):
    async def _fake(task, value, **_kwargs):
        return GatewayResult(
            text=text,
            provider="sinllama",
            latency_ms=10,
            meta={"input_tokens": input_tokens, "output_tokens": output_tokens},
        )
    return _fake


def _idempotent_with_tokens(input_tokens, output_tokens):
    """Returns its input unchanged — a plain single-call fake."""
    async def _fake(task, value, **_kwargs):
        return GatewayResult(
            text=value,
            provider="sinllama",
            latency_ms=10,
            meta={"input_tokens": input_tokens, "output_tokens": output_tokens},
        )
    return _fake


def _without_tokens(text):
    """Mirrors _via_mock / _via_openrouter, which report no token counts."""
    async def _fake(task, value, **_kwargs):
        return GatewayResult(text=text, provider="mock", latency_ms=10, meta={})
    return _fake


# ── Persisted onto the history row ──

@pytest.mark.asyncio
async def test_grammar_persists_token_counts(monkeypatch, fake_supabase):
    monkeypatch.setattr(grammar_service, "model_generate", _idempotent_with_tokens(12, 5))

    await grammar_service.check_grammar("වැරදි", user_id=_USER)

    [row] = fake_supabase.store["grammar_corrections"]
    assert row["input_tokens"] == 12
    assert row["output_tokens"] == 5


@pytest.mark.asyncio
async def test_grammar_reports_tokens_from_a_single_call_even_when_text_changes(monkeypatch, fake_supabase):
    """
    Regression guard for the removed second pass: a check that actually
    changes the text must still cost exactly one call's worth of tokens, not
    two.
    """
    monkeypatch.setattr(grammar_service, "model_generate", _with_tokens("නිවැරදි", 12, 5))

    await grammar_service.check_grammar("වැරදි", user_id=_USER)

    [row] = fake_supabase.store["grammar_corrections"]
    assert row["input_tokens"] == 12
    assert row["output_tokens"] == 5


@pytest.mark.asyncio
async def test_style_persists_token_counts(monkeypatch, fake_supabase):
    monkeypatch.setattr(style_service, "model_generate", _with_tokens("නැවත", 20, 9))

    await style_service.rewrite_style("පෙළ", user_id=_USER)

    [row] = fake_supabase.store["style_rewrites"]
    assert row["input_tokens"] == 20
    assert row["output_tokens"] == 9


@pytest.mark.asyncio
async def test_summarizer_persists_token_counts(monkeypatch, fake_supabase):
    monkeypatch.setattr(summarizer_service, "model_generate", _with_tokens("සාරාංශ", 90, 30))

    await summarizer_service.summarize_text("ලිපිය", user_id=_USER)

    [row] = fake_supabase.store["summaries"]
    assert row["input_tokens"] == 90
    assert row["output_tokens"] == 30


@pytest.mark.asyncio
async def test_headlines_sum_tokens_across_every_candidate_call(monkeypatch, fake_supabase):
    """Headline generation makes one model call per candidate plus retries;
    the stored count must be the total, the way latency already is."""
    calls = {"n": 0}

    async def _fake(task, text, **_kwargs):
        calls["n"] += 1
        # A real, lexicon-known word with no digit suffix -- fact_guard now
        # holds back an invented number that doesn't appear in the "ලිපිය"
        # fixture article below, and this test only cares about token
        # totals, not distinct headline text.
        return GatewayResult(
            text="මාතෘකාව",
            provider="sinllama",
            latency_ms=10,
            meta={"input_tokens": 100, "output_tokens": 7},
        )

    monkeypatch.setattr(headline_service, "model_generate", _fake)

    await headline_service.generate_headlines("ලිපිය", count=3, user_id=_USER)

    [row] = fake_supabase.store["headline_generations"]
    assert row["input_tokens"] == 100 * calls["n"]
    assert row["output_tokens"] == 7 * calls["n"]


@pytest.mark.asyncio
async def test_provider_without_token_counts_stores_null_not_zero(monkeypatch, fake_supabase):
    """mock and openrouter report nothing; NULL keeps 'unknown' distinct
    from a genuine zero."""
    monkeypatch.setattr(grammar_service, "model_generate", _without_tokens("නිවැරදි"))

    await grammar_service.check_grammar("වැරදි", user_id=_USER)

    [row] = fake_supabase.store["grammar_corrections"]
    assert row["input_tokens"] is None
    assert row["output_tokens"] is None


# ── Forwarded to request_telemetry ──

@pytest.mark.asyncio
async def test_telemetry_records_token_counts(monkeypatch, fake_supabase, _profile):
    monkeypatch.setattr(grammar_service, "model_generate", _idempotent_with_tokens(12, 5))

    async with _client() as c:
        response = await c.post(
            "/api/v1/grammar/check", json={"text": "වැරදි"}, headers=_auth(_USER),
        )
    assert response.status_code == 200

    [row] = fake_supabase.store["request_telemetry"]
    assert row["input_tokens"] == 12
    assert row["output_tokens"] == 5
