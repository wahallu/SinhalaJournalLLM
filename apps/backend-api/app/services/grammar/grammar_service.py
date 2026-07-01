"""
Grammar checking service.

Currently uses rule-based dummy corrections.
Will be replaced with fine-tuned SinLlama model inference.
"""

from app.repositories.grammar_repository import save_correction
from app.schemas.grammar import (
    CorrectionDetail,
    GrammarCheckResponse,
)
from app.services.grammar.grammar_rules import GRAMMAR_RULES


def _apply_rules(text: str) -> tuple[str, list[CorrectionDetail]]:
    """
    Apply dummy grammar rules to the input text.

    Returns:
        (corrected_text, list_of_correction_details)
    """
    corrections: list[CorrectionDetail] = []
    corrected = text

    for rule in GRAMMAR_RULES:
        pattern = rule["pattern"]
        replacement = rule["replacement"]

        # Skip no-op rules (pattern == replacement)
        if pattern == replacement:
            continue

        # Find all occurrences in the *current* corrected text
        search_start = 0
        while True:
            pos = corrected.find(pattern, search_start)
            if pos == -1:
                break

            corrections.append(
                CorrectionDetail(
                    position=pos,
                    original=pattern,
                    corrected=replacement,
                    rule=rule["rule"],
                )
            )

            # Apply the replacement
            corrected = corrected[:pos] + replacement + corrected[pos + len(pattern):]

            # Move past the replacement to avoid infinite loops
            search_start = pos + len(replacement)

    return corrected, corrections


async def check_grammar(text: str) -> GrammarCheckResponse:
    """
    Check Sinhala text for grammar errors, persist the result, and return it.

    Args:
        text: Raw Sinhala text from the user.

    Returns:
        GrammarCheckResponse with corrected text and correction details.
    """
    corrected_text, corrections = _apply_rules(text)

    saved = await save_correction({
        "original_text": text,
        "corrected_text": corrected_text,
        "corrections": [c.model_dump() for c in corrections],
        "correction_count": len(corrections),
    })

    return GrammarCheckResponse(
        id=saved["id"],
        corrected=saved["corrected_text"],
        corrections=corrections,
        correction_count=saved["correction_count"],
        created_at=saved["created_at"],
    )