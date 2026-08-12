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

import re
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.core.prompts import STYLE_INSTRUCTIONS, SUMMARY_LENGTHS


# Folder names only — no path separators, so a value cannot be coaxed
# into traversing the adapters directory on the model server.
_ADAPTER_NAME = re.compile(r"[A-Za-z0-9._-]{1,128}")


@dataclass(frozen=True)
class SettingSpec:
    """One settable key: its shape, its fallback, and what it does."""

    kind: str  # "bool" | "int" | "enum" | "adapter"
    default: Any
    description: str
    choices: tuple[str, ...] | None = None
    minimum: int | None = None
    maximum: int | None = None
    group: str = "General"
    # "adapter" keys only: which inference task the adapter must belong to.
    # The choices are discovered from the GPU box at runtime rather than
    # listed here, so the admin UI fetches them separately. The inference
    # server is the authority on whether an adapter exists and matches its
    # task; this side only enforces a safe shape.
    task: str | None = None


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
        # ── Grammar Checker ──
        # Split across two groups on purpose: "Grammar" is what the admin
        # Settings UI shows on the tool's own page as its basic control,
        # "Grammar Advanced" is the second section on that same page — the
        # only tool with one today (see grammar_service.py: the self-
        # consistency ensemble is a real generation-quality knob, unlike the
        # other tools, which have nothing past their adapter override yet).
        "features.grammar": SettingSpec(
            kind="bool", default=True, group="Grammar",
            description="Grammar Checker is available to users.",
        ),
        "adapters.grammar": SettingSpec(
            kind="adapter", task="grammar", default="", group="Grammar Advanced",
            description="Specific LoRA adapter for the Grammar Checker. "
                        "Leave empty to use the newest one the model server resolved.",
        ),
        "grammar.spellcheck_ratio": SettingSpec(
            kind="int", default=3, minimum=0, maximum=100, group="Grammar Advanced",
            description=(
                "Dictionary spell-check sensitivity. A word the 106k-article "
                "news corpus has essentially never seen is flagged when a "
                "near-identical spelling is at least this many times commoner. "
                "Suggestions only — they are never applied to the text. "
                "Measured on what the model leaves wrong: 38% of remaining "
                "single-word errors caught, for 1 flag across 44 already-correct "
                "sentences, and unchanged anywhere from 1 to 10. Above 25 it "
                "starts losing catches without removing flags. 0 turns it off."
            ),
        ),
        "grammar.chunk_chars": SettingSpec(
            kind="int", default=200, minimum=120, maximum=10000, group="Grammar Advanced",
            description=(
                "Longest piece of text sent to the grammar model in one call. "
                "Longer input is split on sentence boundaries and reassembled. "
                "200 keeps each call near the shape the adapter was trained on: "
                "cleaned_v8_full.jsonl is 82% one-to-two sentences, median 110 "
                "characters, and the training data stops at 332. Raising it "
                "means fewer, slower calls on text longer than most training "
                "examples — and fix-density is a measured failure mode, where "
                "the model catches some errors in a long passage but not all. "
                "10000 effectively disables chunking."
            ),
        ),
        "grammar.ensemble_size": SettingSpec(
            kind="int", default=1, minimum=1, maximum=5, group="Grammar Advanced",
            description=(
                "Self-consistency candidates sampled per check (one generate() "
                "call, num_return_sequences). 1 disables the ensemble — a single "
                "greedy generation, byte-identical to today's default. Above 1 "
                "trades latency for a consensus pick across sampled candidates; "
                "see grammar_service._pick_consensus()."
            ),
        ),
        "grammar.rule_validation_enabled": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_RULE_VALIDATION_ENABLED", True),
            group="Grammar Advanced",
            description="Validate neural grammar candidates with deterministic safety and linguistic rules.",
        ),
        "grammar.auto_safe_orthography": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_AUTO_SAFE_ORTHOGRAPHY", True),
            group="Grammar Advanced",
            description="Apply NFC and semantics-preserving horizontal spacing rules.",
        ),
        "grammar.protect_entities": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_PROTECT_ENTITIES", True),
            group="Grammar Advanced",
            description="Block probable name and protected glossary mutations.",
        ),
        "grammar.protect_numbers": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_PROTECT_NUMBERS", True),
            group="Grammar Advanced",
            description="Block changes to factual numbers, dates, percentages, and quantities.",
        ),
        "grammar.protect_quotes": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_PROTECT_QUOTES", True),
            group="Grammar Advanced",
            description="Downgrade rewrites inside direct quotations to suggestions.",
        ),
        "grammar.agreement_validation": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_AGREEMENT_VALIDATION", True),
            group="Grammar Advanced",
            description="Check known subject/predicate features, including the inanimate-plural exception.",
        ),
        "grammar.contextual_rules": SettingSpec(
            kind="bool", default=_env_default("GRAMMAR_CONTEXTUAL_RULES", True),
            group="Grammar Advanced",
            description="Keep deixis, honorific, register, and related context-dependent changes advisory.",
        ),

        # ── Headline Generator ──
        "features.headlines": SettingSpec(
            kind="bool", default=True, group="Headline Generator",
            description="Headline Generator is available to users.",
        ),
        "defaults.headline_count": SettingSpec(
            kind="int", default=5, minimum=1, maximum=10, group="Headline Generator",
            description="How many headline candidates to generate by default.",
        ),
        "adapters.headline": SettingSpec(
            kind="adapter", task="headline", default="", group="Headline Generator",
            description="Specific LoRA adapter for the Headline Generator. "
                        "Leave empty to use the newest one the model server resolved.",
        ),

        # ── Style Rewriter ──
        "features.rewriter": SettingSpec(
            kind="bool", default=True, group="Style Rewriter",
            description="Style Rewriter is available to users.",
        ),
        "defaults.tone": SettingSpec(
            kind="enum",
            choices=tuple(STYLE_INSTRUCTIONS.keys()),
            default="formal",
            group="Style Rewriter",
            description="Starting style for the rewriter, before a user picks their own.",
        ),
        "adapters.style": SettingSpec(
            kind="adapter", task="style", default="", group="Style Rewriter",
            description="Specific LoRA adapter for the Style Rewriter. "
                        "Leave empty to use the newest one the model server resolved.",
        ),

        # ── News Summarizer ──
        "features.summarizer": SettingSpec(
            kind="bool", default=True, group="News Summarizer",
            description="News Summarizer is available to users.",
        ),
        "defaults.length": SettingSpec(
            kind="enum",
            choices=tuple(SUMMARY_LENGTHS.keys()),
            default="short",
            group="News Summarizer",
            description="Starting summary length, before a user picks their own.",
        ),
        "adapters.summarizer": SettingSpec(
            kind="adapter", task="summarizer", default="", group="News Summarizer",
            description="Specific LoRA adapter for the News Summarizer. "
                        "Leave empty to use the newest one the model server resolved.",
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

    if spec.kind == "adapter":
        # Empty means "use the task default". Otherwise only a shape check:
        # the inference server owns the real list and refuses an adapter that
        # does not exist or belongs to another task, and it can add or remove
        # adapter folders without this service knowing.
        if not isinstance(value, str):
            raise ValueError(f"{key} must be an adapter folder name, or empty")
        value = value.strip()
        if value and not _ADAPTER_NAME.fullmatch(value):
            raise ValueError(
                f"{key} must be an adapter folder name "
                "(letters, digits, dot, dash, underscore)"
            )
        return value

    # enum
    if value not in (spec.choices or ()):
        allowed = ", ".join(spec.choices or ())
        raise ValueError(f"{key} must be one of: {allowed}")
    return value
