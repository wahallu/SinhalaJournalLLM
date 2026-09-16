"""
Bounded retry in the model gateway.

The provider chain existed to survive an outage; this covers the blip a
chain-fallthrough handled badly — degrading a user to a weaker model because
one connection was refused.
"""

import httpx
import pytest

from app.core import model_gateway
from app.models.sinllama_loader import SinLlamaUnavailable


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    """Retry backoff is real time; the test does not need to spend it."""
    async def _instant(_seconds):
        return None
    monkeypatch.setattr(model_gateway.asyncio, "sleep", _instant)


def _failing_then_ok(exc, succeed_on=2):
    calls = {"n": 0}

    async def _provider(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] < succeed_on:
            raise exc
        return "recovered", {}

    return _provider, calls


@pytest.mark.asyncio
async def test_retries_a_refused_connection(monkeypatch):
    """A refused connection fails in milliseconds — retrying beats degrading."""
    provider, calls = _failing_then_ok(
        SinLlamaUnavailable("connection refused", retryable=True)
    )
    monkeypatch.setattr(model_gateway, "_via_sinllama", provider)

    text, _meta = await model_gateway._call_provider(
        "sinllama", "grammar", "text", None, None, None, None,
        num_candidates=1, adapter=None,
    )
    assert text == "recovered"
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_does_not_retry_a_timeout(monkeypatch):
    """
    A timeout has already spent the full SINLLAMA_TIMEOUT_SECONDS budget.
    Retrying would double the worst case a user waits.
    """
    provider, calls = _failing_then_ok(
        SinLlamaUnavailable("timed out", retryable=False)
    )
    monkeypatch.setattr(model_gateway, "_via_sinllama", provider)

    with pytest.raises(SinLlamaUnavailable):
        await model_gateway._call_provider(
            "sinllama", "grammar", "text", None, None, None, None,
            num_candidates=1, adapter=None,
        )
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_gives_up_after_the_attempt_ceiling(monkeypatch):
    """A persistently failing provider must fall through, not retry forever."""
    calls = {"n": 0}

    async def _always_fails(*args, **kwargs):
        calls["n"] += 1
        raise SinLlamaUnavailable("still down", retryable=True)

    monkeypatch.setattr(model_gateway, "_via_sinllama", _always_fails)

    with pytest.raises(SinLlamaUnavailable):
        await model_gateway._call_provider(
            "sinllama", "grammar", "text", None, None, None, None,
            num_candidates=1, adapter=None,
        )
    assert calls["n"] == model_gateway._MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_succeeds_without_retrying_when_healthy(monkeypatch):
    calls = {"n": 0}

    async def _ok(*args, **kwargs):
        calls["n"] += 1
        return "fine", {}

    monkeypatch.setattr(model_gateway, "_via_sinllama", _ok)
    text, _ = await model_gateway._call_provider(
        "sinllama", "grammar", "text", None, None, None, None,
        num_candidates=1, adapter=None,
    )
    assert text == "fine"
    assert calls["n"] == 1


# ── Classification at the source ──

def _http_error(status: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://model/generate")
    response = httpx.Response(status, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


@pytest.mark.asyncio
async def test_5xx_is_marked_retryable(monkeypatch):
    """A 5xx is the server having a moment, not a bad request."""
    async def _post(*args, **kwargs):
        raise _http_error(503)
    monkeypatch.setattr(httpx.AsyncClient, "post", _post)

    from app.models import sinllama_loader
    with pytest.raises(SinLlamaUnavailable) as excinfo:
        await sinllama_loader.sinllama_generate("p", "grammar")
    assert excinfo.value.retryable is True


@pytest.mark.asyncio
async def test_timeout_is_not_marked_retryable(monkeypatch):
    async def _post(*args, **kwargs):
        raise httpx.ReadTimeout("too slow")
    monkeypatch.setattr(httpx.AsyncClient, "post", _post)

    from app.models import sinllama_loader
    with pytest.raises(SinLlamaUnavailable) as excinfo:
        await sinllama_loader.sinllama_generate("p", "grammar")
    assert excinfo.value.retryable is False


@pytest.mark.asyncio
async def test_connect_error_is_marked_retryable(monkeypatch):
    async def _post(*args, **kwargs):
        raise httpx.ConnectError("refused")
    monkeypatch.setattr(httpx.AsyncClient, "post", _post)

    from app.models import sinllama_loader
    with pytest.raises(SinLlamaUnavailable) as excinfo:
        await sinllama_loader.sinllama_generate("p", "grammar")
    assert excinfo.value.retryable is True


@pytest.mark.asyncio
async def test_422_still_propagates_unchanged(monkeypatch):
    """
    422 means our own bad request (a bad adapter name), which the gateway
    handles by retrying on the task default. Masking it as an availability
    failure would lose that.
    """
    async def _post(*args, **kwargs):
        raise _http_error(422)
    monkeypatch.setattr(httpx.AsyncClient, "post", _post)

    from app.models import sinllama_loader
    with pytest.raises(httpx.HTTPStatusError):
        await sinllama_loader.sinllama_generate("p", "grammar")
