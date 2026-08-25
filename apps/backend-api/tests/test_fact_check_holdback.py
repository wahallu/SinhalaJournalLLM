"""
Regression test for holding back headline candidates with invented numbers.

Before this fix, a candidate whose number didn't check out against the
article survived the fact-check retry round and still reached the caller --
just reranked to the bottom, with fact_checks flagging it. In production this
showed up as: article says "796.92 (million)", the model rounds it to "800",
the corrective retry produces "800" again (rounding is a systematic model
behavior, not a random slip a generic hint reliably fixes), and the headline
with the wrong number still gets shown to the user with only a small warning
badge -- see the reported case in this repo's chat history.

The fix: a candidate that still fails fact_guard.unverified_numbers() after
the retry round is dropped from the response entirely, as long as at least
one verified candidate survives elsewhere in the batch to take its place.
"""

import pytest
from types import SimpleNamespace

from app.services.headline import headline_service as hs

_ARTICLE = (
    "කොළඹ කොටස් වෙළදපොළ අද (25) දිනයේ ගනුදෙනු අවසානයේ සමස්ත කොටස් මිල දර්ශකය "
    "(ASPI) ඒකක 65.12 කින් පහත වැටීමක් සටහන් කරමින් ලකුණු 21,279.65 ක් ලෙස "
    "සටහන් විය. එමෙන්ම, දිනය තුළ වාර්තා වූ සමස්ත පිරිවැටුම රුපියල් මිලියන "
    "796.92 ක් ලෙස සටහන් වූ බවයි."
)


def _stub_result(text: str) -> SimpleNamespace:
    return SimpleNamespace(
        text=text, provider="mock", latency_ms=1,
        meta={"adapter": "headline_sinllama_v19", "input_tokens": 10, "output_tokens": 5},
    )


@pytest.mark.asyncio
async def test_uncorrectable_wrong_number_is_dropped_when_a_clean_candidate_exists(monkeypatch):
    """Mirrors the reported case: two candidates round 796.92 to 800 and the
    retry can't fix it (same systematic rounding both times), one candidate
    is already correct. The wrong-number candidates must not reach the
    response at all -- not just get reranked below the correct one.

    Keyed strictly off the variation hint text rather than call order, since
    asyncio.gather doesn't guarantee the fan-out resolves in slot order."""

    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        if variation_hint == "clean":
            return _stub_result("කොටස් දර්ශකය පහත")  # 3 words, in the "short" band
        # Both the initial "bad1"/"bad2" slots and their retries (which get
        # the specific-number hint appended, still containing "bad1"/"bad2")
        # round the same way every time -- a systematic model behavior a
        # generic corrective can't fix.
        return _stub_result("වෙළඳපොළ වාර්තාව රු.මී. 800")  # 4 words, in the "short" band

    async def fake_persist_if_owned(fn, record, user_id, actor):
        return {"id": "test-id", "created_at": None}

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["clean", "bad1", "bad2"])
    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", fake_persist_if_owned)

    result = await hs.generate_headlines(_ARTICLE, count=3, length="short")

    assert "රු.මී. 800" not in "".join(result.headlines)
    assert len(result.headlines) == 1
    assert all(fc.numbers_verified for fc in result.fact_checks)


@pytest.mark.asyncio
async def test_keeps_flagged_candidates_when_none_verify(monkeypatch):
    """If every candidate still has a bad number after the retry, the tool
    must not return an empty result -- the least-bad option ships, still
    flagged in fact_checks, exactly as before this fix."""
    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        return _stub_result("වෙළඳපොළේ දෛනික පිරිපහදුව රු.මී. 800 ඉක්මවයි")

    async def fake_persist_if_owned(fn, record, user_id, actor):
        return {"id": "test-id", "created_at": None}

    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", fake_persist_if_owned)

    result = await hs.generate_headlines(_ARTICLE, count=2, length="long")

    assert len(result.headlines) >= 1
    assert all(not fc.numbers_verified for fc in result.fact_checks)
