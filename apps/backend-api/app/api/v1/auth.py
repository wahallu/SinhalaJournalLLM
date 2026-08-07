"""
Self-hosted authentication. Replaced Supabase Auth.

    POST /auth/signup           create an account, return a session
    POST /auth/login            exchange credentials for a session
    POST /auth/refresh          mint a new access token
    GET  /auth/me               the current caller
    POST /auth/forgot-password  email a reset link
    POST /auth/reset-password   spend a reset link
    POST /auth/verify-email     spend a verification link

Two rules run through the whole module:

1. **No user enumeration.** Login answers identically for a wrong password
   and an unknown address, and forgot-password answers identically whether
   or not the address is registered. Anything else turns these endpoints
   into a way to discover who has an account.
2. **Emailed links are single-use and stored hashed**, so a leaked database
   row cannot be replayed as a working link.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import security
from app.core.config import get_settings
from app.core.deps import require_user
from app.core.email import (
    EmailDeliveryError,
    send_password_reset_email,
    send_verification_email,
)
from app.repositories import base, user_repository
from app.repositories.profile_repository import get_profile
from app.schemas.auth import (
    AccessTokenResponse,
    AccountResponse,
    AuthUser,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SessionResponse,
    SignupRequest,
    VerifyEmailRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# One object, reused for both failure modes, so the two cannot drift apart
# and start being distinguishable.
_BAD_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password.",
    headers={"WWW-Authenticate": "Bearer"},
)
_BAD_LINK = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="This link is invalid or has expired.",
)


def _session(user: dict, profile: dict | None) -> SessionResponse:
    profile = profile or {}
    return SessionResponse(
        access_token=security.create_access_token(user["id"]),
        refresh_token=security.create_refresh_token(user["id"]),
        user=AccountResponse(
            id=user["id"],
            email=user["email"],
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            category_id=profile.get("category_id"),
            email_verified=bool(user.get("email_verified")),
            full_name=profile.get("full_name"),
        ),
    )


@router.post("/signup", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest) -> SessionResponse:
    """
    Create credentials plus the matching profiles row.

    Supabase used to mirror auth.users into profiles with a trigger; that
    trigger is dropped by the migration and this endpoint does it instead,
    so both rows are created by the same code path.
    """
    email = user_repository.normalize_email(payload.email)

    if await user_repository.get_by_email(email):
        # Signup is one place enumeration cannot be avoided — the address
        # either can or cannot be registered, and the user has to be told.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    try:
        password_hash = security.hash_password(payload.password)
    except ValueError as exc:
        # Length in bytes, which Pydantic's character limit cannot catch.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    user = await user_repository.create_user(email, password_hash)

    # Resolved via the `base` module attribute rather than a direct
    # `from ... import get_supabase`, so the test suite's fake_supabase
    # fixture covers this path. A direct import binds its own name at import
    # time and silently keeps hitting the real database under test.
    # These are two writes with no transaction between them. If the second one
    # fails the account is left unusable rather than absent: login still
    # succeeds (_session tolerates a missing profile) but deps._resolve rejects
    # every subsequent request, so the user appears signed in and then gets 401
    # on everything, permanently, with no way to recover it themselves.
    # Undoing the credentials row turns that silent trap into a plain signup
    # failure the user can simply retry.
    client = await base.get_supabase()
    try:
        await client.table("profiles").insert({
            "id": user["id"],
            "email": email,
            "full_name": payload.full_name,
            "role": "user",
            "status": "active",
        }).execute()
    except Exception as exc:
        logger.exception("Profile insert failed for %s — rolling back the user row", email)
        try:
            await user_repository.delete_user(user["id"])
        except Exception:
            logger.exception(
                "Could not roll back user %s — it now has no profile and must "
                "be repaired by hand", user["id"],
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not complete signup. Please try again.",
        ) from exc

    await _send_verification(user["id"], email)

    profile = await get_profile(user["id"])
    return _session(user, profile)


@router.post("/login", response_model=SessionResponse)
async def login(payload: LoginRequest) -> SessionResponse:
    user = await user_repository.get_by_email(payload.email)

    # Verify even when there is no such user, against a throwaway hash, so
    # the response time does not reveal whether the address exists.
    stored = (user or {}).get("password_hash") or security.DUMMY_HASH
    if not security.verify_password(payload.password, stored) or not user:
        raise _BAD_CREDENTIALS

    profile = await get_profile(user["id"])
    if (profile or {}).get("status") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended.",
        )

    return _session(user, profile)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: RefreshRequest) -> AccessTokenResponse:
    """
    Mint a new access token. Only a refresh token is accepted here — an
    access token presented instead is rejected by decode_token's type check.
    """
    try:
        claims = security.decode_token(payload.refresh_token, expected_type="refresh")
    except security.InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        ) from exc

    user = await user_repository.get_by_id(claims["sub"])
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

    return AccessTokenResponse(access_token=security.create_access_token(user["id"]))


@router.get("/me", response_model=AccountResponse)
async def me(user: AuthUser = Depends(require_user)) -> AccountResponse:
    account = await user_repository.get_by_id(user.id)
    return AccountResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        category_id=user.category_id,
        email_verified=bool((account or {}).get("email_verified")),
    )


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(payload: ForgotPasswordRequest) -> dict[str, str]:
    """
    Always answers the same, whether or not the address is registered, and
    whether or not the mail actually went out. The response must not be
    usable to discover who has an account.
    """
    user = await user_repository.get_by_email(payload.email)

    if user:
        raw = security.generate_url_token()
        await user_repository.create_email_token(
            user["id"],
            security.hash_url_token(raw),
            "reset",
            get_settings().EMAIL_TOKEN_TTL_MINUTES,
        )
        try:
            await send_password_reset_email(user["email"], raw)
        except EmailDeliveryError:
            logger.warning("Reset email could not be delivered — responding normally anyway")

    return {"detail": "If that address has an account, a reset link is on its way."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest) -> dict[str, str]:
    user_id = await user_repository.consume_email_token(
        security.hash_url_token(payload.token), "reset"
    )
    if not user_id:
        raise _BAD_LINK

    try:
        password_hash = security.hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    await user_repository.set_password(user_id, password_hash)
    return {"detail": "Your password has been updated."}


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest) -> dict[str, str]:
    user_id = await user_repository.consume_email_token(
        security.hash_url_token(payload.token), "verify"
    )
    if not user_id:
        raise _BAD_LINK

    await user_repository.mark_email_verified(user_id)
    return {"detail": "Your email address is confirmed."}


async def _send_verification(user_id: str, email: str) -> None:
    """Non-fatal: the account exists either way and the link can be resent."""
    raw = security.generate_url_token()
    await user_repository.create_email_token(
        user_id, security.hash_url_token(raw), "verify",
        get_settings().EMAIL_TOKEN_TTL_MINUTES,
    )
    try:
        await send_verification_email(email, raw)
    except EmailDeliveryError:
        logger.warning("Verification email to %s could not be delivered", email)
