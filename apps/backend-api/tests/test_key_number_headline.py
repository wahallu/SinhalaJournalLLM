"""
Regression tests for headlines that drop the article's key figure.

Reported case: an article stating that 734 people died in Nepal's flash
floods produced the top pick "නේපාලයට බලපෑ ගංවතුර නිසා ජීවිතක්ෂයට පත්වෙයි"
-- floods, deaths, no count. The number is the story, so a headline without
it is close to contentless.

The cause was that every number mechanism in the pipeline pointed one way.
fact_guard.unverified_numbers() is empty for a headline containing no number
at all, so such a headline is "numbers_verified" and the reranker saw it as
tied with one that correctly reports 734; meanwhile a candidate that *does*
attempt a number can be retried and then held back entirely if it gets it
wrong. Across a fan-out that selects for figureless output.

The fix adds the missing direction in the three places the existing signals
already live: fact_guard gains salient_numbers()/includes_article_number()/
missing_key_numbers(), the service merges a hint naming the article's own
digits into every fan-out slot, retries a figureless candidate once, and
ranks a figure-carrying headline above a figureless one. It deliberately
does NOT hold figureless candidates back -- unlike an invented number, a
missing one is weaker rather than wrong, and an empty response is worse.
"""

import pytest
from types import SimpleNamespace

from app.core import fact_guard
from app.services.headline import headline_service as hs


_ARTICLE = (
    "නේපාලයේ හටගත් හදිසි ගංවතුර තත්ත්වය හේතුවෙන් මියගිය පුද්ගලයින් සංඛ්‍යාව "
    "734 දක්වා ඉහළ ගොස් ඇති බව එරට බලධාරීන් තහවුරු කරනවා. එමෙන්ම තවත් "
    "2,400කට වැඩි පිරිසක් තවමත් අතුරුදහන්ව සිටින බවද වාර්තා වනවා."
)

# Both 7 words -> in the "medium" band (6-7), and built only from words that
# appear in _ARTICLE verbatim, so neither can be dropped by the nonsense-word
# hold-back and the tests isolate the key-number behaviour.
_FIGURELESS = "නේපාලයේ ගංවතුර තත්ත්වය හේතුවෙන් මියගිය සංඛ්‍යාව ඉහළ"
_NUMBERED = "නේපාලයේ ගංවතුර හේතුවෙන් මියගිය සංඛ්‍යාව 734 දක්වා"


_NO_NUMBER_ARTICLE = (
    "අම්බලන්ගොඩ නගර මධ්‍යයේ ලැඟුම්හලක මියගොස් සිටි පුද්ගලයෙකුගේ මළ සිරුරක් "
    "සොයා ගත් බව පොලීසිය පවසනවා."
)


def _stub_result(text: str) -> SimpleNamespace:
    return SimpleNamespace(
        text=text, provider="mock", latency_ms=1,
        meta={"adapter": "headline_sinllama_v19", "input_tokens": 10, "output_tokens": 5},
    )


async def _fake_persist(fn, record, user_id, actor):
    return {"id": "test-id", "created_at": None}


# ── fact_guard ──

def test_salient_numbers_reads_the_articles_lead():
    assert fact_guard.salient_numbers(_ARTICLE) == ["734", "2,400"]


def test_salient_numbers_skips_calendar_furniture():
    """A dateline "(25)" and a bare year are not the story's figure -- putting
    either in a headline as "the key number" is worse than no number."""
    article = "අද (25) දිනයේ 2024 වර්ෂයේ වාර්තා අනුව රෝගීන් 312ක් සොයාගෙන ඇත."
    assert fact_guard.salient_numbers(article) == ["312"]


def test_salient_numbers_empty_for_an_article_with_no_figure():
    """The signal that this simply isn't a numbers story, so nothing
    downstream should push a number into its headline."""
    article = "අම්බලන්ගොඩ ප්‍රදේශයේ මළ සිරුරක් සොයා ගත් බව පොලීසිය පවසනවා."
    assert fact_guard.salient_numbers(article) == []


def test_missing_key_numbers_flags_a_headline_that_dropped_the_figure():
    assert fact_guard.missing_key_numbers(_ARTICLE, _FIGURELESS) == ["734", "2,400"]


def test_missing_key_numbers_empty_when_the_headline_carries_the_figure():
    assert fact_guard.missing_key_numbers(_ARTICLE, _NUMBERED) == []


def test_a_figureless_headline_is_numbers_verified_but_not_key_number_included():
    """The exact blind spot this adds: the old check calls a headline with no
    number "verified", because it has no number to get wrong."""
    check = fact_guard.check_headline(_ARTICLE, _FIGURELESS)
    assert check.numbers_verified is True
    assert check.key_number_included is False

    numbered = fact_guard.check_headline(_ARTICLE, _NUMBERED)
    assert numbered.numbers_verified is True
    assert numbered.key_number_included is True


# ── service ──

def test_prompt_states_the_number_as_a_rule_not_a_trailing_hint():
    """It was a trailing hint first, merged onto every variation slot, and the
    live model ignored it in all four candidates it returned (each came back
    key_number_included=false). A hint sits after "Output ONLY the headline,
    nothing else"; the requirement belongs in the rules block."""
    from app.core.prompts import prompt_headline

    rules = prompt_headline(_ARTICLE, length="long").split("### Input")[0]
    assert "MUST include the number 734" in rules
    # Before "Output ONLY ...", not appended after it.
    assert rules.index("MUST include the number") < rules.index("Output ONLY")


def test_prompt_states_no_number_rule_for_an_article_without_one():
    from app.core.prompts import prompt_headline

    rules = prompt_headline(_NO_NUMBER_ARTICLE, length="long").split("### Input")[0]
    assert "MUST include the number" not in rules


@pytest.mark.asyncio
async def test_figureless_candidate_is_retried_into_a_numbered_one(monkeypatch):
    """The repair path the invented-number round always had, mirrored for the
    opposite failure."""

    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        # The missing-number retry hint names the omission itself as the
        # error; only that call gets the numbered headline back.
        if "අසම්පූර්ණය" in (variation_hint or ""):
            return _stub_result(_NUMBERED)
        return _stub_result(_FIGURELESS)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["", "b"])
    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", _fake_persist)

    result = await hs.generate_headlines(_ARTICLE, count=2, length="medium")

    assert result.headlines == [_NUMBERED]
    assert result.fact_checks[0].key_number_included is True


@pytest.mark.asyncio
async def test_numbered_candidate_outranks_the_figureless_one(monkeypatch):
    """Slot 0 is the canonical prompt and wins every tie the reranker can't
    break. Before the fix this was such a tie -- both candidates are
    numbers_verified and equally grounded -- so the figureless headline took
    the TOP PICK spot."""

    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        # Slot 0 never produces a figure, retry included.
        if (variation_hint or "").startswith("slot0"):
            return _stub_result(_FIGURELESS)
        return _stub_result(_NUMBERED)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["slot0", "slot1"])
    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", _fake_persist)

    result = await hs.generate_headlines(_ARTICLE, count=2, length="medium")

    assert result.headlines[0] == _NUMBERED
    assert _FIGURELESS in result.headlines


@pytest.mark.asyncio
async def test_figureless_headline_is_ranked_down_not_held_back(monkeypatch):
    """Deliberate asymmetry with the invented-number hold-back: a missing
    number is weaker, not wrong, so an all-figureless batch still returns a
    headline rather than raising HeadlineQualityExhausted."""

    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        return _stub_result(_FIGURELESS)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["", "b"])
    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", _fake_persist)

    result = await hs.generate_headlines(_ARTICLE, count=2, length="medium")

    assert result.headlines == [_FIGURELESS]
    assert result.fact_checks[0].key_number_included is False


@pytest.mark.asyncio
async def test_no_number_is_pushed_when_the_article_reports_none(monkeypatch):
    """The whole mechanism is inert on a non-numeric article: no hint is
    merged and no retry round runs, so a story with no figure can't be
    pressured into inventing one."""
    seen: list[str | None] = []
    calls = 0

    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        nonlocal calls
        calls += 1
        seen.append(variation_hint)
        return _stub_result("අම්බලන්ගොඩ ලැඟුම්හලක මියගොස් සිටි පුද්ගලයෙකුගේ සිරුර")

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["", "b"])
    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", _fake_persist)

    result = await hs.generate_headlines(_NO_NUMBER_ARTICLE, count=2, length="medium")

    assert seen == [None, "b"]  # untouched fan-out hints
    assert calls == 2  # no extra round
    assert result.fact_checks[0].key_number_included is True
