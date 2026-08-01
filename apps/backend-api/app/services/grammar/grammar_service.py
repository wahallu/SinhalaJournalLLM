"""
Grammar checking service.

Sends text through the model gateway (SinLlama grammar adapter when
available), derives word-level corrections by diffing the model output
against the input, and persists the result.
"""

import logging
from difflib import SequenceMatcher

from app.core.model_gateway import model_generate
from app.repositories.base import persist_if_owned
from app.repositories.grammar_repository import save_correction
from app.schemas.grammar import CorrectionDetail, GrammarCheckResponse

logger = logging.getLogger(__name__)

_PUNCTUATION = set(".,;:!?'\"()[]{}«»‘’“”-–—/؟।")


def _tokenize_with_offsets(text: str) -> tuple[list[str], list[int]]:
    """Split on whitespace, keeping each token's character offset."""
    tokens: list[str] = []
    offsets: list[int] = []
    index = 0
    length = len(text)
    while index < length:
        while index < length and text[index].isspace():
            index += 1
        if index >= length:
            break
        start = index
        while index < length and not text[index].isspace():
            index += 1
        tokens.append(text[start:index])
        offsets.append(start)
    return tokens, offsets


def _classify(original: str, corrected: str) -> tuple[str, str]:
    """Return (type, rule description) for one correction."""
    orig_set = set(original)
    corr_set = set(corrected)
    if orig_set <= _PUNCTUATION and corr_set <= _PUNCTUATION:
        return "punctuation", "Punctuation correction (විරාම ලකුණු නිවැරදි කිරීම)"
    if not original or not corrected:
        return "grammar", "Word added/removed (වචන එකතු කිරීම/ඉවත් කිරීම)"

    orig_words = original.split()
    corr_words = corrected.split()
    if len(orig_words) == 1 and len(corr_words) == 1:
        # Single-token change: suffix-style edits are morphology, the rest spelling.
        ratio = SequenceMatcher(None, original, corrected).ratio()
        if corrected.startswith(original) or original.startswith(corrected):
            return "grammar", "Word form correction (වචන රූප නිවැරදි කිරීම)"
        if ratio >= 0.6:
            return "spelling", "Spelling correction (අක්ෂර වින්‍යාස නිවැරදි කිරීම)"
    return "grammar", "Grammar correction (ව්‍යාකරණ නිවැරදි කිරීම)"


def derive_corrections(original: str, corrected: str) -> list[CorrectionDetail]:
    """
    Word-level diff between input and model output.

    The grammar adapter returns only the corrected text, so the individual
    corrections shown in every client UI are reconstructed here.
    """
    orig_tokens, orig_offsets = _tokenize_with_offsets(original)
    corr_tokens, _ = _tokenize_with_offsets(corrected)

    corrections: list[CorrectionDetail] = []
    matcher = SequenceMatcher(None, orig_tokens, corr_tokens, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        original_fragment = " ".join(orig_tokens[i1:i2])
        corrected_fragment = " ".join(corr_tokens[j1:j2])
        if i1 < len(orig_offsets):
            position = orig_offsets[i1]
        else:
            position = len(original)
        kind, rule = _classify(original_fragment, corrected_fragment)
        corrections.append(
            CorrectionDetail(
                position=position,
                original=original_fragment,
                corrected=corrected_fragment,
                rule=rule,
                type=kind,
            )
        )
    return corrections


async def check_grammar(text: str, user_id: str | None = None) -> GrammarCheckResponse:
    """
    Correct Sinhala text, derive per-word corrections, persist for a known
    caller, and return.
    """
    result = await model_generate("grammar", text)
    corrected_text = result.text or text
    corrections = derive_corrections(text, corrected_text)

    record = {
        "original_text": text,
        "corrected_text": corrected_text,
        "corrections": [c.model_dump() for c in corrections],
        "correction_count": len(corrections),
        "model_provider": result.provider,
        "latency_ms": result.latency_ms,
    }
    saved = await persist_if_owned(save_correction, record, user_id)

    return GrammarCheckResponse(
        id=str(saved["id"]),
        corrected=corrected_text,
        corrections=corrections,
        correction_count=len(corrections),
        created_at=saved.get("created_at"),
        model_used=result.provider,
    )
