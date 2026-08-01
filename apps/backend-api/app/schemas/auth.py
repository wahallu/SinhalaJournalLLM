"""The authenticated caller, as resolved from a verified JWT plus profiles."""

from pydantic import BaseModel


class AuthUser(BaseModel):
    """A verified caller. Never constructed from unverified input."""

    id: str
    email: str
    role: str = "user"
    status: str = "active"
    category_id: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
