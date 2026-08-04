"""
Summarization service.

Length control (short / medium / long) happens by sending the model server a
fully-formed prompt with a scaled word target — the server's own template
hardcodes ~10% (see app/core/prompts.py SUMMARY_LENGTHS).
"""

from app.core.model_gateway import model_generate
from app.core.prompts import resolve_length
from app.repositories.base import persist_if_owned
from app.repositories.summarizer_repository import save_summary
from app.schemas.summarizer import SummarizerResponse


async def summarize_text(
    text: str, length: str = "medium", user_id: str | None = None
) -> SummarizerResponse:
    """Summarize `text` at the requested length, persist for a known caller, and return."""
    resolved = resolve_length(length)
    result = await model_generate("summarizer", text, length=resolved)
    summary = result.text or text
    input_tokens = result.meta.get("input_tokens")
    output_tokens = result.meta.get("output_tokens")

    record = {
        "original_text": text,
        "summary_text": summary,
        "length": resolved,
        "model_provider": result.provider,
        "latency_ms": result.latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
    saved = await persist_if_owned(save_summary, record, user_id)

    return SummarizerResponse(
        id=str(saved["id"]),
        original=text,
        summary=summary,
        length=resolved,
        model_used=result.provider,
        created_at=saved.get("created_at"),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
