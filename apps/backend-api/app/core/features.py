"""
Per-tool availability gate.

One helper used by all four tool routers rather than four copies of the same
check — a tool whose gate was forgotten would stay live after an admin
switched it off, which is the failure this exists to prevent.

Only the generation endpoints are gated. History stays readable when a tool
is disabled: an operator taking the generator offline should not also hide
work a user already produced.
"""

from fastapi import Depends, HTTPException, status

from app.core import runtime_settings

# Tool key → the human name used in the 503 message.
TOOL_LABELS = {
    "grammar": "Grammar Checker",
    "headlines": "Headline Generator",
    "rewriter": "Style Rewriter",
    "summarizer": "News Summarizer",
}


async def is_enabled(tool: str) -> bool:
    """Whether a tool is currently switched on."""
    return bool(await runtime_settings.get(f"features.{tool}"))


async def all_flags() -> dict[str, bool]:
    """Every tool's flag, for /meta."""
    return {tool: await is_enabled(tool) for tool in TOOL_LABELS}


def require_tool_enabled(tool: str):
    """
    Dependency factory: 503 when the named tool is switched off.

    503 rather than 404 because the endpoint exists and will work again —
    this is a deliberate, temporary unavailability, which is exactly what
    503 means.
    """
    if tool not in TOOL_LABELS:
        raise ValueError(f"Unknown tool {tool!r}; expected one of {tuple(TOOL_LABELS)}")

    async def _gate() -> None:
        if not await is_enabled(tool):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"{TOOL_LABELS[tool]} is temporarily unavailable. "
                    "An administrator has turned it off."
                ),
            )

    return Depends(_gate)
