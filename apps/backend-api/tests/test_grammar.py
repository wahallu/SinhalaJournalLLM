"""
Tests for the Grammar Checker API and correction derivation.

MODEL_PROVIDER=mock in .env keeps these offline: the mock provider applies
the rule table in app/core/mock_provider.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.model_gateway import GatewayResult
from app.main import app
from app.services.grammar import grammar_service
from app.services.grammar.grammar_service import (
    _pick_consensus,
    _sanitize_correction,
    check_grammar,
    derive_corrections,
)
from test_user_scoping import TEST_SECRET, _auth

# A signed-in caller for the history test below — history is per-user since
# Phase 1, so persisting and then reading it back both need a real subject.
_HISTORY_USER = "44444444-4444-4444-4444-444444444444"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")




@pytest.fixture
def _history_profile(fake_supabase):
    """A profile row for _HISTORY_USER, so require_user resolves it instead of 401ing."""
    fake_supabase.store["profiles"] = [
        {"id": _HISTORY_USER, "email": "history@sinai.lk", "role": "user",
         "status": "active", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_root():
    """Health check endpoint returns OK."""
    async with _client() as client:
        response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health():
    """Liveness probe stays fast and dependency-free."""
    async with _client() as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_grammar_check_empty_text():
    """Grammar check rejects empty text."""
    async with _client() as client:
        response = await client.post("/api/v1/grammar/check", json={"text": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_grammar_check_valid_text():
    """Grammar check corrects text and reports the corrections."""
    async with _client() as client:
        response = await client.post(
            "/api/v1/grammar/check",
            json={"text": "මම ගෙදර යනව"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "යනවා" in data["corrected"]
    assert data["correction_count"] >= 1
    assert data["corrections"][0]["original"] == "යනව"
    assert data["corrections"][0]["corrected"] == "යනවා"
    assert data["model_used"] == "mock"
    assert data["id"]


@pytest.mark.asyncio
async def test_grammar_history_after_check(fake_supabase, _history_profile):
    """A check lands in the paginated history feed."""
    # History is per-user since Phase 1 — these calls need a signed-in caller.
    headers = _auth(_HISTORY_USER)
    async with _client() as client:
        await client.post(
            "/api/v1/grammar/check", json={"text": "මම ගෙදර යනව"}, headers=headers,
        )
        response = await client.get(
            "/api/v1/grammar/history?page=1&page_size=10", headers=headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["corrected"] == "මම ගෙදර යනවා"


def test_derive_corrections_word_replacement():
    """Word-level diff pinpoints the changed token and its offset."""
    corrections = derive_corrections("මම ගෙදර යනව", "මම ගෙදර යනවා")
    assert len(corrections) == 1
    assert corrections[0].original == "යනව"
    assert corrections[0].corrected == "යනවා"
    assert corrections[0].position == 8  # offset of යනව in the original


def test_derive_corrections_no_change():
    """Identical texts produce no corrections."""
    assert derive_corrections("මම ගෙදර යනවා", "මම ගෙදර යනවා") == []


# ── _sanitize_correction ──
# Mirrors test_grammar.py (SinAI-Training)'s correct_sentence() safety net:
# production's stop sequences don't catch a bare newline the way the eval
# harness's NewlineStoppingCriteria does, so anything past the first line is
# discarded rather than shipped to the diff/UI.

def test_sanitize_correction_takes_first_line_only():
    raw = "නිවැරදි කළ පාඨය\nඅමතර පේළියක්"
    assert _sanitize_correction(raw, fallback="original") == "නිවැරදි කළ පාඨය"


def test_sanitize_correction_falls_back_on_empty_output():
    assert _sanitize_correction("", fallback="original") == "original"
    assert _sanitize_correction(None, fallback="original") == "original"


def test_sanitize_correction_falls_back_on_too_short_output():
    """Mirrors correct_sentence()'s `len(result) < 2` guard against garbage."""
    assert _sanitize_correction("a", fallback="original") == "original"


def test_sanitize_correction_strips_whitespace():
    assert _sanitize_correction("  නිවැරදි කළ පාඨය  \n", fallback="original") == "නිවැරදි කළ පාඨය"


def test_sanitize_correction_passes_through_normal_output():
    assert _sanitize_correction("නිවැරදි කළ පාඨය", fallback="original") == "නිවැරදි කළ පාඨය"


# ── _pick_consensus ──
# Self-consistency selection over N sampled candidates: the candidate most
# representative of the set (highest average similarity to the others), not
# a token-level majority vote — free-text outputs don't align cleanly enough
# for that, but a medoid over whole-string similarity is easy to reason about
# and needs no model access to test.

def test_pick_consensus_single_candidate():
    assert _pick_consensus(["only one"]) == "only one"


def test_pick_consensus_empty_list():
    assert _pick_consensus([]) == ""


def test_pick_consensus_ignores_blank_candidates():
    assert _pick_consensus(["", "the answer", ""]) == "the answer"


def test_pick_consensus_picks_the_majority_agreement():
    """Two candidates agree closely, one is a clear outlier — the outlier must lose."""
    candidates = [
        "ශ්‍රී ලංකා කණ්ඩායම ජයග්‍රහණය කළා.",
        "ශ්‍රී ලංකා කණ්ඩායම ජයග්‍රහණය කළේය.",
        "මුළුමනින්ම වෙනස් වාක්‍යයක් මෙතන තියෙනවා.",
    ]
    result = _pick_consensus(candidates)
    assert result in candidates[:2]


def test_pick_consensus_ties_favor_first_candidate():
    """Equidistant candidates resolve deterministically to the first (canonical) one."""
    candidates = ["aaaa", "bbbb", "cccc"]
    assert _pick_consensus(candidates) == "aaaa"


# ── Single-pass correction ──
# check_grammar() used to re-run the model on its own output once when the
# first pass changed something (MAX_PASSES=2). Removed: every changed request
# cost two full GPU round trips, and the result was a correction of the
# model's own first-pass output rather than of the original article — a
# different generation from a single-pass run over the same text, not just a
# slower one. These tests pin the replacement: exactly one call, always,
# whatever the model returns.

@pytest.mark.asyncio
async def test_check_grammar_calls_the_model_exactly_once(monkeypatch):
    """Even when the output differs from the input, there is no second call."""
    calls: list[str] = []

    async def fake_model_generate(task, text, **_kwargs):
        calls.append(text)
        return GatewayResult(text="fixed once", provider="mock", latency_ms=5)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)

    result = await check_grammar("input with an error")

    assert result.corrected == "fixed once"
    assert calls == ["input with an error"]


@pytest.mark.asyncio
async def test_check_grammar_returns_the_model_output_unchanged_when_correct(monkeypatch):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text=text, provider="mock", latency_ms=5)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)

    result = await check_grammar("already correct sentence")

    assert result.corrected == "already correct sentence"


@pytest.mark.asyncio
async def test_check_grammar_persists_the_single_call_latency(monkeypatch, fake_supabase):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text="halfway fixed", provider="mock", latency_ms=30)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)

    result = await check_grammar("needs fixing", user_id="55555555-5555-5555-5555-555555555555")

    assert result.corrected == "halfway fixed"
    [record] = fake_supabase.store["grammar_corrections"]
    assert record["latency_ms"] == 30


# ── Adapter capture (admin-diagnostics only, never user-facing) ──

@pytest.mark.asyncio
async def test_adapter_is_persisted_but_not_returned_to_the_caller(monkeypatch, fake_supabase):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(
            text=text, provider="sinllama", latency_ms=5,
            meta={"adapter": "grammar_sinllama_v13"},
        )

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)

    result = await check_grammar("text", user_id="55555555-5555-5555-5555-555555555555")

    [record] = fake_supabase.store["grammar_corrections"]
    assert record["adapter"] == "grammar_sinllama_v13"
    assert "adapter" not in result.model_dump()
    assert "adapter" not in result.model_dump_json()


@pytest.mark.asyncio
async def test_grammar_check_endpoint_response_never_contains_the_adapter(monkeypatch):
    """End-to-end: the HTTP response body itself must not carry it."""
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(
            text=text, provider="sinllama", latency_ms=5,
            meta={"adapter": "grammar_sinllama_v13"},
        )

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)

    async with _client() as client:
        response = await client.post("/api/v1/grammar/check", json={"text": "text"})

    assert response.status_code == 200
    assert "grammar_sinllama_v13" not in response.text
    assert "adapter" not in response.json()
