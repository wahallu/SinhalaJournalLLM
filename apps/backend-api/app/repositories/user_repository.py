"""
Credentials and single-use email tokens.

Owns app_users and auth_email_tokens — the two tables that replaced
Supabase Auth. Everything here goes through the service-role client: the
browser no longer reaches Postgres at all, so these tables carry RLS with
no policies (deny-all to public roles) and only this backend reads them.

Email addresses are lowercased on the way in. A unique index plus a
lowercase check constraint enforce it in the database; normalising here is
what stops a duplicate-signup attempt from becoming a 500.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.repositories import base

USERS = "app_users"
EMAIL_TOKENS = "auth_email_tokens"

logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_by_email(email: str) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await (
        client.table(USERS)
        .select("*")
        .eq("email", normalize_email(email))
        .maybe_single()
        .execute()
    )
    # maybe_single() returns None itself (not a response with .data = None)
    # when zero rows match — a known postgrest-py quirk. base.fetch_by_id
    # already guards for it; this hand-rolled query needs the same guard.
    return response.data if response else None


async def get_by_id(user_id: str) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await (
        client.table(USERS).select("*").eq("id", user_id).maybe_single().execute()
    )
    return response.data if response else None


async def create_user(
    email: str, password_hash: str | None, *, email_verified: bool = False
) -> dict[str, Any]:
    """
    Insert a credentials row. The caller creates the matching profile.

    password_hash is None for a Google-only account — the same state a
    Supabase OAuth-only user was migrated in as (see
    migrations/2026-08-02-self-hosted-auth.sql). Such a row can still gain a
    password later through "forgot password".
    """
    client = await base.get_supabase()
    response = await (
        client.table(USERS)
        .insert({
            "email": normalize_email(email),
            "password_hash": password_hash,
            "email_verified": email_verified,
        })
        .execute()
    )
    return response.data[0]


async def delete_user(user_id: str) -> None:
    """
    Remove a credentials row.

    Only for rolling back a signup whose profile insert failed. An account left
    in that half-created state can log in but is rejected by every authenticated
    endpoint, which is worse than not existing. This is not an account-deletion
    feature — suspension is `status` on the profile, not removal.
    """
    client = await base.get_supabase()
    await client.table(USERS).delete().eq("id", user_id).execute()


async def set_password(user_id: str, password_hash: str) -> None:
    client = await base.get_supabase()
    await client.table(USERS).update({"password_hash": password_hash}).eq("id", user_id).execute()


async def mark_email_verified(user_id: str) -> None:
    client = await base.get_supabase()
    await client.table(USERS).update({"email_verified": True}).eq("id", user_id).execute()


# ── Single-use email tokens ──

async def create_email_token(user_id: str, token_hash: str, purpose: str, ttl_minutes: int) -> None:
    """Store the hash of an emailed link's token, with an expiry."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    client = await base.get_supabase()
    await client.table(EMAIL_TOKENS).insert({
        "user_id": user_id,
        "token_hash": token_hash,
        "purpose": purpose,
        "expires_at": expires.isoformat(),
    }).execute()


async def consume_email_token(token_hash: str, purpose: str) -> str | None:
    """
    Spend a token and return the user it belongs to, or None.

    None covers every failure the caller must treat identically: unknown
    token, wrong purpose, already used, expired. Distinguishing them in the
    response would tell an attacker which guesses were closer.

    Marked used before returning, so a link cannot be replayed.
    """
    client = await base.get_supabase()
    response = await (
        client.table(EMAIL_TOKENS)
        .select("*")
        .eq("token_hash", token_hash)
        .eq("purpose", purpose)
        .maybe_single()
        .execute()
    )
    row = response.data if response else None
    if not row or row.get("used_at"):
        return None

    expires_at = row.get("expires_at")
    if expires_at and _is_past(expires_at):
        return None

    await (
        client.table(EMAIL_TOKENS)
        .update({"used_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", row["id"])
        .execute()
    )
    return row["user_id"]


def _is_past(timestamp: str) -> bool:
    """Whether an ISO timestamp is in the past. Unparseable reads as expired
    — failing closed is the safe direction for a credential."""
    try:
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Unparseable token expiry %r — treating as expired", timestamp)
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed < datetime.now(timezone.utc)
