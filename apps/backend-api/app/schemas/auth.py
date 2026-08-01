"""The authenticated caller, as resolved from a verified JWT plus profiles."""

from pydantic import BaseModel, Field


class AuthUser(BaseModel):
    """A verified caller. Never constructed from unverified input."""

    id: str
    email: str
    role: str = "user"
    status: str = "active"
    category_id: str | None = None
    # The caller's raw JWT, used to build an RLS-scoped database client.
    # Internal only — excluded from any response model, and never logged.
    token: str | None = Field(default=None, exclude=True, repr=False)

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
