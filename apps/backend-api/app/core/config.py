"""
Application configuration loaded from environment variables.
Uses pydantic-settings for type-safe config with .env file support.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from the backend-api app root (apps/backend-api/.env),
# not the repo root — each app under apps/ owns its own config.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Global application settings, auto-loaded from .env file."""

    # ── Supabase ──
    PUBLIC_SUPABASE_URL: str
    # Server-only secret: bypasses Row Level Security. Must never reach a
    # client app (web-app, chrome-extension, etc.).
    SUPABASE_SERVICE_ROLE_KEY: str

    @field_validator("PUBLIC_SUPABASE_URL")
    @classmethod
    def _strip_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/")

    # ── App ──
    APP_ENV: str = "development"

    # ── Model gateway ──
    # Primary inference provider:
    #   sinllama   → the research team's SinLlama inference server
    #                (SinAI-Training/work/sinllama/serve_sinai.py)
    #   openrouter → hosted LLM stand-in for when the GPU server is offline
    #   mock       → deterministic rule-based output, no network needed
    MODEL_PROVIDER: str = "mock"
    # When true, a failing provider falls through the chain
    # sinllama → openrouter → mock instead of surfacing a 502.
    MODEL_FALLBACK: bool = True

    # SinLlama inference server (serve_sinai.py) base URL.
    SINLLAMA_API_URL: str = "http://localhost:8000"
    # Comparison server base URL (merged with serve_sinai.py on port 8000).
    SINLLAMA_COMPARISON_API_URL: str = "http://localhost:8000"
    SINLLAMA_TIMEOUT_SECONDS: float = 120.0

    @field_validator("SINLLAMA_API_URL", "SINLLAMA_COMPARISON_API_URL")
    @classmethod
    def _strip_model_url_slash(cls, v: str) -> str:
        return v.rstrip("/")

    # OpenRouter fallback (optional — provider is skipped when key is empty).
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openrouter/free"

    # Groq — used for visual prompt generation.
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Cloudflare Workers AI — used for image generation from visual prompts.
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_API_TOKEN: str = ""

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


