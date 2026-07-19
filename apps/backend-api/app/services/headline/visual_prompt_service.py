"""
Visual prompt generation service.

Reads a Sinhala news article (and optional headline) via Groq (LLaMA 3.3 70B)
and produces a detailed English prompt suitable for text-to-image models
(Stable Diffusion, DALL-E, Midjourney, etc.).
"""

import logging

from app.core.groq_client import GroqUnavailable, groq_chat

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an expert news photo editor and AI image prompt writer. "
    "Your job is to read a Sinhala news article and produce a single, "
    "detailed English image-generation prompt (for models like Stable Diffusion "
    "or DALL-E) that visually captures the most newsworthy moment described. "
    "Requirements:\n"
    "- Write ONLY the image prompt — no explanations, no preamble.\n"
    "- The prompt must be in English.\n"
    "- Include: subject, setting/location, lighting, mood, photographic style, "
    "  camera angle, and any key visual details specific to the article.\n"
    "- Length: 3-5 sentences or 60-120 words.\n"
    "- Style: photorealistic news photography unless the article is about art/culture.\n"
    "- Do NOT include any text overlays, logos, or watermarks in the description."
)


def _build_user_message(article_text: str, headline: str) -> str:
    headline_line = f"Headline: {headline}\n\n" if headline.strip() else ""
    return (
        f"{headline_line}"
        f"Article (Sinhala):\n{article_text}\n\n"
        "Write a detailed English image-generation prompt for a news photograph "
        "that best illustrates this article."
    )


async def generate_visual_prompt(article_text: str, headline: str = "") -> str:
    """
    Call Groq to produce a detailed image-generation prompt.

    Args:
        article_text: The Sinhala article body.
        headline:     The chosen headline (improves prompt specificity).

    Returns:
        A detailed English image-generation prompt string.

    Raises:
        GroqUnavailable: if the API key is missing or the call fails.
        RuntimeError: if the model returns an empty response.
    """
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_message(article_text, headline)},
    ]

    logger.info(
        "Generating visual prompt via Groq (article length=%d chars)",
        len(article_text),
    )

    prompt = await groq_chat(messages, temperature=0.7, max_tokens=300)

    if not prompt or not prompt.strip():
        raise RuntimeError("Groq returned an empty visual prompt")

    return prompt.strip()
