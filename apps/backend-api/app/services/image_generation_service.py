"""
Pollinations AI image generation service.

Generates image URLs dynamically via Pollinations AI.

Base URL:
    https://image.pollinations.ai/prompt/

Auth:
    None required.
"""

from urllib.parse import quote

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt/"


async def generate_image(prompt: str) -> str:
    """
    Generate an image URL from *prompt* using Pollinations AI.

    Args:
        prompt: English image prompt (up to 2000 chars).

    Returns:
        Pollinations AI image URL string.

    Raises:
        ValueError: If prompt is empty or invalid.
    """
    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty.")

    # Preserve line breaks by converting them to spaces before URL encoding
    sanitized_prompt = " ".join(prompt.splitlines()).strip()
    if not sanitized_prompt:
        raise ValueError("Prompt cannot be whitespace only.")

    encoded_prompt = quote(sanitized_prompt[:2000])
    return f"{POLLINATIONS_BASE_URL}{encoded_prompt}"
