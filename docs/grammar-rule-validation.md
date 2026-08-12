# Sinhala grammar rule validation

## Architecture

The production grammar path is now:

```text
Sinhala input
  -> existing sentence/paragraph chunking
  -> model_gateway.model_generate("grammar", ...)
  -> selected and sanitized neural candidate
  -> SinhalaRuleValidator.validate(original, candidate)
  -> high-confidence edit-level safety gate
  -> accepted edits plus applied advisory warnings; only rejections are reverted
  -> existing correction diff, lexicon suggestions, persistence, and API response
```

The validator receives plain original/candidate strings and has no dependency on SinLlama or its adapter. ByT5, mT5, mBART, or another provider can replace the neural generator without changing the rule engine.

The legacy API fields remain unchanged:

- `corrected` is the automatic safe output.
- `corrections` contains only applied edits.
- `suggestions` remains the existing frequency-lexicon suggestion list.

Two additive fields provide hybrid details:

- `model_candidate` preserves what the model proposed before validation.
- `validation` contains the overall `ACCEPT`, `SUGGEST`, `REJECT`, or `KEEP` decision, per-edit decisions, categorical evidence strength, stable rule IDs, and user-readable reasons.

Validation failures are logged and fail open to the previous model output, with `validation.failed_open=true`. A rule-engine defect therefore cannot make the grammar endpoint unavailable.

## Decision semantics

| Decision | Automatic output | Meaning |
|---|---|---|
| `ACCEPT` | Candidate edit | The edit passed the enabled safety checks. |
| `SUGGEST` | Candidate edit | The edit is applied, but context or deterministic evidence is insufficient; a warning is attached. |
| `REJECT` | Original span | A protected factual/safety constraint was violated. |
| `KEEP` | Original text | No edit was proposed or required. |

A sentence can contain accepted, advisory, and reverted edits together. Reconstruction is edit-level: one unsafe number or entity edit cannot discard unrelated safe corrections. The sentence-level decision is only an aggregate status (`REJECT` before `SUGGEST` before `ACCEPT` before `KEEP`).

Every triggered edit has categorical `HIGH`, `MEDIUM`, or `LOW` evidence strength. These labels are policy classes, not probabilities. The deprecated numeric `confidence` field is retained as nullable for response compatibility and is not populated with invented scores.

## Rule tiers

- `AUTO`: deterministic semantics-preserving action or exception.
- `CHECK`: useful for validation but not broad correction generation.
- `NEURAL`: context-dependent; deterministic code may identify the phenomenon but cannot decide it globally.
- `PROTECT`: the neural model may not silently change the protected information.

## Implemented rule catalogue

| IDs | Tier | Runtime behavior and limitations |
|---|---|---|
| `ORTH_NFC_001`, `ORTH_SPACE_001` | AUTO | NFC and safe horizontal spacing only. Combining marks and joiners are never stripped. |
| `ORTH_ZWJ_001` | CHECK | A changed ZWJ/ZWNJ grapheme structure becomes an applied warning; this is intentionally not a comprehensive conjunct grammar. |
| `NUMBER_PROTECT_001`, `SEMANTIC_NUMBER_001` | PROTECT | Changed integers, decimals, dates, percentages, or digit quantities are rejected. |
| `URL_PROTECT_001`, `EMAIL_PROTECT_001` | PROTECT | Mutated URLs and email addresses are rejected. |
| `ENTITY_PROTECT_001`, `SEMANTIC_ENTITY_001` | PROTECT | `HIGH` evidence (explicit newsroom metadata, a clear surname-identity substitution, or uppercase Latin acronym substitution) rejects the specific edit. Heuristic probable entities are `MEDIUM` warnings and remain applied. Approved replacements bypass protection. |
| `QUOTE_PROTECT_001` | NEURAL | Changes inside direct quotation are applied with a warning for editorial review. |
| `POLARITY_PROTECT_001`, `SEMANTIC_POLARITY_001`, `NEGATION_CONTEXT_001` | PROTECT/NEURAL | Explicit negative-marker additions/removals are rejected. Broad negative generation is not attempted. |
| `AMBIG_KEEP_001` | NEURAL | Uses the complete repository `AMBIGUOUS_KEEP` list. Both-valid substitutions such as `කල/කළ` remain applied suggestions. |
| `CASE_ATTACH_001`, `MORPH_SUFFIX_001`, `SANDHI_JOIN_001` | CHECK | A reviewed separated case suffix is accepted only when the merged form is attested by the shared SINAI lexicon; otherwise it is a suggestion. |
| `MORPH_LEXICON_001`, `SPELL_VOWEL_LENGTH_001`, `SPELL_CONSONANT_CONFUSION_001` | CHECK | Reuses `lexicon.py` candidate generators, rarity limit, and frequency evidence. It never performs global letter substitution. |
| `PRONOUN_FEATURE_001`, `AGR_PERSON_001`, `AGR_NUMBER_001`, `AGR_GENDER_001` | CHECK | Structured pronoun/predicate features are compared only when both sides are known. Unknown features remain `None`. |
| `AGR_INANIMATE_EXCEPTION_001` | AUTO | An inanimate plural subject with a singular predicate is not flagged as a number-agreement error. |
| `PRED_COMPOUND_001`, `PRED_NONVERBAL_001` | AUTO exception | Reviewed compound predicates are analyzed together. Absence of a recognized finite verb is never treated as proof that a sentence is invalid. |
| `VERB_TENSE_001`, `SEMANTIC_TENSE_001` | CHECK | An identifiable tense change is an applied warning. The code does not globally harmonize tense. |
| `VERB_VOICE_001`, `SEMANTIC_VOICE_001`, `PASSIVE_AUX_001` | CHECK | An identifiable active/passive change is an applied warning; no rule-generated voice conversion is performed. |
| `MODAL_AUX_001` | CHECK | Reviewed `හැකි`, `යුතු`, and `නොහැකි` patterns are represented in morphology data; uncertain complement analysis stays contextual. |
| `HONORIFIC_CONTEXT_001`, `DEIXIS_CONTEXT_001`, `REGISTER_CONTEXT_001` | NEURAL | Changes involving reviewed surface markers remain applied warnings without discourse/glossary evidence. |
| `SEMANTIC_EDIT_SIZE_001` | CHECK | Large rewrites use both absolute changed-token count and relative ratio and become applied warnings. A single correction in a short sentence is not blocked solely by percentage. |
| `CASE_FORM_001`, `WORD_ORDER_SOFT_001`, `NP_ORDER_001`, `POSTPOSITION_001`, `INVOLITIVE_CONTEXT_001`, `CAUSATIVE_CONTEXT_001`, `NUMERAL_AGREEMENT_001` | CHECK/NEURAL | Registered for stable research logging and future reviewed detectors. No broad automatic rewrite is currently claimed for these context-sensitive categories. |

The authoritative complete registry is `app/services/grammar/rule_registry.py`. The final group is intentionally conservative: stable IDs and tiers exist, while unverified linguistic generation rules do not.

## Rule data and approval

- `data/protected_ambiguities.json` mirrors `manual dataset/scripts/build_corpus_dataset.py:AMBIGUOUS_KEEP` rather than maintaining a smaller inconsistent list.
- `data/pronouns.json` contains only structured forms represented in the repository pronoun data.
- `data/morphology_rules.json` records exact reviewed dataset forms/constructions and does not infer a full conjugation system from suffix resemblance.
- `data/approved_replacements.json` is empty by design.

Every future approved replacement must include `rule_id`, `incorrect`, `corrected`, `explanation`, `source_or_reviewer`, and `approved_date`. Frequency counts or a model prediction are not sufficient approval.

## Configuration

Startup defaults are environment variables, and the existing admin runtime-settings system can override each value:

```text
GRAMMAR_RULE_VALIDATION_ENABLED=true
GRAMMAR_AUTO_SAFE_ORTHOGRAPHY=true
GRAMMAR_PROTECT_ENTITIES=true
GRAMMAR_PROTECT_NUMBERS=true
GRAMMAR_PROTECT_QUOTES=true
GRAMMAR_AGREEMENT_VALIDATION=true
GRAMMAR_CONTEXTUAL_RULES=true
```

## Persistence and telemetry

Run `apps/backend-api/migrations/2026-08-12-grammar-rule-validation.sql` before deploying. Grammar history stores the raw model candidate and validation JSON. Request telemetry stores counts, decision, fail-open state, and triggered rule IDs only; it does not duplicate submitted article text.

Counts distinguish `advisory_warnings`, `hard_rejections`, and `selectively_reverted` edits, with separate entity/number protection and ambiguity/tense/voice/edit-size warning counters.

## Research limitations

- Sinhala diglossia makes colloquial versus written-formal choice a register issue, not always a grammar error.
- Sinhala word order allows scrambling; SOV is a soft preference, not a validity law.
- Both-valid spellings require sentence/discourse context.
- Differential object marking prevents one universal object-case rule.
- The morphology/pronoun inventories are deliberately incomplete.
- Honorific, deixis, causativity, and volitive/involitive interpretation require discourse and argument structure.
- Corpus frequency is evidence, not linguistic authority; the corpus includes misspellings and rare proper nouns.
- High-risk categories and approved replacements still require native Sinhala linguistic/journalist review.

## Commands

From `apps/backend-api`:

```bash
.venv/bin/python -m pytest -q
.venv/bin/python -m pytest -q tests/test_rule_validator.py tests/test_grammar_rule_integration.py

.venv/bin/python scripts/evaluate_grammar_hybrid.py \
  '../../../manual dataset/Tested_results/v27 results.md' --system model
.venv/bin/python scripts/evaluate_grammar_hybrid.py \
  '../../../manual dataset/Tested_results/v27 results.md' --system rules
.venv/bin/python scripts/evaluate_grammar_hybrid.py \
  '../../../manual dataset/Tested_results/v27 results.md' --system hybrid
.venv/bin/python scripts/evaluate_grammar_hybrid.py \
  '../../../manual dataset/Tested_results/v27 results.md' \
  --rule-eval tests/data/grammar_rule_eval.jsonl \
  --json-output ../../docs/research/v27-hybrid-recalibrated-evaluation.json \
  --markdown-output ../../HYBRID_GRAMMAR_RECALIBRATED_RESULTS.md \
  --legacy-false-blocks-csv ../../false_blocks_old_hybrid.csv \
  --hard-blocks-csv ../../hard_blocks_new_hybrid.csv

.venv/bin/python scripts/export_grammar_review.py \
  '../../../manual dataset/Tested_results/v27 results.md' grammar-review.csv

.venv/bin/python scripts/audit_grammar_datasets.py
```

On the GPU/training server, generate a fresh transcript first:

```bash
cd SinAI-Training/work/sinllama
python scripts/test_grammar.py --adapter v27 --stage all
```
