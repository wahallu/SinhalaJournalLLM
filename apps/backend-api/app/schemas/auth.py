"""
The authenticated caller, plus the request/response shapes for
self-hosted signup, login and the emailed-link flows.
"""

from pydantic import BaseModel, EmailStr, Field

# bcrypt hashes at most 72 bytes and refuses longer input rather than
# truncating (see core/security.py). The ceiling is expressed in characters
# here because that is all Pydantic can constrain; security.hash_password
# does the exact byte check and is the real gate — 72 characters of Sinhala
# is 216 bytes, so a valid-looking password can still be rejected there.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 72


class AuthUser(BaseModel):
    """A verified caller. Never constructed from unverified input."""

    id: str
    email: str
    role: str = "user"
    status: str = "active"
    category_id: str | None = None
    # The caller's raw JWT. Internal only — excluded from any response model
    # and never logged. Nothing reads it any more: it used to build a
    # per-caller database client for RLS, which the self-hosted auth
    # migration removed. Kept because it is the verified token for the
    # current request and is cheap to carry, but a new caller wanting
    # per-user data should filter on `id`, not authenticate as this token.
    token: str | None = Field(default=None, exclude=True, repr=False)

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


# ── Requests ──

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    full_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)


class VerifyEmailRequest(BaseModel):
    token: str


# ── Responses ──

class AccountResponse(BaseModel):
    """The signed-in account, as the web app needs it."""

    id: str
    email: str
    role: str = "user"
    status: str = "active"
    category_id: str | None = None
    email_verified: bool = False
    full_name: str | None = None


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AccountResponse


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
