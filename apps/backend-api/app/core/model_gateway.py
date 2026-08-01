"""
Model gateway — single entry point for all LLM inference.

Services call `model_generate(...)` and never talk to a provider directly.
Providers, in fallback order:

    sinllama   → the fine-tuned SinLlama inference server (the research model)
    openrouter → hosted LLM stand-in when the GPU server is offline
    mock       → deterministic rule-based output, never fails

The primary provider comes from settings.MODEL_PROVIDER; when
settings.MODEL_FALLBACK is true a failing provider falls through to the next
in the chain, so the product keeps working while the GPU box is down.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.core import mock_provider
from app.core import runtime_settings
from app.core.config import get_settings
from app.core.openrouter_client import OpenRouterUnavailable, openrouter_chat
from app.core.prompts import (
    DEFAULT_LENGTH,
    DEFAULT_STYLE,
    STYLE_INSTRUCTIONS,
    SUMMARY_LENGTHS,
    prompt_headline,
    prompt_summarizer,
    resolve_length,
    resolve_style,
)
from app.models.sinllama_loader import SinLlamaUnavailable, sinllama_generate

logger = logging.getLogger(__name__)

TASKS = ("grammar", "headline", "summarizer", "style")

_PROVIDER_ORDER = ("sinllama", "openrouter", "mock")


@dataclass
class GatewayResult:
    """Outcome of one inference call."""
    text: str
    provider: str
    latency_ms: int
    meta: dict[str, Any] = field(default_factory=dict)


class ModelGatewayError(Exception):
    """All providers failed (only possible when MODEL_FALLBACK is off)."""


async def _provider_chain() -> list[str]:
    """
    Providers to try, in order.

    Read from runtime settings rather than env so an admin can switch
    provider from the dashboard without a redeploy. An unrecognized value
    still degrades to mock with a warning instead of raising — a bad setting
    should not take inference down.
    """
    primary = str(await runtime_settings.get("model.provider")).strip().lower()
    if primary not in _PROVIDER_ORDER:
        logger.warning("Unknown model.provider %r — defaulting to mock", primary)
        primary = "mock"
    if not await runtime_settings.get("model.fallback_enabled"):
        return [primary]
    return [primary] + [p for p in _PROVIDER_ORDER if p != primary]


async def model_generate(
    task: str,
    text: str,
    *,
    style: str | None = None,
    length: str | None = None,
    category: str | None = None,
    variation_hint: str | None = None,
) -> GatewayResult:
    """
    Run one inference through the provider chain.

    Args:
        task:           grammar | headline | summarizer | style
        text:           raw Sinhala input text
        style:          style task only — resolved via prompts.resolve_style
        length:         summarizer only — short | medium | long
        category:       headline task only — news category (default "General")
        variation_hint: headline only — extra instruction line for candidate
                        diversity (greedy decoding returns identical output
                        for identical prompts)
    """
    if task not in TASKS:
        raise ValueError(f"Unknown task {task!r}; expected one of {TASKS}")

    resolved_style = resolve_style(style) if task == "style" else None
    resolved_length = resolve_length(length) if task == "summarizer" else None
    resolved_category = category or "General"

    errors: list[str] = []
    for provider in await _provider_chain():
        started = time.perf_counter()
        try:
            if provider == "sinllama":
                result_text, meta = await _via_sinllama(
                    task, text, resolved_style, resolved_length, resolved_category, variation_hint
                )
            elif provider == "openrouter":
                result_text, meta = await _via_openrouter(
                    task, text, resolved_style, resolved_length, resolved_category, variation_hint
                )
            else:
                result_text, meta = _via_mock(
                    task, text, resolved_style, resolved_length, resolved_category, variation_hint
                )
        except (SinLlamaUnavailable, OpenRouterUnavailable) as exc:
            errors.append(f"{provider}: {exc}")
            logger.warning("Provider %s failed (%s) — trying next", provider, exc)
            continue

        latency_ms = int((time.perf_counter() - started) * 1000)
        if task == "style":
            meta["style"] = resolved_style
        if task == "summarizer":
            meta["length"] = resolved_length
        if task == "headline":
            meta["category"] = resolved_category
        return GatewayResult(
            text=result_text.strip(),
            provider=provider,
            latency_ms=latency_ms,
            meta=meta,
        )

    raise ModelGatewayError("; ".join(errors) or "No providers configured")


# ── SinLlama ──

async def _via_sinllama(
    task: str,
    text: str,
    style: str | None,
    length: str | None,
    category: str | None,
    variation_hint: str | None,
) -> tuple[str, dict]:
    """
    Build the request per the serve_sinai.py contract. Raw text lets the
    server apply its own (identical) template; a fully-formed prompt is sent
    when we need knobs the server doesn't expose.
    """
    if task == "summarizer":
        # Length control: server hardcodes a ~10% target, so send our prompt.
        prompt = prompt_summarizer(text, length or DEFAULT_LENGTH)
    elif task == "headline":
        prompt = prompt_headline(text, category=category or "General", variation_hint=variation_hint)
    else:
        prompt = text

    data = await sinllama_generate(prompt, task, style)
    meta = {
        "input_tokens": data.get("input_tokens"),
        "output_tokens": data.get("output_tokens"),
    }
    return data["response"], meta



# ── OpenRouter ──

_OPENROUTER_SYSTEM = (
    "You are an expert Sinhala journalist and language editor. "
    "Respond with ONLY the requested Sinhala text — no explanations, "
    "no markdown, no quotation marks, no English."
)


def _openrouter_user_message(
    task: str,
    text: str,
    style: str | None,
    length: str | None,
    category: str | None,
    variation_hint: str | None,
) -> str:
    if task == "grammar":
        return (
            "පහත සිංහල පාඨයේ ඇති වාකරණ දෝෂ, අක්ෂර වින්‍යාස දෝෂ සහ විරාම ලකුණු "
            "දෝෂ නිවැරදි කරන්න. නිවැරදි කළ පාඨය පමණක් ලියන්න.\n\n"
            f"{text}"
        )
    if task == "headline":
        hint = f"\n{variation_hint}" if variation_hint else ""
        cat = category or "General"
        return (
            f"Generate a concise Sinhala news headline for the article below.\nCategory: {cat}\n"
            f"Rules: Use formal Sinhala journalism style, 4 to 7 words, output ONLY the headline.{hint}\n\n{text}"
        )
    if task == "summarizer":
        cfg = SUMMARY_LENGTHS[length or DEFAULT_LENGTH]
        target = max(cfg["min_words"], int(len(text.split()) * cfg["ratio"]))
        return (
            f"පහත සිංහල පුවත් ලිපිය වචන {target}කට සීමා කර සාරාංශ කරන්න. "
            f"ප්‍රධාන කරුණු පමණක් ඇතුළත් කරන්න.\n\n{text}"
        )
    # style
    instruction = STYLE_INSTRUCTIONS.get(style or DEFAULT_STYLE)
    return f"{instruction}\nඅර්ථය වෙනස් නොකරන්න.\n\n{text}"


async def _via_openrouter(
    task: str,
    text: str,
    style: str | None,
    length: str | None,
    category: str | None,
    variation_hint: str | None,
) -> tuple[str, dict]:
    messages = [
        {"role": "system", "content": _OPENROUTER_SYSTEM},
        {"role": "user", "content": _openrouter_user_message(task, text, style, length, category, variation_hint)},
    ]
    temperature = 0.7 if task == "headline" else 0.2
    content = await openrouter_chat(messages, temperature=temperature, max_tokens=2048)
    settings = get_settings()
    return content, {"openrouter_model": settings.OPENROUTER_MODEL}


# ── Mock ──

def _via_mock(
    task: str,
    text: str,
    style: str | None,
    length: str | None,
    category: str | None,
    variation_hint: str | None,
) -> tuple[str, dict]:

    if task == "grammar":
        return mock_provider.mock_grammar(text), {}
    if task == "headline":
        from app.core.prompts import HEADLINE_VARIATION_HINTS

        index = (
            HEADLINE_VARIATION_HINTS.index(variation_hint)
            if variation_hint in HEADLINE_VARIATION_HINTS
            else 0
        )
        return mock_provider.mock_headline(text, index), {}
    if task == "summarizer":
        cfg = SUMMARY_LENGTHS[length or DEFAULT_LENGTH]
        target = max(cfg["min_words"], int(len(text.split()) * cfg["ratio"]))
        return mock_provider.mock_summarize(text, target), {}
    return mock_provider.mock_style(text, style or DEFAULT_STYLE), {}


# ── Health ──

async def gateway_status() -> dict[str, Any]:
    """Provider availability snapshot for /health and /api/v1/meta."""
    from app.models.sinllama_loader import sinllama_health

    settings = get_settings()
    sinllama_ok = await sinllama_health()
    return {
        "primary": await runtime_settings.get("model.provider"),
        "fallback_enabled": await runtime_settings.get("model.fallback_enabled"),
        "providers": {
            # No "url" field — the inference server's address is a backend
            # implementation detail and must never reach a client.
            "sinllama": {
                "available": sinllama_ok,
            },
            "openrouter": {
                "configured": bool(settings.OPENROUTER_API_KEY),
                "model": settings.OPENROUTER_MODEL,
            },
            "mock": {"available": True},
        },
    }
