"""
Style rewriting service.

Rewrites text into one of the five newspaper styles the style adapter was
trained on (formal, sports, youth, editorial, feature). Legacy tone values
from older clients (journalistic, casual, ...) are mapped via resolve_style.
"""

from typing import TYPE_CHECKING

from app.core.model_gateway import model_generate
from app.core.prompts import resolve_style
from app.repositories.base import persist_if_owned
from app.repositories.style_repository import save_rewrite
from app.schemas.style import StyleRewriteResponse

if TYPE_CHECKING:
    from app.core.research import Actor


async def rewrite_style(
    text: str,
    tone: str = "formal",
    user_id: str | None = None,
    actor: "Actor | None" = None,
) -> StyleRewriteResponse:
    """Rewrite `text` in the requested style, persist for a known caller, and return."""
    style = resolve_style(tone)
    result = await model_generate("style", text, style=style)
    rewritten = result.text or text
    input_tokens = result.meta.get("input_tokens")
    output_tokens = result.meta.get("output_tokens")

    record = {
        "original_text": text,
        "rewritten_text": rewritten,
        "style": style,
        "model_provider": result.provider,
        "latency_ms": result.latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
    saved = await persist_if_owned(save_rewrite, record, user_id, actor)

    return StyleRewriteResponse(
        id=str(saved["id"]),
        original=text,
        rewritten=rewritten,
        tone=tone,
        style=style,
        model_used=result.provider,
        created_at=saved.get("created_at"),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
