"""Stable catalogue of deterministic, checking, contextual, and protection rules."""

from __future__ import annotations

from app.services.grammar.rule_types import RuleDefinition, RuleTier, Severity


def _rule(
    rule_id: str,
    name: str,
    category: str,
    tier: RuleTier,
    severity: Severity,
    description: str,
) -> RuleDefinition:
    return RuleDefinition(rule_id, name, category, tier, severity, description)


RULES: dict[str, RuleDefinition] = {
    rule.id: rule
    for rule in (
        _rule("ORTH_NFC_001", "Unicode NFC", "orthography", RuleTier.AUTO, Severity.INFO, "Compare Sinhala in NFC without stripping combining marks."),
        _rule("ORTH_ZWJ_001", "ZWJ/grapheme safety", "orthography", RuleTier.CHECK, Severity.WARNING, "Do not silently alter uncertain Sinhala conjunct structure."),
        _rule("ORTH_SPACE_001", "Safe whitespace", "orthography", RuleTier.AUTO, Severity.INFO, "Normalize repeated horizontal space and space before punctuation."),
        _rule("ENTITY_PROTECT_001", "Named-entity protection", "safety", RuleTier.PROTECT, Severity.WARNING, "Reject only high-confidence entity substitutions; warn on heuristic entity edits."),
        _rule("NUMBER_PROTECT_001", "Number protection", "safety", RuleTier.PROTECT, Severity.ERROR, "Block factual number, date, percentage, and currency mutations."),
        _rule("QUOTE_PROTECT_001", "Quotation protection", "safety", RuleTier.NEURAL, Severity.WARNING, "Keep model rewrites inside direct quotations advisory."),
        _rule("URL_PROTECT_001", "URL protection", "safety", RuleTier.PROTECT, Severity.ERROR, "Block changes to URLs."),
        _rule("EMAIL_PROTECT_001", "Email protection", "safety", RuleTier.PROTECT, Severity.ERROR, "Block changes to email addresses."),
        _rule("CASE_ATTACH_001", "Case-suffix attachment", "morphology", RuleTier.CHECK, Severity.WARNING, "Validate noun plus separated case suffix using attested output."),
        _rule("CASE_FORM_001", "Case-form compatibility", "morphology", RuleTier.CHECK, Severity.WARNING, "Surface unusual active-clause case patterns as suggestions only."),
        _rule("AGR_PERSON_001", "Person agreement", "agreement", RuleTier.CHECK, Severity.WARNING, "Validate person agreement only when both features are known."),
        _rule("AGR_NUMBER_001", "Number agreement", "agreement", RuleTier.CHECK, Severity.WARNING, "Validate number agreement only when both features are known."),
        _rule("AGR_GENDER_001", "Gender agreement", "agreement", RuleTier.CHECK, Severity.WARNING, "Validate gender agreement only when both features are known."),
        _rule("AGR_INANIMATE_EXCEPTION_001", "Inanimate-plural exception", "agreement", RuleTier.AUTO, Severity.INFO, "Do not require a plural predicate for an inanimate plural subject."),
        _rule("PRONOUN_FEATURE_001", "Pronoun features", "morphology", RuleTier.CHECK, Severity.INFO, "Use structured, reviewed pronoun features rather than surface lists."),
        _rule("VERB_TENSE_001", "Tense preservation", "semantics", RuleTier.CHECK, Severity.WARNING, "Keep unexplained tense changes advisory."),
        _rule("VERB_VOICE_001", "Voice preservation", "semantics", RuleTier.CHECK, Severity.WARNING, "Keep unexplained active/passive changes advisory."),
        _rule("PRED_COMPOUND_001", "Compound predicates", "predicate", RuleTier.AUTO, Severity.INFO, "Treat reviewed multi-token predicates as one predicate."),
        _rule("PRED_NONVERBAL_001", "Non-verbal predicates", "predicate", RuleTier.AUTO, Severity.INFO, "Absence of a finite verb is not itself an error."),
        _rule("PASSIVE_AUX_001", "Passive auxiliary", "predicate", RuleTier.CHECK, Severity.WARNING, "Validate reviewed passive auxiliary patterns without changing voice."),
        _rule("MODAL_AUX_001", "Modal auxiliary", "predicate", RuleTier.CHECK, Severity.WARNING, "Recognize reviewed හැකි/යුතු/නොහැකි constructions."),
        _rule("AMBIG_KEEP_001", "Protected valid pair", "ambiguity", RuleTier.NEURAL, Severity.WARNING, "Warn when a neural edit touches context-dependent valid Sinhala forms."),
        _rule("SPELL_VOWEL_LENGTH_001", "Vowel-length spelling", "spelling", RuleTier.CHECK, Severity.WARNING, "Validate a candidate with the shared lexicon; never globally swap vowels."),
        _rule("SPELL_CONSONANT_CONFUSION_001", "Consonant-confusion spelling", "spelling", RuleTier.CHECK, Severity.WARNING, "Validate a candidate with the shared lexicon; never globally swap consonants."),
        _rule("WORD_ORDER_SOFT_001", "Soft word order", "syntax", RuleTier.NEURAL, Severity.INFO, "Treat SOV as a preference, never a hard validity condition."),
        _rule("NP_ORDER_001", "Noun-phrase order", "syntax", RuleTier.CHECK, Severity.INFO, "Use noun-phrase ordering only as a soft signal."),
        _rule("POSTPOSITION_001", "Postpositions", "syntax", RuleTier.CHECK, Severity.WARNING, "Validate only recognized impossible placements."),
        _rule("MORPH_LEXICON_001", "Morphological lexicon", "morphology", RuleTier.CHECK, Severity.INFO, "Reuse the SINAI frequency lexicon as evidence rather than authority."),
        _rule("MORPH_SUFFIX_001", "Morphological suffix", "morphology", RuleTier.CHECK, Severity.INFO, "Recognize only reviewed suffix patterns."),
        _rule("SANDHI_JOIN_001", "Sandhi/joining", "morphology", RuleTier.CHECK, Severity.WARNING, "Merge or split only with lexical evidence."),
        _rule("NEGATION_CONTEXT_001", "Contextual negation", "context", RuleTier.NEURAL, Severity.WARNING, "Leave broad negation correction to the contextual model."),
        _rule("POLARITY_PROTECT_001", "Polarity protection", "safety", RuleTier.PROTECT, Severity.ERROR, "Block unexplained affirmative/negative reversals."),
        _rule("INVOLITIVE_CONTEXT_001", "Volitive/involitive context", "context", RuleTier.NEURAL, Severity.WARNING, "Do not globally convert volitive and involitive predicates."),
        _rule("CAUSATIVE_CONTEXT_001", "Causative context", "context", RuleTier.NEURAL, Severity.WARNING, "Do not globally alter causativity or valency."),
        _rule("HONORIFIC_CONTEXT_001", "Honorific context", "context", RuleTier.NEURAL, Severity.WARNING, "Keep honorific changes advisory without a reviewed glossary."),
        _rule("DEIXIS_CONTEXT_001", "Deixis context", "context", RuleTier.NEURAL, Severity.WARNING, "Keep demonstrative/deictic substitutions advisory."),
        _rule("NUMERAL_AGREEMENT_001", "Numeral morphology", "morphology", RuleTier.CHECK, Severity.WARNING, "Validate nearby numeral morphology without changing quantity."),
        _rule("REGISTER_CONTEXT_001", "Register context", "context", RuleTier.NEURAL, Severity.WARNING, "Do not formalize valid quoted or colloquial language automatically."),
        _rule("SEMANTIC_EDIT_SIZE_001", "Edit-size safety", "safety", RuleTier.CHECK, Severity.WARNING, "Downgrade large rewrites using absolute and relative edit size."),
        _rule("SEMANTIC_POLARITY_001", "Semantic polarity", "safety", RuleTier.PROTECT, Severity.ERROR, "Detect polarity reversal at edit level."),
        _rule("SEMANTIC_ENTITY_001", "Semantic entity", "safety", RuleTier.PROTECT, Severity.ERROR, "Reject a factual entity mutation only when evidence is high confidence."),
        _rule("SEMANTIC_NUMBER_001", "Semantic number", "safety", RuleTier.PROTECT, Severity.ERROR, "Detect factual number mutation at edit level."),
        _rule("SEMANTIC_TENSE_001", "Semantic tense", "safety", RuleTier.CHECK, Severity.WARNING, "Detect an identifiable tense change."),
        _rule("SEMANTIC_VOICE_001", "Semantic voice", "safety", RuleTier.CHECK, Severity.WARNING, "Detect an identifiable voice change."),
    )
}


def get_rule(rule_id: str) -> RuleDefinition:
    """Return a stable definition; unknown IDs are programmer errors."""
    return RULES[rule_id]
