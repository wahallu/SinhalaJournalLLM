"""Data access for public portfolio documents."""

from typing import Any

from app.repositories import base

TABLE = "portfolio_documents"


async def list_public() -> list[dict[str, Any]]:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE)
        .select("*")
        .eq("is_published", True)
        .order("sort_order", desc=False)
        .execute()
    )
    return response.data


async def list_all() -> list[dict[str, Any]]:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).select("*").order("sort_order", desc=False).execute()
    )
    return response.data


async def get(document_id: str) -> dict[str, Any] | None:
    return await base.fetch_by_id(TABLE, document_id)


async def create(data: dict[str, Any]) -> dict[str, Any]:
    """Admin writes must fail loudly; an unsaved synthetic row is not valid here."""
    client = await base.get_supabase()
    response = await client.table(TABLE).insert(data).execute()
    return response.data[0]


async def update(document_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).update(data).eq("id", document_id).execute()
    )
    return response.data[0] if response.data else None


async def delete(document_id: str) -> bool:
    client = await base.get_supabase()
    response = await client.table(TABLE).delete().eq("id", document_id).execute()
    return bool(response.data)
