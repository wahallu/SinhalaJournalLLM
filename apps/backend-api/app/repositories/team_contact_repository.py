"""Data access for the portfolio team member contact details."""

from typing import Any

from app.repositories import base

TABLE = "portfolio_team_contacts"


async def list_all() -> list[dict[str, Any]]:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).select("*").order("sort_order", desc=False).execute()
    )
    return response.data


async def get(student_id: str) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).select("*").eq("student_id", student_id).limit(1).execute()
    )
    return response.data[0] if response.data else None


async def update(student_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).update(data).eq("student_id", student_id).execute()
    )
    return response.data[0] if response.data else None
