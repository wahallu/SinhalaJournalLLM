"""
Regression tests for the bug that made image generation fail on every attempt.

The reported error was:

    OpenAI image generation failed after 2 attempts.
    Could not reach OpenAI image generation. Please try again.

which reads like a network fault and was not one. REQUEST_TIMEOUT had been set
to 24.0 seconds. OpenAI documents image latency as reaching "up to 2 minutes",
so httpx aborted every call with a ReadTimeout long before any real generation
could finish, retried, aborted again, and reported that. Nothing was wrong with
the network, the API key, or the model.

24s was a reasonable-looking attempt to stay inside the platform's 30-second
first-byte limit, and that is the trap: no client timeout short enough to beat
that limit is long enough to generate an image. The limit is satisfied by
streaming instead (see test_image_streaming.py), which frees this timeout to be
as long as the model actually needs.

Two further failures were invisible for a related reason: _api_error() read
OpenAI's own error.message and then dropped it on 401/403/429/5xx in favour of
a generic sentence. The most common real 403 here is "Your organization must be
verified to use the model gpt-image-1", which reached the admin as "Check the
backend OPENAI_API_KEY" -- pointing at a key that was never the problem.
"""

import httpx
import pytest

from app.services import image_generation_service as svc


def _response(status: int, body: dict) -> httpx.Response:
    return httpx.Response(
        status_code=status, json=body, request=httpx.Request("POST", "https://x")
    )


# ── the timeout itself ──

def test_request_timeout_exceeds_openais_documented_worst_case():
    """The actual regression guard. OpenAI documents image latency as reaching
    "up to 2 minutes"; a client timeout below that aborts real generations and
    reports it as a connectivity failure."""
    assert svc.REQUEST_TIMEOUT >= 120.0, (
        f"REQUEST_TIMEOUT={svc.REQUEST_TIMEOUT}s aborts image generation before "
        "it can finish; this is the 24.0 bug returning"
    )


@pytest.mark.asyncio
async def test_a_read_timeout_says_it_was_a_timeout(monkeypatch):
    """The message that cost the most time to interpret. Every httpx failure
    produced the same "Could not reach OpenAI", so a self-inflicted timeout
    looked exactly like an unreachable network. The exception class is the
    whole diagnosis and must reach the admin."""
    monkeypatch.setattr(svc, "get_settings", lambda: type("S", (), {"OPENAI_API_KEY": "k"})())
    monkeypatch.setattr(svc, "_retry_delay", lambda *_a, **_kw: _noop())

    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **kw):
            raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(svc.httpx, "AsyncClient", lambda **kw: FakeClient())

    with pytest.raises(RuntimeError) as excinfo:
        await svc.generate_image("a news photograph")

    message = str(excinfo.value)
    assert "ReadTimeout" in message, message
    # And it reports what actually happened, not the MAX_RETRIES constant.
    assert "attempt(s)" in message


async def _noop():
    return None


# ── error messages ──

def test_openai_message_survives_a_403():
    """The unverified-organisation case, which used to be reported as a key
    problem."""
    failure = svc._api_error(_response(403, {"error": {
        "message": "Your organization must be verified to use the model `gpt-image-1`.",
        "code": "organization_must_be_verified",
    }}))
    assert "must be verified" in failure.message
    assert failure.retryable is False
    assert failure.model_unavailable is True


def test_openai_message_survives_a_rate_limit():
    failure = svc._api_error(_response(429, {"error": {
        "message": "Rate limit reached for images per minute.",
    }}))
    assert "Rate limit reached" in failure.message
    assert failure.retryable is True


def test_a_plain_auth_failure_still_points_at_the_key():
    """Not every 401/403 is a model problem -- a genuinely bad key must still
    say so, and must not trigger a pointless model failover."""
    failure = svc._api_error(_response(401, {"error": {
        "message": "Incorrect API key provided.",
    }}))
    assert "OPENAI_API_KEY" in failure.message
    assert "Incorrect API key provided." in failure.message
    assert failure.model_unavailable is False


# ── model failover ──

@pytest.mark.asyncio
async def test_an_unavailable_model_fails_over_to_the_other(monkeypatch):
    """An account very often has exactly one of the two models -- gpt-image-1
    needs organisation verification, gpt-image-2 needs newer access. Failing
    over beats handing the user an error only an admin-panel change can fix."""
    monkeypatch.setattr(svc, "get_settings", lambda: type("S", (), {"OPENAI_API_KEY": "k"})())
    seen: list[str] = []

    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None, **kw):
            seen.append(json["model"])
            if json["model"] == "gpt-image-2":
                return _response(403, {"error": {
                    "message": "You do not have access to the model `gpt-image-2`.",
                }})
            return _response(200, {"data": [{"b64_json": "aGVsbG8="}]})

    monkeypatch.setattr(svc.httpx, "AsyncClient", lambda **kw: FakeClient())

    result = await svc.generate_image("a news photograph", model="gpt-image-2")

    assert seen == ["gpt-image-2", "gpt-image-1"]
    assert result.startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_failover_is_not_attempted_twice(monkeypatch):
    """Both models unavailable must end in a clear error, not a loop."""
    monkeypatch.setattr(svc, "get_settings", lambda: type("S", (), {"OPENAI_API_KEY": "k"})())
    seen: list[str] = []

    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None, **kw):
            seen.append(json["model"])
            return _response(403, {"error": {
                "message": "You do not have access to this model.",
            }})

    monkeypatch.setattr(svc.httpx, "AsyncClient", lambda **kw: FakeClient())

    with pytest.raises(RuntimeError, match="do not have access"):
        await svc.generate_image("a news photograph", model="gpt-image-2")

    assert seen == ["gpt-image-2", "gpt-image-1"]
