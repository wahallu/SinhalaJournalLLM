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

    # Salt for hashing client IPs. Raw IPs are never stored.
    IP_HASH_SALT: str = ""

    # ── Authentication (self-hosted; replaced Supabase Auth) ──
    # Signing key for our own access/refresh tokens. No default: an empty
    # value makes security._secret() refuse to issue or verify anything
    # rather than silently signing with a guessable key.
    #   python -c "import secrets; print(secrets.token_urlsafe(64))"
    JWT_SECRET: str = ""
    # Short, because an access token cannot be revoked before it expires.
    ACCESS_TOKEN_TTL_MINUTES: int = 30
    REFRESH_TOKEN_TTL_DAYS: int = 30
    # How long an emailed password-reset or verification link stays valid.
    EMAIL_TOKEN_TTL_MINUTES: int = 60

    # OAuth 2.0 Web Client ID from Google Cloud Console → APIs & Services →
    # Credentials. Not secret — the frontend embeds the same value to render
    # the Sign in with Google button. Empty disables POST /auth/google.
    GOOGLE_CLIENT_ID: str = ""

    # ── Outbound email (Gmail SMTP) ──
    # Gmail requires an App Password (16 characters, account must have 2FA
    # enabled) — a normal account password will not authenticate. Free Gmail
    # allows roughly 500 messages a day.
    # Leave SMTP_HOST empty to disable sending: signup still works, but
    # verification and password-reset links are logged instead of mailed,
    # which is what local development wants.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    # Base URL of the web app, used to build links in those emails.
    APP_BASE_URL: str = "http://localhost:5173"

    # Anonymous requests allowed per hour per client IP. Anonymous use means
    # unauthenticated GPU inference, so this is a cost control, not a nicety.
    ANON_REQUESTS_PER_HOUR: int = 20

    # How many proxies sit in front of this app and append to
    # X-Forwarded-For. Only the last N entries are trustworthy; the client
    # is the one just before them. Render's load balancer is one hop.
    TRUSTED_PROXY_COUNT: int = 1

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

    # Groq — used for style rewriting.
    GROQ_STYLE_API_KEY: str = ""
    GROQ_STYLE_MODEL: str = "llama3-8b-8192"

    # OpenRouter Image Generation
    OPENROUTER_IMAGE_API_KEY: str = ""

    # OpenAI Image Generation Configs
    OPENAI_API_KEY: str = ""
    IMAGE_API_KEY: str = ""
    IMAGE_MODEL: str = "gpt-image-1"
    IMAGE_GATEWAY_URL: str = "https://api.openai.com/v1"

    # ── CORS ──
    CORS_ORIGINS: str = "http://localhost:5173,https://sinai.onrender.com"

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


