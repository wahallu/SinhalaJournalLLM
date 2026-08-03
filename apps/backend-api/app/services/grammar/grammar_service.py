"""
Grammar checking service.

Sends text through the model gateway (SinLlama grammar adapter when
available), derives word-level corrections by diffing the model output
against the input, and persists the result.

This used to also re-run correction on its own output once (MAX_PASSES=2),
chasing a compound-error gap the v21 eval showed: a sentence with several
simultaneous mistakes where one greedy pass fixed some but not all. Removed —
it meant every changed request cost two full GPU round trips instead of one,
and the finished text was "correct(correct(article))" rather than
"correct(article)", which is a different generation from a single pass over
the original text, not just a slower one. That made this path incomparable
to a one-pass run over the same article (e.g. the admin Comparison tool) even
with the same adapter. If the compound-error gap needs addressing again, do
it as a genuine ensemble (below) or a training-time fix, not a second
customer-facing pass.
"""

import logging
from difflib import SequenceMatcher

from app.core import runtime_settings
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
    Correct Sinhala text once, derive per-word corrections, persist for a
    known caller, and return.

    One generate() call. `grammar.ensemble_size` (admin-controlled, default 1)
    optionally samples that many candidates in the same call and picks the
    most representative one — a real quality/latency tradeoff the admin can
    dial in from the dashboard, unlike the removed second pass, which ran
    unconditionally for every changed request.
    """
    ensemble_size = await runtime_settings.get("grammar.ensemble_size")

    result = await model_generate("grammar", text, num_candidates=ensemble_size)

    candidates = result.meta.get("candidates") or [result.text]
    raw = _pick_consensus(candidates)
    corrected_text = _sanitize_correction(raw, fallback=text)

    corrections = derive_corrections(text, corrected_text)
    adapter = result.meta.get("adapter")

    record = {
        "original_text": text,
        "corrected_text": corrected_text,
        "corrections": [c.model_dump() for c in corrections],
        "correction_count": len(corrections),
        "model_provider": result.provider,
        # Admin-diagnostics only — see GrammarCheckResponse._adapter for why
        # this never reaches the API response, only this persisted row and
        # (via the endpoint) request_telemetry.
        "adapter": adapter,
        "latency_ms": result.latency_ms,
        "input_tokens": result.meta.get("input_tokens"),
        "output_tokens": result.meta.get("output_tokens"),
    }
    saved = await persist_if_owned(save_correction, record, user_id)

    response = GrammarCheckResponse(
        id=str(saved["id"]),
        corrected=corrected_text,
        corrections=corrections,
        correction_count=len(corrections),
        created_at=saved.get("created_at"),
        model_used=result.provider,
        input_tokens=result.meta.get("input_tokens"),
        output_tokens=result.meta.get("output_tokens"),
    )
    response._adapter = adapter
    return response
