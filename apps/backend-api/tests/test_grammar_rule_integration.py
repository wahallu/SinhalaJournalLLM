"""The validator sits between model generation and the public grammar result."""

import pytest

from app.core.model_gateway import GatewayResult
from app.services.grammar import grammar_service
from app.services.grammar.grammar_service import check_grammar
from app.services.grammar.lexicon import Suggestion


@pytest.mark.asyncio
async def test_number_change_is_removed_from_backend_output(monkeypatch):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text="අගය 200 කි", provider="sinllama", latency_ms=3)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)
    result = await check_grammar("අගය 100 කි")

    assert result.model_candidate == "අගය 200 කි"
    assert result.corrected == "අගය 100 කි"
    assert result.corrections == []
    assert result.validation.decision == "REJECT"
    assert result.validation.counts["rejected"] == 1
    assert result.validation.counts["hard_rejections"] == 1
    assert result.validation.counts["selectively_reverted"] == 1
    assert result.validation.counts["number_protections"] == 1


@pytest.mark.asyncio
async def test_ambiguous_change_is_exposed_as_structured_suggestion(monkeypatch):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text="ඔහු කළ වැඩය", provider="sinllama", latency_ms=3)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)
    result = await check_grammar("ඔහු කල වැඩය")

    assert result.corrected == "ඔහු කළ වැඩය"
    [edit] = result.validation.edits
    assert edit.decision == "SUGGEST"
    assert edit.rule_ids == ["AMBIG_KEEP_001"]
    assert edit.confidence is None
    assert edit.confidence_level == "LOW"
    assert result.validation.counts["advisory_warnings"] == 1
    assert result.validation.counts["hard_rejections"] == 0
    assert result.corrections[0].decision == "SUGGEST"


@pytest.mark.asyncio
async def test_applied_rule_ids_reach_correction_diff(monkeypatch):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text="පාසල්වල පොත් ඇත", provider="sinllama", latency_ms=3)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)
    result = await check_grammar("පාසල් වල පොත් ඇත")

    assert result.corrected == "පාසල්වල පොත් ඇත"
    assert result.corrections[0].decision == "ACCEPT"
    assert "CASE_ATTACH_001" in result.corrections[0].rule_ids


@pytest.mark.asyncio
async def test_validation_metadata_is_persisted_and_restorable(monkeypatch, fake_supabase):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text="ඔහු කළ වැඩය", provider="sinllama", latency_ms=3)

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)
    await check_grammar(
        "ඔහු කල වැඩය",
        user_id="55555555-5555-5555-5555-555555555555",
    )
    [record] = fake_supabase.store["grammar_corrections"]
    assert record["model_candidate"] == "ඔහු කළ වැඩය"
    assert record["validation"]["decision"] == "SUGGEST"


@pytest.mark.asyncio
async def test_validator_failure_degrades_to_existing_model_behavior(monkeypatch):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text="මම ගෙදර යනවා", provider="sinllama", latency_ms=3)

    class ExplodingValidator:
        def validate(self, *args, **kwargs):
            raise RuntimeError("validator unavailable")

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)
    monkeypatch.setattr(grammar_service, "get_rule_validator", lambda: ExplodingValidator())
    result = await check_grammar("මම ගෙදර යනව")

    assert result.corrected == "මම ගෙදර යනවා"
    assert result.validation.failed_open is True


@pytest.mark.asyncio
async def test_legacy_lexicon_cannot_bypass_ambiguous_pair_protection(monkeypatch):
    async def fake_model_generate(task, text, **_kwargs):
        return GatewayResult(text=text, provider="sinllama", latency_ms=3)

    def unsafe_lexicon(*args, **kwargs):
        return [Suggestion(position=4, original="කල", suggestion="කළ", seen=0, suggestion_seen=50)]

    monkeypatch.setattr(grammar_service, "model_generate", fake_model_generate)
    monkeypatch.setattr(grammar_service.lexicon, "check", unsafe_lexicon)
    result = await check_grammar("ඔහු කල වැඩය")

    assert result.corrected == "ඔහු කල වැඩය"
    assert result.suggestions == []
