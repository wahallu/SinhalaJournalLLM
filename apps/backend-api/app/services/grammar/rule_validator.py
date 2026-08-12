"""Research-grade conservative validator for provider-generated Sinhala corrections.

The validator has no dependency on SinLlama. Any model can supply a candidate
through :meth:`SinhalaRuleValidator.validate`; deterministic rules then accept,
downgrade, or block individual aligned edits before the final text is returned.
"""

from __future__ import annotations

import json
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from app.services.grammar import lexicon
from app.services.grammar.agreement import infer_agreement, validate_agreement
from app.services.grammar.contextual_rules import contextual_rule_ids
from app.services.grammar.morphology import case_suffixes, polarity, tense, voice
from app.services.grammar.orthography import (
    apply_safe_spacing,
    normalize_nfc,
    uncertain_joiner_change,
)
from app.services.grammar.rule_registry import get_rule
from app.services.grammar.rule_types import (
    ConfidenceLevel,
    Decision,
    MorphFeatures,
    RuleTrigger,
    Severity,
    ValidationConfig,
    ValidationEdit,
    ValidationResult,
)
from app.services.grammar.safety_gate import (
    Token,
    lexical_words,
    probable_entity_terms,
    protected_counters,
    segment_kinds,
    tokenize,
)
from app.services.grammar.substitution_guard import (
    inspect_substitution,
    is_name_substitution,
    is_probable_name,
)

_HERE = Path(__file__).resolve().parent
_DATA = _HERE / "data"
_RULES_PATH = _HERE / "rules_high_confidence.json"
_VOWEL_SIGNS = frozenset("ාැෑිීුූෘෙේෛොෝෞ")
_STRIP = " \t\n\r.,!?;:\"'“”‘’()[]{}…"
_CONFIDENCE_RANK = {
    ConfidenceLevel.LOW: 0,
    ConfidenceLevel.MEDIUM: 1,
    ConfidenceLevel.HIGH: 2,
}


@lru_cache(maxsize=None)
def _json(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _pair(a: str, b: str) -> frozenset[str]:
    return frozenset((a, b))


def _span(tokens: Sequence[Token]) -> tuple[int | None, int | None]:
    if not tokens:
        return None, None
    return tokens[0].start, tokens[-1].end


def _decision_for(edits: Sequence[ValidationEdit], changed: bool) -> Decision:
    decisions = {edit.decision for edit in edits}
    if Decision.REJECT in decisions:
        return Decision.REJECT
    if Decision.SUGGEST in decisions:
        return Decision.SUGGEST
    if Decision.ACCEPT in decisions or changed:
        return Decision.ACCEPT
    return Decision.KEEP


def _features(value: Any) -> MorphFeatures | None:
    if isinstance(value, MorphFeatures):
        return value
    if isinstance(value, Mapping):
        allowed = MorphFeatures.__dataclass_fields__.keys()
        return MorphFeatures(**{key: value[key] for key in allowed if key in value})
    return None


def _result_confidence(edits: Sequence[ValidationEdit]) -> ConfidenceLevel | None:
    if not edits:
        return None
    return min((edit.confidence_level for edit in edits), key=_CONFIDENCE_RANK.get)


class SinhalaRuleValidator:
    """Conservative, cached, model-independent Sinhala validation engine."""

    def __init__(self, rules_path: str | Path | None = None):
        self.rules = _json(str(Path(rules_path) if rules_path else _RULES_PATH))
        ambiguity = _json(str(_DATA / "protected_ambiguities.json"))
        self.ambiguous_pairs = {_pair(a, b) for a, b in ambiguity.get("pairs", ())}
        self.blocked_pairs = {_pair(a, b) for a, b in ambiguity.get("blocked_pairs", ())}
        approved = _json(str(_DATA / "approved_replacements.json"))
        self.approved = {
            (entry["incorrect"], entry["corrected"]): entry
            for entry in approved.get("entries", ())
            if all(entry.get(key) for key in (
                "rule_id", "incorrect", "corrected", "explanation",
                "source_or_reviewer", "approved_date",
            ))
        }

    def apply_rules_only(self, text: str, *, config: ValidationConfig | None = None) -> str:
        """Apply the small AUTO surface tier without inventing grammar edits."""
        config = config or ValidationConfig()
        if not config.enabled:
            return text
        result = normalize_nfc(text)
        return apply_safe_spacing(result) if config.auto_safe_orthography else result

    def is_protected_pair(self, original: str, candidate: str) -> bool:
        """Whether an advisory subsystem must not bypass ambiguity protection."""
        pair = _pair(normalize_nfc(original), normalize_nfc(candidate))
        return pair in self.ambiguous_pairs or pair in self.blocked_pairs

    def validate(
        self,
        original_text: str,
        candidate_text: str,
        *,
        context: Mapping[str, Any] | None = None,
        metadata: Mapping[str, Any] | None = None,
        config: ValidationConfig | None = None,
        protected_terms: Iterable[str] = (),
    ) -> ValidationResult:
        """Validate one model candidate and return a safe, structured outcome."""
        config = config or ValidationConfig()
        context = context or {}
        metadata = metadata or {}
        if not config.enabled:
            decision = Decision.KEEP if original_text == candidate_text else Decision.ACCEPT
            return ValidationResult(
                original_text=original_text,
                model_candidate=candidate_text,
                final_text=candidate_text,
                decision=decision,
                confidence=None,
                confidence_level=None,
                enabled=False,
            )

        original = normalize_nfc(original_text)
        candidate = normalize_nfc(candidate_text)
        if config.auto_safe_orthography:
            candidate = apply_safe_spacing(candidate)

        explicit_entity_terms = {
            normalize_nfc(str(term))
            for term in (
                list(self.rules.get("protected_terms", ()))
                + list(protected_terms)
                + list(metadata.get("protected_terms", ()) or ())
            )
            if term
        }
        runtime_terms = set(explicit_entity_terms)
        if config.protect_entities:
            runtime_terms.update(probable_entity_terms(original))
            runtime_terms.update(probable_entity_terms(candidate))
        original_tokens = tokenize(original, runtime_terms)
        candidate_tokens = tokenize(candidate, runtime_terms)

        factual_before = protected_counters(original)
        factual_after = protected_counters(candidate)
        factual_changes = {
            kind for kind in factual_before if factual_before[kind] != factual_after[kind]
        }
        original_polarity, candidate_polarity = polarity(original), polarity(candidate)
        polarity_changed = original_polarity != candidate_polarity and (
            original_polarity is not None or candidate_polarity is not None
        )
        original_tense, candidate_tense = tense(original), tense(candidate)
        tense_changed = bool(
            original_tense and candidate_tense and original_tense != candidate_tense
        )
        original_voice, candidate_voice = voice(original), voice(candidate)
        voice_changed = bool(
            original_voice and candidate_voice and original_voice != candidate_voice
        )

        candidate_agreement_ids: tuple[str, ...] = ()
        if config.agreement_validation:
            supplied_subject = _features(context.get("subject_features"))
            supplied_predicate = _features(context.get("candidate_predicate_features"))
            inferred = infer_agreement(candidate)
            subject_predicate = (
                (supplied_subject, supplied_predicate)
                if supplied_subject and supplied_predicate
                else inferred
            )
            if subject_predicate:
                findings = validate_agreement(*subject_predicate)
                candidate_agreement_ids = tuple(
                    finding.rule_id for finding in findings if not finding.is_exception
                )

        original_values = [token.text for token in original_tokens]
        candidate_values = [token.text for token in candidate_tokens]
        matcher = SequenceMatcher(None, original_values, candidate_values, autojunk=False)
        opcodes = [opcode for opcode in matcher.get_opcodes() if opcode[0] != "equal"]
        original_lexical = max(1, sum(token.lexical for token in original_tokens))
        changed_lexical = sum(
            max(
                sum(token.lexical for token in original_tokens[i1:i2]),
                sum(token.lexical for token in candidate_tokens[j1:j2]),
            )
            for _, i1, i2, j1, j2 in opcodes
        )
        changed_ratio = changed_lexical / original_lexical
        large_rewrite = (
            changed_lexical >= int(self.rules.get("large_rewrite_min_changed_tokens", 4))
            and changed_ratio > float(self.rules.get("max_changed_lexical_ratio", 0.30))
        )

        final_parts: list[str] = []
        edits: list[ValidationEdit] = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            original_segment = original_tokens[i1:i2]
            candidate_segment = candidate_tokens[j1:j2]
            original_fragment = "".join(token.text for token in original_segment)
            candidate_fragment = "".join(token.text for token in candidate_segment)
            if tag == "equal":
                final_parts.append(candidate_fragment)
                continue

            edit = self._classify_edit(
                tag,
                original_segment,
                candidate_segment,
                original_text=original,
                candidate_text=candidate,
                factual_changes=factual_changes,
                polarity_changed=polarity_changed,
                tense_changed=tense_changed,
                voice_changed=voice_changed,
                agreement_ids=candidate_agreement_ids,
                large_rewrite=large_rewrite,
                changed_ratio=changed_ratio,
                config=config,
                metadata=metadata,
                explicit_entity_terms=explicit_entity_terms,
            )
            edits.append(edit)
            final_parts.append(
                candidate_fragment
                if edit.decision == Decision.ACCEPT
                or (edit.decision == Decision.SUGGEST and config.apply_advisory_edits)
                else original_fragment
            )

        final_text = "".join(final_parts)
        triggers = self._triggers(edits)

        # NFC can change representation without producing an opcode because the
        # comparison itself is normalized. Record that AUTO action explicitly.
        if original_text != original:
            edit = self._edit(
                "normalize", original_text, original, Decision.ACCEPT,
                ("ORTH_NFC_001",), ConfidenceLevel.HIGH,
                "Normalized Unicode to NFC without removing marks.",
                original_start=0, original_end=len(original_text),
                candidate_start=0, candidate_end=len(original),
            )
            edits.insert(0, edit)
            triggers = self._triggers(edits)

        decision = _decision_for(edits, final_text != original_text)
        return ValidationResult(
            original_text=original_text,
            model_candidate=candidate_text,
            final_text=final_text,
            decision=decision,
            confidence=None,
            confidence_level=_result_confidence(edits),
            edits=edits,
            rules_triggered=triggers,
        )

    def _classify_edit(
        self,
        operation: str,
        original: Sequence[Token],
        candidate: Sequence[Token],
        *,
        original_text: str,
        candidate_text: str,
        factual_changes: set[str],
        polarity_changed: bool,
        tense_changed: bool,
        voice_changed: bool,
        agreement_ids: tuple[str, ...],
        large_rewrite: bool,
        changed_ratio: float,
        config: ValidationConfig,
        metadata: Mapping[str, Any],
        explicit_entity_terms: set[str],
    ) -> ValidationEdit:
        original_fragment = "".join(token.text for token in original)
        candidate_fragment = "".join(token.text for token in candidate)
        original_words = lexical_words(original)
        candidate_words = lexical_words(candidate)
        kinds = segment_kinds(original) | segment_kinds(candidate)
        os, oe = _span(original)
        cs, ce = _span(candidate)
        common = dict(
            original_start=os,
            original_end=oe,
            candidate_start=cs,
            candidate_end=ce,
            metadata={"changed_lexical_ratio": round(changed_ratio, 4)},
        )

        if config.protect_numbers and "number" in kinds and "number" in factual_changes:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.REJECT,
                ("NUMBER_PROTECT_001", "SEMANTIC_NUMBER_001"), ConfidenceLevel.HIGH,
                "The proposed edit changes a factual number, date, percentage, or quantity.", **common)
        if "url" in kinds and "url" in factual_changes:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.REJECT,
                ("URL_PROTECT_001",), ConfidenceLevel.HIGH,
                "The proposed edit changes a URL.", **common)
        if "email" in kinds and "email" in factual_changes:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.REJECT,
                ("EMAIL_PROTECT_001",), ConfidenceLevel.HIGH,
                "The proposed edit changes an email address.", **common)
        if polarity_changed and self._touches_polarity(original_fragment, candidate_fragment):
            return self._edit(operation, original_fragment, candidate_fragment, Decision.REJECT,
                ("POLARITY_PROTECT_001", "SEMANTIC_POLARITY_001", "NEGATION_CONTEXT_001"),
                ConfidenceLevel.HIGH,
                "The proposed edit reverses explicit sentence polarity.", **common)
        if config.protect_entities and "entity" in kinds:
            if not self._approved_entity(original_fragment, candidate_fragment, metadata):
                confidence = self._entity_confidence(
                    original_fragment,
                    candidate_fragment,
                    explicit_entity_terms,
                    legacy=config.legacy_entity_policy,
                    original_text=original_text,
                    candidate_text=candidate_text,
                    original_span=(os, oe),
                    candidate_span=(cs, ce),
                )
                if confidence == ConfidenceLevel.HIGH:
                    return self._edit(operation, original_fragment, candidate_fragment, Decision.REJECT,
                        ("ENTITY_PROTECT_001", "SEMANTIC_ENTITY_001"), confidence,
                        "The proposed edit changes a high-confidence protected entity.", **common)
                return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                    ("ENTITY_PROTECT_001",), confidence,
                    "The edit touches a probable entity; the candidate is retained with a verification warning.", **common)

        if len(original_words) == 1 and len(candidate_words) == 1:
            old, new = original_words[0].strip(_STRIP), candidate_words[0].strip(_STRIP)
            suspicious, suspicious_reason = inspect_substitution(old, new)
            if config.protect_entities and old != new and (
                is_probable_name(old) or is_probable_name(new)
            ):
                confidence = self._entity_confidence(
                    old,
                    new,
                    explicit_entity_terms,
                    legacy=config.legacy_entity_policy,
                    original_text=original_text,
                    candidate_text=candidate_text,
                    original_span=(os, oe),
                    candidate_span=(cs, ce),
                )
                decision = (
                    Decision.REJECT if confidence == ConfidenceLevel.HIGH else Decision.SUGGEST
                )
                rule_ids = (
                    ("ENTITY_PROTECT_001", "SEMANTIC_ENTITY_001")
                    if decision == Decision.REJECT else ("ENTITY_PROTECT_001",)
                )
                return self._edit(operation, original_fragment, candidate_fragment, decision,
                    rule_ids, confidence,
                    suspicious_reason or "The replacement may alter a named entity.", **common)
            pair = _pair(old, new)
            if pair in self.blocked_pairs or pair in self.ambiguous_pairs:
                return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                    ("AMBIG_KEEP_001",), ConfidenceLevel.LOW,
                    "Both forms may be valid; the candidate is applied with a context warning.", **common)
            approved = self.approved.get((old, new))
            if approved:
                return self._edit(operation, original_fragment, candidate_fragment, Decision.ACCEPT,
                    (approved["rule_id"],), ConfidenceLevel.HIGH,
                    approved["explanation"], **common)

        if config.protect_quotes and "quote" in kinds:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                ("QUOTE_PROTECT_001", "REGISTER_CONTEXT_001"), ConfidenceLevel.LOW,
                "A change inside direct quotation requires editorial confirmation.", **common)
        if uncertain_joiner_change(original_fragment, candidate_fragment):
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                ("ORTH_ZWJ_001",), ConfidenceLevel.LOW,
                "The edit changes Sinhala joiner/conjunct structure; it is applied with a review warning.", **common)
        if tense_changed and self._touches_predicate(candidate_fragment, candidate_text):
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                ("VERB_TENSE_001", "SEMANTIC_TENSE_001"), ConfidenceLevel.LOW,
                "The model changed an identifiable tense; the candidate is retained with a warning.", **common)
        if voice_changed and self._touches_predicate(candidate_fragment, candidate_text):
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                ("VERB_VOICE_001", "SEMANTIC_VOICE_001", "PASSIVE_AUX_001"),
                ConfidenceLevel.LOW,
                "The model changed active/passive voice; the candidate is retained with a warning.", **common)

        contextual = contextual_rule_ids(original_fragment, candidate_fragment) if config.contextual_rules else ()
        if contextual:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                contextual, ConfidenceLevel.LOW,
                "This change depends on discourse or journalistic register.", **common)

        if agreement_ids and self._touches_predicate(candidate_fragment, candidate_text):
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                agreement_ids, ConfidenceLevel.LOW,
                "Possible subject-predicate agreement mismatch.", **common)

        if large_rewrite:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                ("SEMANTIC_EDIT_SIZE_001",), ConfidenceLevel.LOW,
                "The model rewrote a large span; the candidate is retained with a review warning.", **common)

        if len(original_words) == 1 and len(candidate_words) == 1:
            suspicious, suspicious_reason = inspect_substitution(
                original_words[0].strip(_STRIP), candidate_words[0].strip(_STRIP)
            )
            if suspicious:
                return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                    ("ENTITY_PROTECT_001",), ConfidenceLevel.MEDIUM,
                    suspicious_reason or "This looks like a different lexical item, not a spelling fix.", **common)

        case_rule = self._case_attachment(original_words, candidate_words)
        if case_rule:
            decision = Decision.ACCEPT if lexicon.contains("".join(candidate_words)) else Decision.SUGGEST
            return self._edit(operation, original_fragment, candidate_fragment, decision,
                ("CASE_ATTACH_001", "MORPH_SUFFIX_001", "SANDHI_JOIN_001"),
                ConfidenceLevel.HIGH if decision == Decision.ACCEPT else ConfidenceLevel.LOW,
                "A reviewed case suffix is attached to an attested noun form." if decision == Decision.ACCEPT
                else "Possible separated case suffix; the merged form lacks enough lexical evidence.", **common)

        max_tokens = int(self.rules.get("max_auto_edit_tokens", 2))
        if max(len(original_words), len(candidate_words)) > max_tokens:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.SUGGEST,
                ("SEMANTIC_EDIT_SIZE_001",), ConfidenceLevel.LOW,
                "A multi-token rewrite is applied with an editorial-review warning.", **common)

        if len(original_words) == len(candidate_words) == 1 and lexicon.supports_replacement(
            original_words[0], candidate_words[0]
        ):
            rule_id = self._spelling_rule(original_words[0], candidate_words[0])
            return self._edit(operation, original_fragment, candidate_fragment, Decision.ACCEPT,
                (rule_id, "MORPH_LEXICON_001"), ConfidenceLevel.HIGH,
                "The shared SINAI lexicon independently supports this spelling candidate.", **common)

        if not original_words and not candidate_words:
            return self._edit(operation, original_fragment, candidate_fragment, Decision.ACCEPT,
                ("ORTH_SPACE_001",), ConfidenceLevel.HIGH,
                "Safe whitespace or punctuation spacing correction.", **common)

        return self._edit(operation, original_fragment, candidate_fragment, Decision.ACCEPT,
            (), ConfidenceLevel.MEDIUM,
            "Small neural correction passed all deterministic safety checks.", **common)

    @staticmethod
    def _case_attachment(original_words: Sequence[str], candidate_words: Sequence[str]) -> bool:
        return (
            len(original_words) == 2
            and len(candidate_words) == 1
            and original_words[1] in case_suffixes()
            and candidate_words[0] == "".join(original_words)
        )

    @staticmethod
    def _touches_polarity(original: str, candidate: str) -> bool:
        return polarity(original) is not None or polarity(candidate) is not None

    @staticmethod
    def _touches_predicate(fragment: str, sentence: str) -> bool:
        changed = {word.strip(_STRIP) for word in fragment.split() if word.strip(_STRIP)}
        tail = [word.strip(_STRIP) for word in sentence.split()[-3:]]
        return bool(changed & set(tail))

    def _approved_entity(self, original: str, candidate: str, metadata: Mapping[str, Any]) -> bool:
        pairs = self.rules.get("approved_entity_replacements", ())
        pairs = list(pairs) + list(metadata.get("approved_entity_replacements", ()) or ())
        return any(
            entry.get("original") == original and entry.get("candidate") == candidate
            for entry in pairs if isinstance(entry, Mapping)
        )

    @staticmethod
    def _entity_confidence(
        original: str,
        candidate: str,
        explicit_terms: set[str],
        *,
        legacy: bool,
        original_text: str,
        candidate_text: str,
        original_span: tuple[int | None, int | None],
        candidate_span: tuple[int | None, int | None],
    ) -> ConfidenceLevel:
        """Return evidence strength for an entity edit, not a probability.

        Explicit newsroom metadata, a clear surname-identity substitution, and
        all-uppercase Latin acronym substitutions are deterministic enough to
        block. Heuristic name/entity shapes remain advisory.
        """
        if legacy:
            return ConfidenceLevel.HIGH

        def overlaps(text: str, term: str, span: tuple[int | None, int | None]) -> bool:
            start, end = span
            if start is None or end is None:
                return False
            found = text.find(term)
            while found >= 0:
                if start < found + len(term) and found < end:
                    return True
                found = text.find(term, found + len(term))
            return False

        if any(
            overlaps(original_text, term, original_span)
            or overlaps(candidate_text, term, candidate_span)
            for term in explicit_terms
        ):
            return ConfidenceLevel.HIGH

        old = original.strip(_STRIP)
        new = candidate.strip(_STRIP)
        if is_name_substitution(old, new):
            return ConfidenceLevel.HIGH
        if (
            old != new
            and old.isascii()
            and new.isascii()
            and old.isalpha()
            and new.isalpha()
            and old.isupper()
            and new.isupper()
        ):
            return ConfidenceLevel.HIGH
        return ConfidenceLevel.MEDIUM

    @staticmethod
    def _spelling_rule(original: str, candidate: str) -> str:
        if len(original) == len(candidate):
            changed = [(a, b) for a, b in zip(original, candidate) if a != b]
            if changed and all(a in _VOWEL_SIGNS or b in _VOWEL_SIGNS for a, b in changed):
                return "SPELL_VOWEL_LENGTH_001"
        return "SPELL_CONSONANT_CONFUSION_001"

    @staticmethod
    def _edit(
        operation: str,
        original: str,
        candidate: str,
        decision: Decision,
        rule_ids: tuple[str, ...],
        confidence_level: ConfidenceLevel,
        reason: str,
        **kwargs: Any,
    ) -> ValidationEdit:
        primary = get_rule(rule_ids[0]) if rule_ids else None
        severity = (
            Severity.ERROR
            if decision == Decision.REJECT
            else Severity.WARNING
            if decision == Decision.SUGGEST
            else primary.severity if primary else Severity.INFO
        )
        return ValidationEdit(
            operation=operation,
            original=original,
            candidate=candidate,
            decision=decision,
            rule_ids=rule_ids,
            confidence=None,
            confidence_level=confidence_level,
            reason=reason,
            category=primary.category if primary else "neural",
            severity=severity,
            **kwargs,
        )

    @staticmethod
    def _triggers(edits: Sequence[ValidationEdit]) -> list[RuleTrigger]:
        signals: dict[str, ValidationEdit] = {}
        priority = {
            Decision.KEEP: 0,
            Decision.ACCEPT: 1,
            Decision.SUGGEST: 2,
            Decision.REJECT: 3,
        }
        for edit in edits:
            for rule_id in edit.rule_ids:
                current = signals.get(rule_id)
                if current is None or priority[edit.decision] > priority[current.decision]:
                    signals[rule_id] = edit
        return [
            RuleTrigger(
                id=definition.id,
                category=definition.category,
                tier=definition.tier,
                severity=signals[rule_id].severity,
                message=signals[rule_id].reason,
                decision=signals[rule_id].decision,
                confidence_level=signals[rule_id].confidence_level,
            )
            for rule_id in signals
            for definition in (get_rule(rule_id),)
        ]


@lru_cache(maxsize=1)
def get_rule_validator() -> SinhalaRuleValidator:
    """Load configuration and linguistic data once per process."""
    return SinhalaRuleValidator()
