"""
Application configuration loaded from environment variables.
Uses pydantic-settings for type-safe config with .env file support.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from the backend-api app root (apps/backend-api/.env),
# not the repo root — each app under apps/ owns its own config.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Global application settings, auto-loaded from .env file."""

    # ── Database ──
    DATABASE_URL: str

    # ── App ──
    APP_ENV: str = "development"

    # ── CORS ──
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton for app settings."""
    return Settings()
