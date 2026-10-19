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
        # The cases below were false alarms on published news while tuning.
        # counting people with -ක් is normal news usage (and the team's own gold keeps it)
        "අනතුරෙන් පුද්ගලයින් 2ක් ජීවිතක්ෂයට පත්ව ඇත.",
        # "obtain advice from" is ablative and right
        "ඒ පිළිබඳ අප නීතිපතිවරයාගෙන් උපදෙස් ලබා ගත්තා.",
        # a beneficiary -ට with an object between it and the verb
        "කතෝලික ජනතාවට යුක්තිය ඉල්ලා සිටිමින් ඔවුහු විරෝධතාවක් පැවැත්වූහ.",
        # experiencer -ට of හැකි
        "එය සඳහා ඔහුට ඉල්ලා සිටිය හැකිය.",
        # "X including Y" subject, monk honorific, embedded subjects, passive auxiliary
        "සෙව්වන්දි මහත්මිය ඇතුළු නිලධාරීහු සැකකරුවන් අත්අඩංගුවට ගත්හ.",
        "මහානායක හිමියෝ මෙහිදී විමසා සිටියහ.",
        "වලාකුළක් සේ එක්වර ම ගෞරි ඔහු කියවමින් හුන් තැනට දිව ආවාය.",
        "සිය චිත්‍රපටයේ ප්‍රධාන චරිතයට ඇය තෝරා ගනු ලැබීය.",
        # the time word modifies a relative clause, or names a span
        "ඊයේ දින සිදු වූ ගනුදෙනුව සමඟ කොටස් ප්‍රමාණය වැඩි වනු ඇත.",
        "පනත ඊයේ (27) සිට බලාත්මක වනු ඇත.",
        "අභියෝග ජයගත් හෙට දිනක් මෙවර තේමාව විය.",
        # "මේ බව පැවසුවේ <occasion>" already names the content; direct speech without quotes
        "ඇය මේ බව කියා සිටියේ ඊයේ පැවති මාධ්‍ය හමුවක් අමතමිනි.",
        "ගොවි මහතා පැවසුවේ මේක නම් හොරට කපාගෙන ආපු එකක්.",
        # an event verb agrees with the event, not with a person named earlier
        "ඇය සිටි කාර්යාලයේ දී ගාලගෝට්ටියක් හට ගත්තේය.",
        # quoted speech is reported as spoken
        "“නිලධාරීහු ඊයේ පැමිණියා” යැයි ඔහු පැවසීය.",
    ],
)
def test_correct_constructions_are_not_touched(text):
    assert apply(text) == (text, [])


@pytest.mark.parametrize(
    "text, expected, rule_id",
    [
        ("කලාප වල පිහිටි නිවාස.", "කලාපවල පිහිටි නිවාස.", "GRAM_CASE_ATTACH_001"),
        ("ඊශ්‍රායල් ජාතිකයන් ගේ ගුවන් ගමන් නතර විය.", "ඊශ්‍රායල් ජාතිකයන්ගේ ගුවන් ගමන් නතර විය.", "GRAM_CASE_ATTACH_001"),
        ("දෙපාර්තමේන්තුවේ නිලධාරීහු සඳහන් කළා.", "දෙපාර්තමේන්තුවේ නිලධාරීහු සඳහන් කළහ.", "GRAM_REGISTER_001"),
        ("ඇති බව ප්‍රදේශවාසීහු පවසනවා.", "ඇති බව ප්‍රදේශවාසීහු පවසති.", "GRAM_REGISTER_001"),
        ("ඒ බව සෞඛ්‍ය අමාත්‍යවරිය පැවසීය.", "ඒ බව සෞඛ්‍ය අමාත්‍යවරිය පැවසුවාය.", "GRAM_AGR_001"),
        ("ඒ බව හෙතෙම පෙන්වා දුන්හ.", "ඒ බව හෙතෙම පෙන්වා දුන්නේය.", "GRAM_AGR_001"),
        ("හාලිඇල පොලිසිය වැඩිදුර පරීක්ෂණ පවත්වති.", "හාලිඇල පොලිසිය වැඩිදුර පරීක්ෂණ පවත්වයි.", "GRAM_AGR_001"),
        ("සංවිධායකවරු ඉල්ලා අස්වීමට තීරණය කරයි.", "සංවිධායකවරු ඉල්ලා අස්වීමට තීරණය කරති.", "GRAM_AGR_001"),
        ("ඇමතිවරයා මේ බව පැවසුවේ උත්සවය අමතමින්.", "ඇමතිවරයා මේ බව පැවසුවේ උත්සවය අමතමිනි.", "GRAM_CLEFT_FOCUS_001"),
        ("ප්‍රියදර්ශනී විසින් ජයග්‍රහණය දිනා ගත්තාය.", "ප්‍රියදර්ශනී විසින් ජයග්‍රහණය දිනා ගන්නා ලදී.", "GRAM_VOICE_001"),
        ("ජනාධිපතිතුමා විසින් විවෘත කිරීම සිදුකළේය.", "ජනාධිපතිතුමා විසින් විවෘත කිරීම සිදුකරන ලදී.", "GRAM_VOICE_001"),
    ],
)
def test_published_news_errors_are_corrected(text, expected, rule_id):
    corrected, hits = apply(text)
    assert corrected == expected
    assert [h.rule_id for h in hits] == [rule_id]


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


@pytest.mark.parametrize(
    "original, corrected, kind",
    [
        # grammar: the word's grammatical form changes (case, number, register, tense)
        ("නිලධාරීන් පැමිණියහ.", "නිලධාරීහු පැමිණියහ.", "grammar"),
        ("ඔවුන් පරීක්ෂණ පවත්වනවා.", "ඔවුන් පරීක්ෂණ පවත්වති.", "grammar"),
        ("ඔවුහු සහාය ලබා ගත්තා.", "ඔවුහු සහාය ලබා ගත්හ.", "grammar"),
        ("ඔහු නිවස හැදුවා.", "ඔහු නිවස හදනවා.", "grammar"),
        # spelling: the same word, different letters
        ("සමුළුව පිලිබද", "සමුළුව පිළිබඳ", "spelling"),
        ("ප්‍රධානින්ගේ රැස්වීම", "ප්‍රධානීන්ගේ රැස්වීම", "spelling"),
        # two neighbouring spelling fixes merged by the diff stay spelling
        ("සංඛා ලේකන", "සංඛ්‍යා ලේඛන", "spelling"),
    ],
)
def test_model_edits_are_labelled_by_what_changed(original, corrected, kind):
    corrections = derive_corrections(original, corrected)
    assert {c.type for c in corrections} == {kind}


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
    key = Counter("spelling" if e["rule_id"].startswith("SPELL") else "grammar" for e in article["errors"])
    assert by_type == key
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
