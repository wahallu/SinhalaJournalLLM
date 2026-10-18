"""Deterministic grammar rules for news Sinhala (journal_rules.py)."""

import json
from collections import Counter
from pathlib import Path

import pytest

from app.core import runtime_settings
from app.core.model_gateway import GatewayResult
from app.services.grammar import grammar_service
from app.services.grammar.grammar_service import check_grammar, derive_corrections
from app.services.grammar.journal_rules import apply

_DEMO = json.loads(
    (Path(__file__).parent / "data" / "grammar_demo_articles.json").read_text(encoding="utf-8")
)["articles"]


@pytest.mark.parametrize("article", _DEMO, ids=[a["id"] for a in _DEMO])
def test_demo_article_is_corrected_exactly(article):
    corrected, hits = apply(article["input"])

    assert corrected == article["expected"]
    assert Counter(h.rule_id for h in hits) == Counter(e["rule_id"] for e in article["errors"])


@pytest.mark.parametrize("article", _DEMO, ids=[a["id"] for a in _DEMO])
def test_corrected_article_is_left_alone(article):
    corrected, hits = apply(article["expected"])

    assert corrected == article["expected"]
    assert hits == []


@pytest.mark.parametrize(
    "text",
    [
        # ablative is already right for questioning someone
        "සාක්ෂිකරු පිටව යද්දී ඔහුගෙන් මාධ්‍යවේදීන් ප්‍රශ්න කළහ.",
        # things are counted with -ක්, and a quantity comparison is not a head count
        "නිවාස 120ක් විනාශ විය.",
        "රෝගීන් 1,200කට අධික සංඛ්‍යාවක් වාර්තා විය.",
        # the time word belongs to the purpose clause, not the main verb
        "අධිකරණය නඩුව ලබන සතියේ නැවත කැඳවීමට නියෝග කළේය.",
        # ලබන as "receiving" is not a time word
        "ප්‍රතිකාර ලබන රෝගීන් පිළිබඳව රෝහල් අධ්‍යක්ෂවරයා සඳහන් කළේය.",
        # විසින් inside a relative clause does not govern the main verb
        "පොලිසිය විසින් සිදු කළ විමර්ශනයේදී සැකකරු ප්‍රකාශ කළේය.",
        # a coordinated subject is left to a human
        "ඔහු සහ ඇය එම ස්ථානයට ගියහ.",
        # a cleft already closed by a focused noun
        "මෙසේ ප්‍රකාශ කළේ පොලිස් මාධ්‍ය ප්‍රකාශකවරයාය.",
        # request to an institution: -ගෙන් would be wrong for an inanimate noun
        "සංගමය රජයට ඉල්ලීමක් කළේය.",
    ],
)
def test_correct_constructions_are_not_touched(text):
    assert apply(text) == (text, [])


def test_decimal_time_does_not_split_a_sentence():
    text = "රාත්‍රී 10.00ට පසු යන්ත්‍ර භාවිතය සීමා කළ යුතු බව නිලධාරීහු ප්‍රකාශ කළේය."
    corrected, [hit] = apply(text)
    assert corrected.endswith("නිලධාරීහු ප්‍රකාශ කළහ.")
    assert hit.rule_id == "GRAM_AGR_001"


def test_case_suffix_swap_is_labelled_grammar_not_spelling():
    [case] = derive_corrections("ජනතාවගෙන් අනතුරු ඇඟවීය.", "ජනතාවට අනතුරු ඇඟවීය.")
    [agreement] = derive_corrections("නිලධාරීහු කළේය.", "නිලධාරීහු කළහ.")
    [spelling] = derive_corrections("බරපතල හානි", "බරපතළ හානි")

    assert case.type == "grammar"
    assert agreement.type == "grammar"
    assert spelling.type == "spelling"


@pytest.mark.asyncio
async def test_pipeline_applies_and_labels_rule_corrections(monkeypatch):
    article = next(a for a in _DEMO if a["id"] == "weather")

    async def echo_model(task, text, **_kwargs):
        # The model changes nothing — every edit below comes from the rules.
        return GatewayResult(text=text, provider="sinllama", latency_ms=3)

    monkeypatch.setattr(grammar_service, "model_generate", echo_model)
    result = await check_grammar(article["input"])

    assert result.corrected == article["expected"]
    assert result.corrections
    assert all(c.rule_ids and not c.suspicious for c in result.corrections)
    by_type = Counter(c.type for c in result.corrections)
    assert by_type == {"grammar": 9, "spelling": 2}
    case = next(c for c in result.corrections if c.original == "ජනතාවගෙන්")
    assert case.corrected == "ජනතාවට"
    assert case.rule_ids == ["GRAM_CASE_DATIVE_001"]
    assert "විභක්ති" in case.rule


@pytest.mark.asyncio
async def test_rules_can_be_switched_off(monkeypatch):
    real_get = runtime_settings.get

    async def settings_get(key):
        return False if key == "grammar.journal_rules_enabled" else await real_get(key)

    async def echo_model(task, text, **_kwargs):
        return GatewayResult(text=text, provider="sinllama", latency_ms=3)

    monkeypatch.setattr(runtime_settings, "get", settings_get)
    monkeypatch.setattr(grammar_service, "model_generate", echo_model)
    text = "නිලධාරීහු ජනතාවගෙන් අනතුරු ඇඟවීය."
    result = await check_grammar(text)

    assert result.corrected == text
    assert result.corrections == []
