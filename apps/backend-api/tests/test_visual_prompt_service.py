"""
Tests for the correction loop in visual_prompt_service: a draft the checks
flag goes back to the model with the specific problem named, and only a
draft that passes both the rule-based checks and the check call is returned.
groq_chat is replaced with a scripted fake, so these run offline.
"""

import json

import pytest

from app.core.groq_client import GroqUnavailable
from app.services.headline import visual_prompt_service as service

ARTICLE = (
    "අධිවේගී මාර්ග ජාලයේ ස්ථාන කිහිපයක මේ වන විට දැඩි රථවාහන තදබදයක් හටගෙන ඇති බව "
    "මාර්ග සංවර්ධන අධිකාරිය පවසනවා. ඒ අනුව දක්ෂිණ අධිවේගී මාර්ගයේ මත්තල පිටවීම අසළ "
    "මෙලෙස වාහන තදබදය හටගෙන ඇති බවයි වාර්තා වෙන්නේ."
)
FACTS = [
    {"detail": "heavy traffic congestion on the expressway network",
     "source": "අධිවේගී මාර්ග ජාලයේ ස්ථාන කිහිපයක මේ වන විට දැඩි රථවාහන තදබදයක්"},
    {"detail": "Mattala exit on the Southern Expressway",
     "source": "දක්ෂිණ අධිවේගී මාර්ගයේ මත්තල පිටවීම"},
]
GOOD_PROMPT = (
    "Photorealistic news photograph of heavy traffic congestion at the Mattala exit of "
    "the Southern Expressway in Sri Lanka, natural light, wide shot from an elevated angle."
)


def _draft(prompt: str, facts=FACTS, people=()) -> str:
    return json.dumps(
        {"facts": facts, "named_people": list(people), "prompt": prompt}, ensure_ascii=False
    )


def _check(*unsupported: str) -> str:
    return json.dumps({"unsupported": list(unsupported)})


class _FakeGroq:
    """Returns the scripted replies in order and records every call."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls: list[dict] = []

    async def __call__(self, messages, *, temperature, max_tokens):
        self.calls.append({"messages": messages, "temperature": temperature})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


@pytest.fixture
def fake_groq(monkeypatch):
    def install(*replies):
        fake = _FakeGroq(*replies)
        monkeypatch.setattr(service, "groq_chat", fake)
        return fake
    return install


@pytest.mark.asyncio
async def test_grounded_draft_is_returned_after_the_check_call(fake_groq):
    fake = fake_groq(_draft(GOOD_PROMPT), _check())

    assert await service.generate_visual_prompt(ARTICLE) == GOOD_PROMPT

    generate, check = fake.calls
    assert generate["temperature"] <= 0.2
    assert check["temperature"] == 0.0
    # The check call judges against the article itself, not the model's facts.
    assert ARTICLE in check["messages"][1]["content"]
    assert GOOD_PROMPT in check["messages"][1]["content"]


@pytest.mark.asyncio
async def test_flagged_draft_is_corrected_by_name(fake_groq):
    wrong = "Stalled cars on the southern expressway near Matara at midday, natural light."
    fake = fake_groq(_draft(wrong), _draft(GOOD_PROMPT), _check())

    assert await service.generate_visual_prompt(ARTICLE) == GOOD_PROMPT

    correction = fake.calls[1]["messages"][-1]["content"]
    assert '"Matara"' in correction
    assert '"midday"' in correction
    # The model sees its own flagged draft before the correction.
    assert fake.calls[1]["messages"][-2] == {"role": "assistant", "content": _draft(wrong)}


@pytest.mark.asyncio
async def test_element_the_check_call_flags_is_corrected(fake_groq):
    with_prop = GOOD_PROMPT + " A police officer directs the traffic."
    fake = fake_groq(
        _draft(with_prop), _check("police officer"), _draft(GOOD_PROMPT), _check()
    )

    assert await service.generate_visual_prompt(ARTICLE) == GOOD_PROMPT
    assert '"police officer" -- the article does not state this' in (
        fake.calls[2]["messages"][-1]["content"]
    )


@pytest.mark.asyncio
async def test_fact_whose_source_is_not_in_the_article_is_named(fake_groq):
    invented = [*FACTS, {"detail": "near Matara", "source": "මාතර අසල"}]
    wrong = "Stalled cars on the expressway near Matara, natural light."
    fake = fake_groq(_draft(wrong, facts=invented), _draft(GOOD_PROMPT), _check())

    await service.generate_visual_prompt(ARTICLE)

    correction = fake.calls[1]["messages"][-1]["content"]
    assert "near Matara" in correction and "source is not in the article" in correction


@pytest.mark.asyncio
async def test_non_json_reply_is_asked_again(fake_groq):
    fake = fake_groq("Here is your prompt: traffic.", _draft(GOOD_PROMPT), _check())

    assert await service.generate_visual_prompt(ARTICLE) == GOOD_PROMPT
    assert "JSON" in fake.calls[1]["messages"][-1]["content"]


@pytest.mark.asyncio
async def test_after_the_last_correction_flagged_sentences_are_dropped(fake_groq):
    lead = GOOD_PROMPT
    wrong = f"{lead} Bright midday sunlight casts sharp shadows."
    fake_groq(_draft(wrong), _draft(wrong), _draft(wrong))

    assert await service.generate_visual_prompt(ARTICLE) == lead


@pytest.mark.asyncio
async def test_ungrounded_headline_is_not_sent(fake_groq):
    fake = fake_groq(_draft(GOOD_PROMPT), _check())

    await service.generate_visual_prompt(ARTICLE, "මාතර අධිවේගී මාර්ගයේ වාහන 500ක් සිරවෙයි")

    assert "Headline" not in fake.calls[0]["messages"][1]["content"]


@pytest.mark.asyncio
async def test_grounded_headline_is_sent_as_focus_only(fake_groq):
    headline = "මත්තල පිටවීම අසළ දැඩි රථවාහන තදබදයක්"
    fake = fake_groq(_draft(GOOD_PROMPT), _check())

    await service.generate_visual_prompt(ARTICLE, headline)

    assert f"Headline (focus only): {headline}" in fake.calls[0]["messages"][1]["content"]


@pytest.mark.asyncio
async def test_first_call_failure_propagates(fake_groq):
    fake_groq(GroqUnavailable("GROQ_API_KEY is not configured"))

    with pytest.raises(GroqUnavailable):
        await service.generate_visual_prompt(ARTICLE)


@pytest.mark.asyncio
async def test_failed_correction_round_keeps_the_best_draft(fake_groq):
    wrong = f"{GOOD_PROMPT} Frustrated drivers wait."
    fake_groq(_draft(wrong), GroqUnavailable("rate limited"))

    assert await service.generate_visual_prompt(ARTICLE) == GOOD_PROMPT


@pytest.mark.asyncio
async def test_failed_check_call_does_not_block_a_rule_clean_prompt(fake_groq):
    fake_groq(_draft(GOOD_PROMPT), GroqUnavailable("timeout"))

    assert await service.generate_visual_prompt(ARTICLE) == GOOD_PROMPT
