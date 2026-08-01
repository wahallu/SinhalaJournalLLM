"""
The in-memory PostgREST fake must not be more permissive than the real thing.

Every one of these was a real divergence found by code review: a test could
pass while production behaved differently, which is worse than no test.
"""

import pytest

from app.repositories import base


@pytest.mark.asyncio
async def test_delete_honours_gte_filters(fake_supabase):
    """
    Regression: update/delete applied only `eq`. With no `eq` at all,
    `all([])` is True, so `.delete().gte("created_at", cutoff)` matched every
    row — exactly the shape of the retention prune.
    """
    fake_supabase.store["request_telemetry"] = [
        {"id": "old", "created_at": "2020-01-01T00:00:00Z"},
        {"id": "new", "created_at": "2026-01-01T00:00:00Z"},
    ]
    client = await base.get_supabase()
    await client.table("request_telemetry").delete().gte(
        "created_at", "2025-01-01T00:00:00Z"
    ).execute()

    remaining = [r["id"] for r in fake_supabase.store["request_telemetry"]]
    assert remaining == ["old"], "gte filter was ignored — prune would empty the table"


@pytest.mark.asyncio
async def test_update_honours_gte_filters(fake_supabase):
    fake_supabase.store["t"] = [
        {"id": "a", "created_at": "2020-01-01T00:00:00Z", "flag": False},
        {"id": "b", "created_at": "2026-01-01T00:00:00Z", "flag": False},
    ]
    client = await base.get_supabase()
    await client.table("t").update({"flag": True}).gte(
        "created_at", "2025-01-01T00:00:00Z"
    ).execute()

    flags = {r["id"]: r["flag"] for r in fake_supabase.store["t"]}
    assert flags == {"a": False, "b": True}


@pytest.mark.asyncio
async def test_insert_does_not_return_the_stored_row(fake_supabase):
    """Mutating a response must not reach into the store."""
    client = await base.get_supabase()
    response = await client.table("t").insert({"value": "original"}).execute()
    response.data[0]["value"] = "mutated"

    assert fake_supabase.store["t"][0]["value"] == "original"


@pytest.mark.asyncio
async def test_upsert_replaces_rather_than_duplicating(fake_supabase):
    client = await base.get_supabase()
    await client.table("app_settings").upsert(
        {"key": "features.grammar", "value": False}, on_conflict="key"
    ).execute()
    await client.table("app_settings").upsert(
        {"key": "features.grammar", "value": True}, on_conflict="key"
    ).execute()

    # The offline fixture seeds model.* rows, so count only this key.
    rows = [r for r in fake_supabase.store["app_settings"]
            if r["key"] == "features.grammar"]
    assert len(rows) == 1
    assert rows[0]["value"] is True


@pytest.mark.asyncio
async def test_settings_upsert_is_a_single_operation(fake_supabase):
    """
    Regression: settings_repository did delete-then-insert. A failure between
    the two lost the override permanently, and features default to True, so a
    disabled tool would silently re-enable.
    """
    from app.repositories import settings_repository

    await settings_repository.upsert("features.grammar", False, actor_id=None)
    await settings_repository.upsert("features.grammar", True, actor_id=None)

    rows = [r for r in fake_supabase.store["app_settings"]
            if r["key"] == "features.grammar"]
    assert len(rows) == 1
    assert rows[0]["value"] is True
