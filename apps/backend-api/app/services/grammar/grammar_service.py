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

# Self-consistency candidate count for the first correction pass. 1 disables
# the ensemble (today's single greedy call, zero added cost) — bump once
# validated on the GPU box against SinAI-Training's test_grammar.py stage2-5
# sets. >1 forces sampling server-side (grammar's TaskSpec is greedy by
# default) at ENSEMBLE_TEMPERATURE/ENSEMBLE_TOP_P from
# SinAI-Training/work/tasks/grammar.py — every extra candidate is a full
# extra generation.
ENSEMBLE_SIZE = 1

# Passes over the model's own output. 2 targets the compound-error gap the
# v21 eval showed: a sentence with several simultaneous mistakes where one
# greedy pass fixes some but not all. The second call re-runs correction on
# the first pass's output; skipped entirely when a pass changes nothing, so
# an already-correct sentence still costs exactly one round trip.
MAX_PASSES = 2


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


def _sanitize_correction(raw: str | None, fallback: str) -> str:
    """
    First line only, falling back to `fallback` when what's left is empty or
    too short to be a real answer.

    Mirrors SinAI-Training/work/sinllama/scripts/test_grammar.py's
    correct_sentence(): the eval harness stops generation at the first
    newline (NewlineStoppingCriteria) and then takes only that first line as
    a second safety net. Production's stop sequences
    (serve_sinai.py's STOP_SEQUENCES) don't include a bare newline, so
    nothing upstream guarantees single-line output — this reproduces that
    same safety net here, task-scoped, rather than in the shared decode path
    where it would affect the other three tasks too.
    """
    if not raw:
        return fallback
    first_line = raw.strip().split("\n", 1)[0].strip()
    if not first_line or len(first_line) < 2:
        return fallback
    return first_line


def _pick_consensus(candidates: list[str]) -> str:
    """
    Self-consistency selection over sampled candidates: return the one most
    representative of the set (highest average similarity to the others),
    not a token-level majority vote — free-text corrections of different
    lengths don't align cleanly enough across candidates for that. A single
    candidate is returned unchanged; an all-blank list returns "". Ties
    resolve to the earliest candidate, so this stays deterministic for a
    fixed input list.
    """
    cleaned = [c for c in candidates if c]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]

    best_index = 0
    best_score = -1.0
    for i, candidate in enumerate(cleaned):
        total = sum(
            SequenceMatcher(None, candidate, other).ratio()
            for j, other in enumerate(cleaned)
            if j != i
        )
        if total > best_score:
            best_score = total
            best_index = i
    return cleaned[best_index]


async def check_grammar(text: str, user_id: str | None = None) -> GrammarCheckResponse:
    """
    Correct Sinhala text, derive per-word corrections, persist for a known
    caller, and return.

    Runs up to MAX_PASSES over the model, feeding each pass's own output
    back in as the next pass's input, and stops as soon as a pass changes
    nothing. The first pass optionally samples ENSEMBLE_SIZE candidates and
    picks the consensus; later passes are always single-shot.
    """
    corrected_text = text
    provider: str | None = None
    total_latency = 0

    for pass_num in range(MAX_PASSES):
        num_candidates = ENSEMBLE_SIZE if pass_num == 0 else 1
        result = await model_generate(
            "grammar", corrected_text, num_candidates=num_candidates
        )
        total_latency += result.latency_ms
        provider = result.provider

        candidates = result.meta.get("candidates") or [result.text]
        raw = _pick_consensus(candidates)
        next_text = _sanitize_correction(raw, fallback=corrected_text)

        if next_text == corrected_text:
            break
        corrected_text = next_text

    corrections = derive_corrections(text, corrected_text)

    record = {
        "original_text": text,
        "corrected_text": corrected_text,
        "corrections": [c.model_dump() for c in corrections],
        "correction_count": len(corrections),
        "model_provider": provider,
        "latency_ms": total_latency,
    }
    saved = await persist_if_owned(save_correction, record, user_id)

    return GrammarCheckResponse(
        id=str(saved["id"]),
        corrected=corrected_text,
        corrections=corrections,
        correction_count=len(corrections),
        created_at=saved.get("created_at"),
        model_used=provider,
    )
