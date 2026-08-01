"""
The whitelist of runtime-settable configuration.

This registry is the security boundary for the settings API. Anything not
listed here is rejected before it reaches the database — an open key/value
write endpoint would be arbitrary config injection.

Deliberately absent: every secret and every service URL. `SINLLAMA_API_URL`
in particular stays env-only, because a DB-editable inference endpoint would
let one compromised admin account redirect every article to a host they
control. Those values live in `config.py` and change only by redeploy.

Types are constrained on purpose — booleans, bounded integers, and closed
enums. No free-form strings: every current setting is a choice from a known
set, and free text is where injection lives.
"""

from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.core.prompts import STYLE_INSTRUCTIONS, SUMMARY_LENGTHS


@dataclass(frozen=True)
class SettingSpec:
    """One settable key: its shape, its fallback, and what it does."""

    kind: str  # "bool" | "int" | "enum"
    default: Any
    description: str
    choices: tuple[str, ...] | None = None
    minimum: int | None = None
    maximum: int | None = None
    group: str = "General"


def _env_default(attribute: str, fallback: Any) -> Any:
    """Read a starting value from env so behaviour is unchanged until set."""
    return getattr(get_settings(), attribute, fallback)


def build_registry() -> dict[str, SettingSpec]:
    """
    The registry, built at import time.

    Style and length choices come from `prompts.py` rather than being written
    out again here, so the options an admin can pick never drift from what
    the model was actually trained on.
    """
    return {
        "model.provider": SettingSpec(
            kind="enum",
            choices=("sinllama", "openrouter", "mock"),
            default=_env_default("MODEL_PROVIDER", "mock"),
            group="Model gateway",
            description=(
                "Primary inference provider. 'sinllama' is the fine-tuned research "
                "model, 'openrouter' a hosted stand-in, 'mock' deterministic offline output."
            ),
        ),
        "model.fallback_enabled": SettingSpec(
            kind="bool",
            default=_env_default("MODEL_FALLBACK", True),
            group="Model gateway",
            description=(
                "Fall through sinllama → openrouter → mock when a provider fails. "
                "Turning this off surfaces a 503 instead of degrading."
            ),
        ),
        "features.grammar": SettingSpec(
            kind="bool", default=True, group="Tools",
            description="Grammar Checker is available to users.",
        ),
        "features.headlines": SettingSpec(
            kind="bool", default=True, group="Tools",
            description="Headline Generator is available to users.",
        ),
        "features.rewriter": SettingSpec(
            kind="bool", default=True, group="Tools",
            description="Style Rewriter is available to users.",
        ),
        "features.summarizer": SettingSpec(
            kind="bool", default=True, group="Tools",
            description="News Summarizer is available to users.",
        ),
        "defaults.tone": SettingSpec(
            kind="enum",
            choices=tuple(STYLE_INSTRUCTIONS.keys()),
            default="formal",
            group="Defaults",
            description="Starting style for the rewriter, before a user picks their own.",
        ),
        "defaults.length": SettingSpec(
            kind="enum",
            choices=tuple(SUMMARY_LENGTHS.keys()),
            default="short",
            group="Defaults",
            description="Starting summary length, before a user picks their own.",
        ),
        "defaults.headline_count": SettingSpec(
            kind="int", default=5, minimum=1, maximum=10, group="Defaults",
            description="How many headline candidates to generate by default.",
        ),
        "limits.anon_per_hour": SettingSpec(
            kind="int",
            default=_env_default("ANON_REQUESTS_PER_HOUR", 20),
            minimum=0,
            maximum=1000,
            group="Limits",
            description=(
                "Requests an unauthenticated visitor may make per hour, per IP. "
                "Anonymous traffic reaches GPU inference, so this is a cost control."
            ),
        ),
    }


REGISTRY: dict[str, SettingSpec] = build_registry()


def validate(key: str, value: Any) -> Any:
    """
    Check a proposed value against its spec, returning the coerced value.

    Raises:
        ValueError: unknown key, wrong type, or out of range. The message is
            safe to show an admin — these are their own inputs.
    """
    spec = REGISTRY.get(key)
    if spec is None:
        raise ValueError(f"Unknown setting: {key}")

    if spec.kind == "bool":
        if not isinstance(value, bool):
            raise ValueError(f"{key} must be true or false")
        return value

    if spec.kind == "int":
        # bool is a subclass of int in Python; without this check, True would
        # silently be accepted as 1.
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{key} must be a whole number")
        if spec.minimum is not None and value < spec.minimum:
            raise ValueError(f"{key} must be at least {spec.minimum}")
        if spec.maximum is not None and value > spec.maximum:
            raise ValueError(f"{key} must be at most {spec.maximum}")
        return value

    # enum
    if value not in (spec.choices or ()):
        allowed = ", ".join(spec.choices or ())
        raise ValueError(f"{key} must be one of: {allowed}")
    return value
