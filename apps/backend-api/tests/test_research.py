"""
Anonymous grouping and accept/reject capture for the study.

The tool goes to journalism students through a WhatsApp group, so nearly every
run is anonymous. Two things have to hold: an anonymous run must actually be
saved (it used to be discarded), and a malformed or hostile header must never
be able to fail a journalist's grammar check.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.research import Actor, actor_from
from app.main import app


class _Req:
    def __init__(self, headers):
        self.headers = headers


class _User:
    id = "11111111-1111-1111-1111-111111111111"


# ── Identity resolution ──

def test_reads_both_headers():
    actor = actor_from(
        _Req({"X-Anon-Id": "device-abc12345", "X-Session-Id": "sess-xyz98765"}), None
    )
    assert actor.anon_id == "device-abc12345"
    assert actor.session_id == "sess-xyz98765"
    assert actor.is_known


def test_signed_in_user_keeps_their_device_id():
    """
    Signing in mid-session must not split one student into two participants.
    """
    actor = actor_from(_Req({"X-Anon-Id": "device-abc12345"}), _User())
    assert actor.user_id == _User.id
    assert actor.anon_id == "device-abc12345"


def test_no_headers_is_not_known():
    actor = actor_from(_Req({}), None)
    assert not actor.is_known
    assert actor.stamp() == {"user_id": None, "anon_id": None, "session_id": None}


@pytest.mark.parametrize(
    "value",
    [
        "short",                       # under the length floor
        "x" * 200,                     # over the cap
        "has spaces here",
        "'; drop table users; --",
        "<script>alert(1)</script>",
        "../../etc/passwd",
    ],
)
def test_junk_ids_are_dropped_not_raised(value):
    """
    These reach the database. A bad header is ignored — never an error, because
    an analytics field must not be able to fail a correction.
    """
    actor = actor_from(_Req({"X-Anon-Id": value}), None)
    assert actor.anon_id is None


# ── Anonymous runs are persisted ──

@pytest.mark.asyncio
async def test_anonymous_run_is_saved_against_its_device_id(monkeypatch):
    """
    The behaviour this whole change exists for. Anonymous runs used to return a
    synthetic record and write nothing, which would have discarded the study's
    entire dataset.
    """
    saved = {}

    async def fake_save(record):
        saved.update(record)
        return {**record, "id": "row-1", "created_at": "2026-08-10T00:00:00Z"}

    from app.repositories import base

    actor = Actor(user_id=None, anon_id="device-abc12345", session_id="sess-xyz98765")
    result = await base.persist_if_owned(fake_save, {"original_text": "x"}, None, actor)

    assert saved["anon_id"] == "device-abc12345"
    assert saved["session_id"] == "sess-xyz98765"
    assert saved["user_id"] is None
    assert result["id"] == "row-1"


@pytest.mark.asyncio
async def test_a_caller_with_no_identity_still_writes_nothing():
    """
    Without a device id there is nothing to attribute a row to, so the old
    'login to save' behaviour must remain — otherwise `user_id IS NULL AND
    anon_id IS NULL` stops meaning "pre-auth legacy data".
    """
    called = False

    async def fake_save(record):
        nonlocal called
        called = True
        return record

    from app.repositories import base

    actor = Actor(user_id=None, anon_id=None, session_id=None)
    result = await base.persist_if_owned(fake_save, {"original_text": "x"}, None, actor)

    assert not called
    assert result["id"]  # response-shaped even though nothing was written


# ── Accept / reject capture ──

def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_records_an_accept_and_a_reject(fake_supabase):
    async with _client() as c:
        response = await c.post(
            "/api/v1/events/suggestions",
            headers={"X-Anon-Id": "device-abc12345"},
            json={"events": [
                {"kind": "correction", "action": "accepted",
                 "original": "කලේ", "proposed": "කළේ"},
                {"kind": "suggestion", "action": "rejected",
                 "original": "පොලිසිය", "proposed": "පොලීසිය"},
            ]},
        )
    assert response.status_code == 200
    assert response.json()["recorded"] == 2


@pytest.mark.asyncio
async def test_unknown_kind_or_action_is_dropped_silently(fake_supabase):
    """Closed sets, matching the database CHECK constraints."""
    async with _client() as c:
        response = await c.post(
            "/api/v1/events/suggestions",
            json={"events": [
                {"kind": "nonsense", "action": "accepted"},
                {"kind": "correction", "action": "exploded"},
                {"kind": "correction", "action": "shown"},
            ]},
        )
    assert response.status_code == 200
    assert response.json()["recorded"] == 1


@pytest.mark.asyncio
async def test_reports_zero_when_the_write_fails(monkeypatch):
    """
    `recorded` must not overstate itself. The generic insert helper returns a
    synthetic record when the database is unreachable, which would have this
    endpoint answer "recorded: 3" having stored nothing — a research count that
    quietly lies is worse than no count.
    """
    from app.repositories import events_repository

    async def boom():
        raise ConnectionError("database unreachable")

    monkeypatch.setattr(events_repository.base, "get_supabase", boom)
    written = await events_repository.record_events(
        [{"kind": "correction", "action": "shown"}] * 3
    )
    assert written == 0


@pytest.mark.asyncio
async def test_empty_batch_is_fine(fake_supabase):
    async with _client() as c:
        response = await c.post("/api/v1/events/suggestions", json={"events": []})
    assert response.status_code == 200
    assert response.json()["recorded"] == 0


@pytest.mark.asyncio
async def test_oversized_batch_is_rejected_by_schema(fake_supabase):
    """A hostile client must not turn one request into an unbounded insert."""
    async with _client() as c:
        response = await c.post(
            "/api/v1/events/suggestions",
            json={"events": [{"kind": "correction", "action": "shown"}] * 500},
        )
    assert response.status_code == 422
