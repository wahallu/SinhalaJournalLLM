"""
Audit trail for privileged mutations.

Every admin action that changes state writes one row here with before/after
values, so "who changed this, when, and what was it before" is answerable.
`actor_email` is denormalized because the trail must survive the actor's
account being deleted.

Note on the import style used across the admin repositories: the Supabase
client is reached as `base.get_supabase()` rather than by importing the name
directly. The test fake patches the attribute on `app.repositories.base`, and
a direct `from ... import get_supabase` would bind the real function at import
time and silently bypass the fake.
"""

import logging
from typing import Any

from app.repositories import base
from app.schemas.auth import AuthUser

TABLE = "audit_log"

logger = logging.getLogger(__name__)


async def record(
    actor: AuthUser,
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    ip_hash: str | None = None,
) -> None:
    """
    Write one audit row.

    Never raises: the mutation being audited has already succeeded, and
    failing here would report an error for work that actually happened.
    The failure is logged loudly instead.
    """
    try:
        await base.insert_record(
            TABLE,
            {
                "actor_id": actor.id,
                "actor_email": actor.email,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "before": before,
                "after": after,
                "ip_hash": ip_hash,
            },
        )
    except Exception:
        logger.exception("Audit write failed for action=%s target=%s", action, target_id)


async def list_entries(*, page: int = 1, page_size: int = 50) -> tuple[list[dict[str, Any]], int]:
    """Newest-first page of audit entries plus the total count."""
    return await base.fetch_page(TABLE, page=page, page_size=page_size)
