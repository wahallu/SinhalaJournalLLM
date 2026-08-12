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
from typing import TYPE_CHECKING

from app.core import runtime_settings
from app.core.model_gateway import add_tokens, model_generate
from app.repositories.base import persist_if_owned
from app.repositories.grammar_repository import save_correction
from app.schemas.grammar import (
    CorrectionDetail,
    GrammarCheckResponse,
    GrammarValidation,
    SpellingSuggestion,
)
from app.services.grammar.rule_types import (
    ConfidenceLevel,
    Decision,
    RuleTrigger,
    ValidationConfig,
    ValidationEdit,
    ValidationResult,
)
from app.services.grammar.rule_validator import get_rule_validator
from app.services.grammar.safety_gate import tokenize as safety_tokenize
from app.services.grammar import sentence_final
from app.services.grammar.substitution_guard import inspect_substitution, is_probable_name
from app.services.grammar import lexicon
from app.services.grammar.chunking import chunk_text

if TYPE_CHECKING:
    from app.core.research import Actor

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


def derive_corrections(
    original: str,
    corrected: str,
    *,
    validation_edits: list[ValidationEdit] | None = None,
) -> list[CorrectionDetail]:
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
        # This legacy annotation remains useful when rule validation is
        # disabled or fails open. With validation enabled, probable name
        # substitutions are either selectively rejected or retained with an
        # advisory decision before this applied-edit diff is built.
        suspicious, suspicious_reason = inspect_substitution(
            original_fragment, corrected_fragment
        )
        validation_edit = next(
            (
                edit for edit in (validation_edits or [])
                if edit.decision in {Decision.ACCEPT, Decision.SUGGEST}
                and edit.original_start is not None
                and edit.original_end is not None
                and edit.original_start <= position <= edit.original_end
            ),
            None,
        )
        corrections.append(
            CorrectionDetail(
                position=position,
                original=original_fragment,
                corrected=corrected_fragment,
                rule=rule,
                type=kind,
                suspicious=suspicious,
                suspicious_reason=suspicious_reason,
                rule_ids=list(validation_edit.rule_ids) if validation_edit else [],
                confidence=validation_edit.confidence if validation_edit else None,
                confidence_level=(
                    validation_edit.confidence_level.value if validation_edit else None
                ),
                decision=(validation_edit.decision.value if validation_edit else "ACCEPT"),
            )
        )
    return corrections


async def _validation_config() -> ValidationConfig:
    """Resolve the runtime/env-backed grammar rule flags for one request."""
    return ValidationConfig(
        enabled=bool(await runtime_settings.get("grammar.rule_validation_enabled")),
        auto_safe_orthography=bool(await runtime_settings.get("grammar.auto_safe_orthography")),
        protect_entities=bool(await runtime_settings.get("grammar.protect_entities")),
        protect_numbers=bool(await runtime_settings.get("grammar.protect_numbers")),
        protect_quotes=bool(await runtime_settings.get("grammar.protect_quotes")),
        agreement_validation=bool(await runtime_settings.get("grammar.agreement_validation")),
        contextual_rules=bool(await runtime_settings.get("grammar.contextual_rules")),
    )


def _validation_decision(results: list[ValidationResult]) -> Decision:
    decisions = {result.decision for result in results}
    for decision in (Decision.REJECT, Decision.SUGGEST, Decision.ACCEPT, Decision.KEEP):
        if decision in decisions:
            return decision
    return Decision.KEEP


def _validation_summary(
    results: list[ValidationResult],
    edits: list[ValidationEdit],
    triggers: list[RuleTrigger],
    *,
    enabled: bool,
) -> GrammarValidation:
    confidence_rank = {
        ConfidenceLevel.LOW: 0,
        ConfidenceLevel.MEDIUM: 1,
        ConfidenceLevel.HIGH: 2,
    }
    confidence_levels = [
        result.confidence_level for result in results if result.confidence_level is not None
    ]
    confidence_level = (
        min(confidence_levels, key=confidence_rank.get).value
        if confidence_levels else None
    )
    accepted = sum(edit.decision == Decision.ACCEPT for edit in edits)
    warnings = sum(edit.decision == Decision.SUGGEST for edit in edits)
    rejected = sum(edit.decision == Decision.REJECT for edit in edits)

    def has_rule(edit: ValidationEdit, prefix: str) -> bool:
        return any(rule_id.startswith(prefix) for rule_id in edit.rule_ids)
    counts = {
        "proposed": len(edits),
        "accepted": accepted,
        "applied": accepted + warnings,
        "suggested": warnings,
        "rejected": rejected,
        "advisory_warnings": warnings,
        "hard_rejections": rejected,
        "selectively_reverted": rejected,
        "entity_protections": sum(
            edit.decision == Decision.REJECT and has_rule(edit, "ENTITY_") for edit in edits
        ),
        "number_protections": sum(
            edit.decision == Decision.REJECT and has_rule(edit, "NUMBER_") for edit in edits
        ),
        "ambiguous_warnings": sum(
            edit.decision == Decision.SUGGEST and has_rule(edit, "AMBIG_") for edit in edits
        ),
        "tense_warnings": sum(
            edit.decision == Decision.SUGGEST and has_rule(edit, "VERB_TENSE_") for edit in edits
        ),
        "voice_warnings": sum(
            edit.decision == Decision.SUGGEST and has_rule(edit, "VERB_VOICE_") for edit in edits
        ),
        "edit_size_warnings": sum(
            edit.decision == Decision.SUGGEST and has_rule(edit, "SEMANTIC_EDIT_SIZE_")
            for edit in edits
        ),
    }
    return GrammarValidation(
        enabled=enabled,
        failed_open=any(result.failed_open for result in results),
        decision=_validation_decision(results).value,
        confidence=None,
        confidence_level=confidence_level,
        rules_triggered=[trigger.to_dict() for trigger in triggers],
        edits=[edit.to_dict() for edit in edits],
        counts=counts,
    )


def _filter_unsafe_advisories(suggestions: list, text: str) -> list:
    """Prevent the legacy lexicon UI from bypassing hybrid protection.

    The web app's Auto mode can apply ordinary spelling suggestions. A
    both-valid pair, probable name, or quoted word therefore must not be
    emitted through that legacy channel after the validator deliberately kept
    it unchanged.
    """
    validator = get_rule_validator()
    quoted = [
        (token.start, token.end)
        for token in safety_tokenize(text)
        if "quote" in token.kinds
    ]
    filtered = []
    for suggestion in suggestions:
        start, end = suggestion.position, suggestion.position + len(suggestion.original)
        if validator.is_protected_pair(suggestion.original, suggestion.suggestion):
            continue
        if is_probable_name(suggestion.original):
            continue
        if any(start < quote_end and quote_start < end for quote_start, quote_end in quoted):
            continue
        filtered.append(suggestion)
    return filtered


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


async def check_grammar(
    text: str,
    user_id: str | None = None,
    actor: "Actor | None" = None,
) -> GrammarCheckResponse:
    """
    Correct Sinhala text, derive per-word corrections, persist for a known
    caller, and return.

    Long input is split into sentence-sized chunks and corrected one chunk per
    model call, then reassembled — see chunking.py for the measurements behind
    that. Text already inside the budget produces exactly one chunk, so short
    input follows the same single-call path it always did.

    Chunks are corrected sequentially rather than concurrently on purpose: the
    model server holds a global `_generation_lock` around set_adapter() +
    generate(), so parallel requests would queue there anyway, gaining nothing
    while making a timeout far likelier on a long article.

    `grammar.ensemble_size` (admin-controlled, default 1) optionally samples
    that many candidates per call and picks the most representative one.
    """
    ensemble_size = await runtime_settings.get("grammar.ensemble_size")
    max_chars = await runtime_settings.get("grammar.chunk_chars")
    spell_ratio = await runtime_settings.get("grammar.spellcheck_ratio")
    validation_config = await _validation_config()

    chunks = chunk_text(text, max_chars)
    if not chunks:
        chunks = []

    pieces: list[str] = []
    candidate_pieces: list[str] = []
    corrections: list[CorrectionDetail] = []
    validation_results: list[ValidationResult] = []
    validation_edits: list[ValidationEdit] = []
    validation_triggers: list[RuleTrigger] = []
    seen_trigger_ids: set[str] = set()
    provider: str | None = None
    adapter: str | None = None
    total_latency = 0
    input_tokens: int | None = None
    output_tokens: int | None = None

    for chunk in chunks:
        result = await model_generate("grammar", chunk.text, num_candidates=ensemble_size)

        candidates = result.meta.get("candidates") or [result.text]
        raw = _pick_consensus(candidates)
        candidate_chunk = _sanitize_correction(raw, fallback=chunk.text)

        candidate_start = sum(len(piece) for piece in candidate_pieces) + len(chunk.lead)
        candidate_pieces.append(chunk.rebuild(candidate_chunk))

        try:
            validation = get_rule_validator().validate(
                original_text=chunk.text,
                candidate_text=candidate_chunk,
                config=validation_config,
            )
        except Exception:
            # The validator is a safety layer, not an availability dependency.
            # Preserve the pre-integration model behavior if it fails internally.
            logger.exception("Grammar rule validation failed open for one chunk")
            fallback_decision = (
                Decision.KEEP if candidate_chunk == chunk.text else Decision.ACCEPT
            )
            validation = ValidationResult(
                original_text=chunk.text,
                model_candidate=candidate_chunk,
                final_text=candidate_chunk,
                decision=fallback_decision,
                confidence=None,
                confidence_level=None,
                enabled=validation_config.enabled,
                failed_open=True,
            )
        validation_results.append(validation)
        corrected_chunk = validation.final_text

        local_edits = validation.edits
        for edit in local_edits:
            validation_edits.append(edit.rebased(chunk.start, candidate_start))
        for trigger in validation.rules_triggered:
            if trigger.id not in seen_trigger_ids:
                validation_triggers.append(trigger)
                seen_trigger_ids.add(trigger.id)

        # Positions are rebased onto the original article, not the chunk, so
        # the clients' underlining lands on the right characters.
        for correction in derive_corrections(
            chunk.text,
            corrected_chunk,
            validation_edits=local_edits,
        ):
            corrections.append(
                correction.model_copy(update={"position": correction.position + chunk.start})
            )

        pieces.append(chunk.rebuild(corrected_chunk))
        provider = provider or result.provider
        adapter = adapter or result.meta.get("adapter")
        total_latency += result.latency_ms
        input_tokens = add_tokens(input_tokens, result.meta.get("input_tokens"))
        output_tokens = add_tokens(output_tokens, result.meta.get("output_tokens"))

    # Whitespace-only input produces no chunks; return it untouched rather
    # than calling the model with nothing.
    corrected_text = "".join(pieces) if chunks else text
    model_candidate = "".join(candidate_pieces) if chunks else text
    if not validation_results:
        validation_results.append(
            ValidationResult(
                original_text=text,
                model_candidate=text,
                final_text=text,
                decision=Decision.KEEP,
                confidence=None,
                confidence_level=None,
                enabled=validation_config.enabled,
            )
        )
    validation_summary = _validation_summary(
        validation_results,
        validation_edits,
        validation_triggers,
        enabled=validation_config.enabled,
    )

    record = {
        "original_text": text,
        "corrected_text": corrected_text,
        "model_candidate": model_candidate,
        "validation": validation_summary.model_dump(mode="json"),
        "corrections": [c.model_dump() for c in corrections],
        "correction_count": len(corrections),
        # Filled after the advisory lexicon pass below. Kept here as an empty
        # list for old/failing databases; the saved row is updated below once
        # suggestions are known.
        "suggestions": [],
        "model_provider": provider,
        # Admin-diagnostics only — see GrammarCheckResponse._adapter for why
        # this never reaches the API response, only this persisted row and
        # (via the endpoint) request_telemetry.
        "adapter": adapter,
        "latency_ms": total_latency,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
    # Run on the CORRECTED text, not the input: anything the model already
    # fixed should not be flagged again, and a word it introduced is worth
    # checking too. 0 disables it entirely.
    suggestions: list[SpellingSuggestion] = []
    if spell_ratio:
        try:
            found = list(lexicon.check(corrected_text, min_ratio=spell_ratio))

            # The sentence-final participle rule (-මින් -> -මිනි at a sentence
            # end) is positional, so the frequency lexicon cannot see it —
            # both forms are real words and it compares counts. Merged here
            # rather than kept separate because to a reader they are the same
            # kind of thing: a flagged word with a proposed replacement.
            taken = {s.position for s in found}
            found += [
                s for s in sentence_final.check(corrected_text, lexicon._lexicon())
                if s.position not in taken
            ]
            found = _filter_unsafe_advisories(found, corrected_text)
            found.sort(key=lambda s: s.position)

            suggestions = [
                SpellingSuggestion(
                    position=s.position, original=s.original, suggestion=s.suggestion,
                    seen=s.seen, suggestion_seen=s.suggestion_seen,
                )
                for s in found
            ]
        except Exception:
            # Advisory extra: never let it fail a correction that succeeded.
            logger.exception("Spelling suggestions failed — returning none")

    # Persist the advisory output together with the correction result so a
    # reopened history row renders exactly the same workspace.
    record["suggestions"] = [suggestion.model_dump() for suggestion in suggestions]
    saved = await persist_if_owned(save_correction, record, user_id, actor)

    response = GrammarCheckResponse(
        id=str(saved["id"]),
        corrected=corrected_text,
        model_candidate=model_candidate,
        validation=validation_summary,
        corrections=corrections,
        correction_count=len(corrections),
        suggestions=suggestions,
        created_at=saved.get("created_at"),
        model_used=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    response._adapter = adapter
    return response
