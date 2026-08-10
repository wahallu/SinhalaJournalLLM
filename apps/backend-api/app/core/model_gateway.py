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

import httpx
import time
from dataclasses import dataclass, field
from typing import Any

from app.core import mock_provider
from app.core import runtime_settings
from app.core.config import get_settings
from app.core.openrouter_client import OpenRouterUnavailable, openrouter_chat
from app.core.prompts import (
    DEFAULT_HEADLINE_LENGTH,
    DEFAULT_LENGTH,
    DEFAULT_STYLE,
    HEADLINE_LENGTHS,
    STYLE_INSTRUCTIONS,
    SUMMARY_LENGTHS,
    prompt_headline,
    prompt_summarizer,
    resolve_headline_length,
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


def add_tokens(total: int | None, delta: int | None) -> int | None:
    """
    Accumulate a token count across the several gateway calls one request can
    make (headline candidates, the grammar second pass).

    None means "this provider does not report token counts" — only sinllama
    does; _via_openrouter returns just the model name and _via_mock returns
    nothing. That has to stay None rather than collapsing to 0, because an
    unknown count and a genuine zero are different facts and the admin Chats
    view renders them differently.
    """
    if delta is None:
        return total
    return (total or 0) + delta


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
    num_candidates: int = 1,
    adapter: str | None = None,
) -> GatewayResult:
    """
    Run one inference through the provider chain.

    Args:
        task:           grammar | headline | summarizer | style
        text:           raw Sinhala input text
        style:          style task only — resolved via prompts.resolve_style
        length:         summarizer (compression band) and headline (word
                        band) — short | medium | long. Resolved per task:
                        the two vocabularies share names, not meanings.
        category:       headline task only — news category (default "General")
        variation_hint: headline only — extra instruction line that steers
                        each candidate toward a different angle (actor,
                        number, location, ...) rather than leaving diversity
                        to sampling alone
        num_candidates: sinllama only (self-consistency sampling) — >1 asks
                        the server for that many sampled candidates in one
                        call, surfaced on the result as
                        meta["candidates"]. openrouter and mock ignore it and
                        always return exactly one.
        adapter:        sinllama only — a specific adapter/version to run,
                        overriding the admin's `adapters.{task}` runtime
                        setting for this one call. Callers pass this for a
                        user-facing model picker; leave unset to keep using
                        the admin-configured default.
    """
    if task not in TASKS:
        raise ValueError(f"Unknown task {task!r}; expected one of {TASKS}")

    resolved_style = resolve_style(style) if task == "style" else None
    if task == "summarizer":
        resolved_length = resolve_length(length)
    elif task == "headline":
        resolved_length = resolve_headline_length(length)
    else:
        resolved_length = None
    resolved_category = category or "General"

    errors: list[str] = []
    for provider in await _provider_chain():
        started = time.perf_counter()
        try:
            if provider == "sinllama":
                result_text, meta = await _via_sinllama(
                    task, text, resolved_style, resolved_length, resolved_category, variation_hint,
                    num_candidates=num_candidates, adapter=adapter,
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
        if task in ("summarizer", "headline"):
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
    *,
    num_candidates: int = 1,
    adapter: str | None = None,
) -> tuple[str, dict]:
    """
    Build the request per the serve_sinai.py contract. Raw text lets the
    server apply its own (identical) template; a fully-formed prompt is sent
    when we need knobs the server doesn't expose.
    """
    if task == "headline":
        prompt = prompt_headline(
            text,
            category=category or "General",
            variation_hint=variation_hint,
            length=length or DEFAULT_HEADLINE_LENGTH,
        )
    else:
        prompt = text

    # A caller-supplied adapter (the headline model picker) wins over the
    # admin's global `adapters.{task}` runtime setting; neither set means
    # "let the server use its task default".
    adapter = (adapter or "").strip()
    if not adapter:
        adapter = str(await runtime_settings.get(f"adapters.{task}") or "").strip()

    try:
        data = await sinllama_generate(
            prompt, task, style, length=length or DEFAULT_LENGTH,
            adapter=adapter or None, num_candidates=num_candidates,
        )
    except httpx.HTTPStatusError as exc:
        # 422 here means the server rejected the adapter — it was renamed,
        # deleted, or belongs to another task. Retry on the task default
        # rather than failing the user's request over a stale setting.
        if adapter and exc.response.status_code == 422:
            logger.warning(
                "Model server rejected adapter %r for task %s — falling back "
                "to the task default. Update the setting in the dashboard.",
                adapter, task,
            )
            data = await sinllama_generate(
                prompt, task, style, length=length or DEFAULT_LENGTH,
                num_candidates=num_candidates,
            )
        else:
            raise

    meta = {
        "input_tokens": data.get("input_tokens"),
        "output_tokens": data.get("output_tokens"),
        "adapter": data.get("adapter"),
    }
    if num_candidates > 1 and data.get("candidates"):
        meta["candidates"] = data["candidates"]
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
        band = HEADLINE_LENGTHS[length or DEFAULT_HEADLINE_LENGTH]
        return (
            f"Generate a concise Sinhala news headline for the article below.\nCategory: {cat}\n"
            f"Rules: Use formal Sinhala journalism style, "
            f"{band['min_words']} to {band['max_words']} words, "
            f"output ONLY the headline.{hint}\n\n{text}"
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
        band = HEADLINE_LENGTHS[length or DEFAULT_HEADLINE_LENGTH]
        return (
            mock_provider.mock_headline(
                text, index, min_words=band["min_words"], max_words=band["max_words"]
            ),
            {},
        )
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
