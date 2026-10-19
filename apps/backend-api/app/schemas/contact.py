"""Portfolio contact-form payload."""

from pydantic import BaseModel, EmailStr, Field, field_validator


class ContactMessage(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)
    # Honeypot: hidden from people by the form, filled in by naive bots.
    website: str = Field(default="", max_length=200)

    @field_validator("name", "message", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("name")
    @classmethod
    def _single_line(cls, v: str) -> str:
        # The name goes into the Subject header; a newline there is header
        # injection, not a name.
        if "\n" in v or "\r" in v:
            raise ValueError("The name must be a single line.")
        return v
