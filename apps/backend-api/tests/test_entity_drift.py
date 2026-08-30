"""
Regression tests for headlines that name the wrong entity.

Reported case: an article about නේපාලයේ (Nepal) produced the top pick
"නෙදර්ලන්තයේ ගං වතුරෙන් මිය ගිය ගණන ඉහළට..." -- the Netherlands. Nothing in
the pipeline could see it:

  * nonsense_words() requires a word to be absent from BOTH the article and
    the 215k-article lexicon. "නෙදර්ලන්තයේ" is a perfectly real published
    Sinhala word, so the one guard that was armed was blind to it.
  * unverified_words() did contain it -- alongside five false positives.
    Sinhala inflects by suffix and compounds freely, so verbatim matching
    flagged "නේපාලය" (the *correct* country, the article writes "නේපාලයේ"),
    "වතුරෙන්" (the article writes "ගංවතුරින්"), "මිය" and "ගිය" (both inside
    the article's "මියගිය") and "ඉහළට" (the article has "ඉහළ"). One true flag
    in six, and documented as too heuristic to act on -- correctly, at the
    time.

The fix grounds words by stem rather than verbatim, which collapses all five
false positives, and then acts on what survives: an ungrounded word long enough is
a name, not a paraphrase, and a candidate carrying one is dropped whenever a
grounded candidate exists.
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

_WRONG_COUNTRY = "නෙදර්ලන්තයේ ගං වතුරෙන් මිය ගිය ගණන ඉහළට"
_RIGHT_COUNTRY = "නේපාලය තුළ ගං වතුරෙන් මිය ගිය ගණන ඉහළට"


def _stub(text: str) -> SimpleNamespace:
    return SimpleNamespace(
        text=text, provider="sinllama", latency_ms=1,
        meta={"adapter": "headline_sinllama_v19", "input_tokens": 1, "output_tokens": 1},
    )


async def _persist(fn, record, user_id, actor):
    return {"id": "test-id", "created_at": None}


# ── grounding ──

def test_inflection_and_compounds_no_longer_false_flag():
    """The five words verbatim matching got wrong, all grounded by stem."""
    for word in ["නේපාලය", "වතුරෙන්", "මිය", "ගිය", "ඉහළට"]:
        headline = f"පුවත {word}"
        assert word not in fact_guard.unverified_words(_ARTICLE, headline), word


def test_the_wrong_country_is_flagged():
    assert "නෙදර්ලන්තයේ" in fact_guard.unverified_words(_ARTICLE, _WRONG_COUNTRY)
    assert fact_guard.drifted_entities(_ARTICLE, _WRONG_COUNTRY) == ["නෙදර්ලන්තයේ"]


def test_the_right_country_is_not_flagged():
    assert fact_guard.drifted_entities(_ARTICLE, _RIGHT_COUNTRY) == []


def test_a_short_synonym_is_not_treated_as_a_drifted_entity():
    """"ගණන" (count) is ungrounded -- the article says "සංඛ්‍යාව" -- but it is
    ordinary vocabulary, not a name. It ranks a candidate down; it must not
    drop one, or a paraphrase would be treated like a wrong country."""
    assert "ගණන" in fact_guard.unverified_words(_ARTICLE, _WRONG_COUNTRY)
    assert "ගණන" not in fact_guard.drifted_entities(_ARTICLE, _WRONG_COUNTRY)


def test_the_lexicon_guard_could_never_have_caught_this():
    """Why a new check was needed rather than a tweak to the old one."""
    from app.services.grammar import lexicon

    assert lexicon.contains("නෙදර්ලන්තයේ")
    assert fact_guard.nonsense_words(_ARTICLE, _WRONG_COUNTRY) == []


# ── service ──

@pytest.mark.asyncio
async def test_wrong_country_candidate_is_dropped_when_a_right_one_exists(monkeypatch):
    """The reported failure: the drifted candidate must not reach the caller
    at all, not merely rank below the grounded one."""

    async def fake(task, text, *, variation_hint=None, **kwargs):
        if (variation_hint or "").startswith("good"):
            return _stub(_RIGHT_COUNTRY)
        return _stub(_WRONG_COUNTRY)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["bad", "good"])
    monkeypatch.setattr(hs, "model_generate", fake)
    monkeypatch.setattr(hs, "persist_if_owned", _persist)

    result = await hs.generate_headlines(_ARTICLE, count=2, length="long")

    assert "නෙදර්ලන්තයේ" not in "".join(result.headlines)
    assert result.headlines == [_RIGHT_COUNTRY]


@pytest.mark.asyncio
async def test_drifted_candidate_is_kept_when_nothing_cleaner_exists(monkeypatch):
    """Deliberately conditional. The length floor that separates a name from a
    paraphrase is a proxy, so dropping unconditionally would empty batches
    over a synonym -- worse than showing an imperfect headline."""

    async def fake(task, text, *, variation_hint=None, **kwargs):
        return _stub(_WRONG_COUNTRY)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["a", "b"])
    monkeypatch.setattr(hs, "model_generate", fake)
    monkeypatch.setattr(hs, "persist_if_owned", _persist)

    result = await hs.generate_headlines(_ARTICLE, count=2, length="long")

    assert result.headlines, "an imperfect headline beats an empty response"
    assert result.fact_checks[0].drifted_entities == ["නෙදර්ලන්තයේ"]


@pytest.mark.asyncio
async def test_the_retry_names_the_drifted_entity(monkeypatch):
    """A generic "stay factual" nudge gives the model nothing to correct."""
    hints_seen: list[str] = []

    async def fake(task, text, *, variation_hint=None, **kwargs):
        hints_seen.append(variation_hint or "")
        return _stub(_WRONG_COUNTRY)

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", [""])
    monkeypatch.setattr(hs, "model_generate", fake)
    monkeypatch.setattr(hs, "persist_if_owned", _persist)

    await hs.generate_headlines(_ARTICLE, count=1, length="long")

    assert any("නෙදර්ලන්තයේ" in h for h in hints_seen)
