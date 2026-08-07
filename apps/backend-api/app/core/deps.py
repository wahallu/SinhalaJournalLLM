"""
FastAPI auth dependencies.

Three levels, matching the three kinds of route in this product:

    optional_user  the four writing tools — usable anonymously, but a
                   signed-in caller gets their results saved
    require_user   anything personal (history, profile, settings)
    require_admin  the admin dashboard

A suspended account is rejected by all three, including optional_user —
a suspended token is treated as invalid, not as anonymous. Such a user can
still use the tools logged out, which is intended: suspension revokes
account privileges, not access to a publicly available tool.
"""

import logging

from fastapi import HTTPException, Request, status

from app.core.auth import InvalidToken, decode_token, extract_bearer
from app.repositories.base import DatabaseUnavailable
from app.repositories.profile_repository import get_profile
from app.schemas.auth import AuthUser

logger = logging.getLogger(__name__)

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required.",
    headers={"WWW-Authenticate": "Bearer"},
)
_SUSPENDED = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="This account has been suspended.",
)
_NOT_ADMIN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Administrator access required.",
)


async def _resolve(request: Request) -> AuthUser | None:
    """Verify the bearer token and load the matching profile, or None."""
    token = extract_bearer(request.headers.get("Authorization"))
    if token is None:
        return None

    try:
        claims = decode_token(token)
    except InvalidToken:
        return None

    user_id = claims.get("sub")
    if not user_id:
        return None

    try:
        profile = await get_profile(user_id)
    except DatabaseUnavailable:
        # Failing open here would let anyone through whenever the database
        # blips, so a profile we cannot read is a profile we do not trust.
        logger.warning("Profile lookup failed for %s — treating as unauthenticated", user_id)
        return None

    if profile is None:
        # The token is cryptographically valid but there is no profiles row.
        # Nothing deletes profiles — suspension sets status instead — so this
        # is always a data-integrity gap, most likely a signup whose second
        # insert failed. It is worth its own log line because the symptom
        # (401 on every call, for one account, permanently) is identical to an
        # expired token and impossible to tell apart otherwise.
        logger.error(
            "No profiles row for authenticated user %s — account cannot be "
            "used until the row is restored",
            user_id,
        )
        return None

    user = AuthUser(
        id=user_id,
        email=profile.get("email") or claims.get("email", ""),
        role=profile.get("role", "user"),
        status=profile.get("status", "active"),
        category_id=profile.get("category_id"),
        token=token,
    )
    if user.status == "suspended":
        raise _SUSPENDED
    return user


async def optional_user(request: Request) -> AuthUser | None:
    """Resolved caller, or None when unauthenticated. Never raises 401."""
    return await _resolve(request)


async def require_user(request: Request) -> AuthUser:
    """Resolved caller. 401 when absent or unverifiable."""
    user = await _resolve(request)
    if user is None:
        raise _UNAUTHENTICATED
    return user


async def require_admin(request: Request) -> AuthUser:
    """Resolved caller with role='admin'. 401 when absent, 403 when not admin."""
    user = await require_user(request)
    if not user.is_admin:
        raise _NOT_ADMIN
    return user
