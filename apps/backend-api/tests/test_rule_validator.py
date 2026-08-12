"""Deterministic and safety behavior of the hybrid Sinhala validator."""

import pytest

from app.services.grammar.agreement import validate_agreement
from app.services.grammar.predicates import allows_nonverbal_predicate, is_compound_predicate
from app.services.grammar.rule_registry import RULES
from app.services.grammar.rule_types import Decision, MorphFeatures, RuleTier, ValidationConfig
from app.services.grammar.rule_validator import SinhalaRuleValidator


@pytest.fixture(scope="module")
def validator() -> SinhalaRuleValidator:
    return SinhalaRuleValidator()


def test_already_correct_sentence_is_kept(validator):
    text = "මෙය නිවැරදි වාක්‍යයකි."
    result = validator.validate(text, text)
    assert result.final_text == text
    assert result.decision == Decision.KEEP
    assert result.edits == []


def test_number_mutation_is_rejected(validator):
    result = validator.validate("මුදල රුපියල් 1000 කි", "මුදල රුපියල් 10000 කි")
    assert result.final_text == "මුදල රුපියල් 1000 කි"
    assert result.decision == Decision.REJECT
    assert "NUMBER_PROTECT_001" in result.blocked_edits[0].rule_ids


def test_entity_substitution_is_rejected(validator):
    result = validator.validate(
        "අමාත්‍ය ගුනවර්ධන පැවසීය", "අමාත්‍ය ගුණසේකර පැවසීය"
    )
    assert result.final_text == "අමාත්‍ය ගුනවර්ධන පැවසීය"
    assert result.decision == Decision.REJECT
    assert "ENTITY_PROTECT_001" in result.blocked_edits[0].rule_ids


def test_latin_news_entity_is_protected(validator):
    original = "IMF වාර්තාව නිකුත් විය"
    result = validator.validate(original, "WHO වාර්තාව නිකුත් විය")
    assert result.final_text == original
    assert result.decision == Decision.REJECT


def test_multiword_newsroom_glossary_term_is_protected(validator):
    original = "ලංකා පුවත් සේවය වාර්තා කළා"
    candidate = "ජාතික පුවත් සේවය වාර්තා කළා"
    result = validator.validate(
        original,
        candidate,
        metadata={"protected_terms": ["ලංකා පුවත් සේවය"]},
    )
    assert result.final_text == original
    assert "ENTITY_PROTECT_001" in result.blocked_edits[0].rule_ids


@pytest.mark.parametrize(
    "original,candidate,rule_id",
    [
        ("බලන්න https://example.com", "බලන්න https://example.org", "URL_PROTECT_001"),
        ("ලිපිනය news@example.com", "ලිපිනය desk@example.com", "EMAIL_PROTECT_001"),
    ],
)
def test_url_and_email_mutations_are_rejected(validator, original, candidate, rule_id):
    result = validator.validate(original, candidate)
    assert result.final_text == original
    assert rule_id in result.blocked_edits[0].rule_ids


def test_context_valid_pair_is_suggestion_only(validator):
    result = validator.validate("ඔහු කල වැඩය", "ඔහු කළ වැඩය")
    assert result.final_text == "ඔහු කල වැඩය"
    assert result.decision == Decision.SUGGEST
    assert result.suggestions[0].rule_ids == ("AMBIG_KEEP_001",)


def test_safe_short_model_edit_is_accepted(validator):
    result = validator.validate("මම ගෙදර යනව", "මම ගෙදර යනවා")
    assert result.final_text == "මම ගෙදර යනවා"
    assert result.decision == Decision.ACCEPT


def test_shared_lexicon_validates_known_spelling(validator):
    result = validator.validate("අපරාධ පරීක්ශන අංශය", "අපරාධ පරීක්ෂණ අංශය")
    assert result.final_text == "අපරාධ පරීක්ෂණ අංශය"
    assert "MORPH_LEXICON_001" in result.applied_edits[0].rule_ids


def test_inanimate_plural_exception_suppresses_number_error():
    subject = MorphFeatures(pos="noun", animacy="inanimate", number="plural")
    predicate = MorphFeatures(pos="verb", number="singular")
    findings = validate_agreement(subject, predicate)
    assert [finding.rule_id for finding in findings] == ["AGR_INANIMATE_EXCEPTION_001"]
    assert findings[0].is_exception is True


def test_animate_plural_mismatch_is_detected():
    subject = MorphFeatures(pos="pronoun", animacy="animate", number="plural", person=3)
    predicate = MorphFeatures(pos="verb", number="singular", person=3)
    findings = validate_agreement(subject, predicate)
    assert [finding.rule_id for finding in findings] == ["AGR_NUMBER_001"]


def test_compound_predicate_is_recognized():
    assert is_compound_predicate("ඔවුන් වැඩ කරමින් සිටිති") is True


def test_nonverbal_predicate_is_not_invalidated():
    assert allows_nonverbal_predicate("කොළඹ ශ්‍රී ලංකාවේ අගනුවරයි") is True


def test_quote_rewrite_is_suggestion_only(validator):
    original = 'ඔහු “අද එන්න” කීවා'
    result = validator.validate(original, 'ඔහු “හෙට එන්න” කීවා')
    assert result.final_text == original
    assert result.decision == Decision.SUGGEST
    assert "QUOTE_PROTECT_001" in result.suggestions[0].rule_ids


def test_polarity_reversal_is_rejected(validator):
    original = "ඔහු අද එනවා"
    result = validator.validate(original, "ඔහු අද එන්නේ නැහැ")
    assert result.final_text == original
    assert result.decision == Decision.REJECT
    assert "POLARITY_PROTECT_001" in result.blocked_edits[0].rule_ids


def test_unexpected_tense_change_is_not_auto_applied(validator):
    original = "ඔහු වැඩ කළා"
    result = validator.validate(original, "ඔහු වැඩ කරනවා")
    assert result.final_text == original
    assert result.decision == Decision.SUGGEST
    assert "VERB_TENSE_001" in result.suggestions[0].rule_ids


def test_large_rewrite_is_not_auto_applied(validator):
    original = "මෙය අද පළ වූ කෙටි පුවතකි"
    candidate = "රටේ ජනතාවට බලපාන විශාල සිදුවීමක් පිළිබඳ නව වාර්තාවක් අද නිකුත් කර ඇත"
    result = validator.validate(original, candidate)
    assert result.final_text == original
    assert result.decision == Decision.SUGGEST
    assert "SEMANTIC_EDIT_SIZE_001" in result.suggestions[0].rule_ids


def test_one_word_short_sentence_is_not_blocked_by_ratio(validator):
    result = validator.validate("ඔහු යනව", "ඔහු යනවා")
    assert result.final_text == "ඔහු යනවා"
    assert result.decision == Decision.ACCEPT


def test_attested_case_suffix_attachment_is_accepted(validator):
    result = validator.validate("පාසල් වල පොත් ඇත", "පාසල්වල පොත් ඇත")
    assert result.final_text == "පාසල්වල පොත් ඇත"
    assert "CASE_ATTACH_001" in result.applied_edits[0].rule_ids


def test_joiner_structure_change_is_suggestion_only(validator):
    original = "ක‍්ෂේත්‍රය"
    candidate = original.replace("\u200d", "")
    result = validator.validate(original, candidate)
    assert result.final_text == original
    assert "ORTH_ZWJ_001" in result.suggestions[0].rule_ids


def test_validator_can_be_disabled_without_changing_model_output(validator):
    result = validator.validate(
        "අගය 100 කි",
        "අගය 200 කි",
        config=ValidationConfig(enabled=False),
    )
    assert result.final_text == "අගය 200 කි"
    assert result.enabled is False


def test_rule_registry_has_stable_tiers():
    assert RULES["NUMBER_PROTECT_001"].tier == RuleTier.PROTECT
    assert RULES["ORTH_NFC_001"].tier == RuleTier.AUTO
    assert RULES["AGR_NUMBER_001"].tier == RuleTier.CHECK
    assert RULES["DEIXIS_CONTEXT_001"].tier == RuleTier.NEURAL


def test_rules_only_does_not_apply_forbidden_global_replacements(validator):
    text = "කලා ක්ෂේත්‍රය වැදගත්ය"
    assert validator.apply_rules_only(text) == text
