"""
Request correlation, security headers, and the readiness probe.

A 500 used to be untraceable to the report that prompted it. These cover the
loop that closes: an id bound for the request, present on the response, and
carried into the error body.
"""

import logging

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.observability import (
    REQUEST_ID_HEADER,
    JsonFormatter,
    RequestIdFilter,
    _sanitize,
)
from app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Request id ──

@pytest.mark.asyncio
async def test_response_carries_a_generated_request_id():
    async with _client() as c:
        r = await c.get("/health")
    assert r.headers.get(REQUEST_ID_HEADER)
    assert len(r.headers[REQUEST_ID_HEADER]) == 32  # uuid4().hex


@pytest.mark.asyncio
async def test_inbound_request_id_is_honoured():
    """A proxy's trace must survive, or correlation stops at our edge."""
    async with _client() as c:
        r = await c.get("/health", headers={REQUEST_ID_HEADER: "trace-abc-123"})
    assert r.headers[REQUEST_ID_HEADER] == "trace-abc-123"


@pytest.mark.asyncio
async def test_ids_differ_between_requests():
    async with _client() as c:
        first = await c.get("/health")
        second = await c.get("/health")
    assert first.headers[REQUEST_ID_HEADER] != second.headers[REQUEST_ID_HEADER]


@pytest.mark.parametrize("hostile", [
    "with space",
    "line\nbreak",          # log injection
    "semi;colon",
    "x" * 65,               # unbounded length
    "",
    "   ",
])
def test_hostile_inbound_ids_are_replaced(hostile):
    """
    The header is attacker-controlled and lands in log lines and a response
    header, so anything questionable gets a fresh id rather than a cleaned
    version of what was sent.
    """
    out = _sanitize(hostile)
    assert out != hostile
    assert len(out) == 32
    assert out.isalnum()


@pytest.mark.parametrize("ok", ["trace-abc-123", "ABC_123", "a" * 64])
def test_reasonable_inbound_ids_are_kept(ok):
    assert _sanitize(ok) == ok


# ── Security headers ──

@pytest.mark.asyncio
async def test_security_headers_present():
    async with _client() as c:
        r = await c.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_hsts_absent_outside_production():
    """
    Sent over plain HTTP in development it would pin localhost to HTTPS in
    the developer's browser, which is painful to undo.
    """
    async with _client() as c:
        r = await c.get("/health")
    assert "strict-transport-security" not in r.headers


# ── Readiness ──

@pytest.mark.asyncio
async def test_liveness_stays_up_without_a_database(monkeypatch):
    """
    /health must not consult the database. An orchestrator that restarts on a
    failed liveness probe would kill every instance during a database blip.
    """
    async def _dead(*args, **kwargs):
        raise RuntimeError("database down")
    monkeypatch.setattr("app.repositories.base.get_supabase", _dead)

    async with _client() as c:
        r = await c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_readiness_ok_when_database_reachable(fake_supabase):
    fake_supabase.store["profiles"] = []
    async with _client() as c:
        r = await c.get("/health/ready")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_readiness_503_when_database_unreachable(monkeypatch):
    async def _dead(*args, **kwargs):
        raise RuntimeError("database down")
    monkeypatch.setattr("app.repositories.base.get_supabase", _dead)

    async with _client() as c:
        r = await c.get("/health/ready")
    assert r.status_code == 503
    assert r.json()["database"] == "unreachable"


# ── Log formatting ──

def _record(msg="hello"):
    return logging.LogRecord("t", logging.INFO, __file__, 1, msg, None, None)


def test_filter_defaults_request_id_outside_a_request():
    record = _record()
    RequestIdFilter().filter(record)
    assert record.request_id == "-"


def test_json_formatter_emits_one_object_per_line():
    import json
    record = _record("something happened")
    RequestIdFilter().filter(record)
    parsed = json.loads(JsonFormatter().format(record))
    assert parsed["message"] == "something happened"
    assert parsed["level"] == "INFO"
    assert parsed["request_id"] == "-"
