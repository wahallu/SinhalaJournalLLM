"""
Regression tests for holding back headline candidates with invented numbers
or nonsense (garbled/invented) words.

Before the first fix, a candidate whose number didn't check out against the
article survived the fact-check retry round and still reached the caller --
just reranked to the bottom, with fact_checks flagging it. In production this
showed up as: article says "796.92 (million)", the model rounds it to "800",
the corrective retry produces "800" again (rounding is a systematic model
behavior, not a random slip a generic hint reliably fixes), and the headline
with the wrong number still gets shown to the user with only a small warning
badge -- see the reported case in this repo's chat history.

Separately, a generated headline sometimes contains a garbled/invented word
that isn't a real published word and isn't something the article said either
-- e.g. "හමුවෙයිල" (not a real inflected form of the verb "හමුවෙනවා") where
the correct word "හමුවෙයි" was reported. fact_guard.nonsense_words() catches
this by requiring a content word to fail *both* article-grounding and the
shared Sinhala lexicon, so it doesn't false-flag genuine rare entity names.

The fix for both: a candidate that still fails fact_guard.unverified_numbers()
or fact_guard.nonsense_words() after its retry round is dropped from the
response entirely -- unconditionally, even if that empties the whole batch,
per an explicit decision that a flagged headline must never be shown, not
even as a last resort. When the batch does end up empty, generate_headlines()
raises HeadlineQualityExhausted, and the API layer (app/api/v1/headline.py)
turns that into a clean 422 rather than a flagged result or an unhandled 500.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from types import SimpleNamespace

from app.main import app
from app.services.headline import headline_service as hs


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

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


_BODY_ARTICLE = (
    "මීබලන්ගොඩ නගර මධ්‍යයේ ලැඟුම්හලක අබිරහස් අයුරින් මියගොස් සිටි පිරිමි අයෙකුගේ "
    "මළ සිරුරක් අද දහවල් සොයා ගත් බව අම්බලන්ගොඩ පොලීසිය පවසනවා."
)


@pytest.mark.asyncio
async def test_uncorrectable_nonsense_word_is_dropped_when_a_clean_candidate_exists(monkeypatch):
    """Mirrors the reported "හමුවෙයිල" case: two candidates end in that
    garbled word (not a real word, not in the article) and the retry can't
    fix it, one candidate is already clean. The nonsense-word candidates
    must not reach the response at all."""

    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        if variation_hint == "clean":
            return _stub_result("අබිරහස් ලෙස මියගිය පුද්ගලයෙකුගේ සිරුර හමුවෙයි")  # 6 words, "medium"
        return _stub_result("අබිරහස් ලෙස මියගිය පුද්ගලයෙකුගේ සිරුර හමුවෙයිල")  # 6 words, "medium"

    async def fake_persist_if_owned(fn, record, user_id, actor):
        return {"id": "test-id", "created_at": None}

    monkeypatch.setattr(hs, "HEADLINE_VARIATION_HINTS", ["clean", "bad1", "bad2"])
    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", fake_persist_if_owned)

    result = await hs.generate_headlines(_BODY_ARTICLE, count=3, length="medium")

    assert "හමුවෙයිල" not in "".join(result.headlines)
    assert len(result.headlines) == 1


@pytest.mark.asyncio
async def test_raises_when_every_candidate_still_fails(monkeypatch):
    """A flagged headline is never shown, full stop -- not even as a
    last-resort fallback when every candidate in the batch still has a bad
    number after the retry. generate_headlines() must raise
    HeadlineQualityExhausted instead of returning a flagged result, so the
    API layer can turn it into a clean, specific error (see
    tests/test_visual_prompt_endpoint.py-style handling in
    app/api/v1/headline.py) rather than ever putting a wrong number in front
    of a caller."""
    async def fake_model_generate(task, text, *, variation_hint=None, **kwargs):
        return _stub_result("වෙළඳපොළේ දෛනික පිරිපහදුව රු.මී. 800 ඉක්මවයි")

    async def fake_persist_if_owned(fn, record, user_id, actor):
        return {"id": "test-id", "created_at": None}

    monkeypatch.setattr(hs, "model_generate", fake_model_generate)
    monkeypatch.setattr(hs, "persist_if_owned", fake_persist_if_owned)

    with pytest.raises(hs.HeadlineQualityExhausted):
        await hs.generate_headlines(_ARTICLE, count=2, length="long")


@pytest.mark.asyncio
async def test_endpoint_returns_clean_422_not_an_unhandled_500(monkeypatch):
    """The API layer must catch HeadlineQualityExhausted and return a clean,
    CORS-safe 422 -- not let it propagate as an unhandled 500 the way the
    Groq visual-prompt exception did before that was fixed (see
    tests/test_visual_prompt_endpoint.py)."""
    import app.api.v1.headline as headline_module

    async def _raise_quality_exhausted(*_args, **_kwargs):
        raise hs.HeadlineQualityExhausted("every candidate failed fact-checking")

    monkeypatch.setattr(headline_module, "generate_headlines", _raise_quality_exhausted)

    async with _client() as client:
        response = await client.post(
            "/api/v1/headlines/generate",
            json={"text": _ARTICLE, "count": 2},
        )

    assert response.status_code == 422
    assert "fact-checking" in response.json()["detail"].lower()
