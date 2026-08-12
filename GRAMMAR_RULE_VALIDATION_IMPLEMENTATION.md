# Grammar rule validation implementation report

## Summary

The uploaded `sinai_rule_validation_bundle` was audited as reference material and not copied directly. Its conservative edit-reversion concept was retained, while its single-file validator, incomplete rule names, coarse evaluation, and unverified assumptions were replaced with a modular validator integrated into the existing backend grammar path.

## Existing pipeline before

```text
input -> chunk_text -> model gateway / SinLlama candidate -> sanitize
      -> word diff -> substitution warning (warning only; edit still applied)
      -> lexicon and sentence-final suggestions -> persistence/API
```

The grammar endpoint is `POST /api/v1/grammar/check`; `grammar_service.check_grammar` owns orchestration; `model_gateway.model_generate` abstracts SinLlama/OpenRouter/mock; `sinllama_loader` is the HTTP client. History persists to `grammar_corrections`. Web, extension, and Optimize clients consume `corrected`, `corrections`, and `suggestions`.

## New pipeline after

```text
input -> existing chunking -> existing model gateway -> sanitized model candidate
      -> model-independent SinhalaRuleValidator
      -> edit-level deterministic + semantic safety gate
      -> accepted edit / advisory suggestion (candidate retained) / rejected edit (original retained)
      -> correction diff from safe final text
      -> existing lexicon/final-form suggestions -> persistence/API/telemetry
```

High-confidence name substitutions are no longer silently applied; heuristic entity spelling changes remain applied with warnings. The raw model candidate remains available for research and human review.

## Files added

- `apps/backend-api/app/services/grammar/{rule_types,rule_registry,orthography,morphology,agreement,predicates,contextual_rules,safety_gate,rule_validator}.py`
- `apps/backend-api/app/services/grammar/rules_high_confidence.json`
- `apps/backend-api/app/services/grammar/data/{pronouns,protected_ambiguities,morphology_rules,approved_replacements}.json`
- `apps/backend-api/migrations/2026-08-12-grammar-rule-validation.sql`
- `apps/backend-api/scripts/{audit_grammar_datasets,evaluate_grammar_hybrid,export_grammar_review}.py`
- `apps/backend-api/tests/{test_rule_validator,test_grammar_rule_integration}.py`
- `docs/grammar-rule-validation.md`
- `docs/research/{grammar-hybrid-methodology,grammar-dataset-audit,v27-hybrid-evaluation}.md`
- `docs/research/v27-hybrid-evaluation.json`

## Files modified

- `apps/backend-api/.env.example`
- `apps/backend-api/app/api/v1/grammar.py`
- `apps/backend-api/app/core/config.py`
- `apps/backend-api/app/core/settings_registry.py`
- `apps/backend-api/app/schemas/grammar.py`
- `apps/backend-api/app/services/grammar/grammar_service.py`
- `apps/backend-api/app/services/grammar/lexicon.py`
- `apps/backend-api/app/services/grammar/substitution_guard.py`
- `apps/backend-api/schema.sql`
- `apps/backend-api/tests/test_grammar.py`
- `apps/backend-api/tests/test_runtime_settings.py`

No headline, summarization, style, authentication, frontend layout, extension, or add-on implementation was changed.

## Rules implemented

Active AUTO/PROTECT/CHECK behavior covers NFC/spacing, ZWJ uncertainty, numbers, entities, URLs, emails, quotations, polarity, ambiguous both-valid forms, attested case attachment, shared-lexicon spelling validation, structured agreement, inanimate-plural exception, compound/non-verbal predicate restraint, tense/voice preservation, contextual honorific/deixis/register signals, and edit-size safety.

The full stable ID/tier catalogue is documented in `docs/grammar-rule-validation.md` and encoded in `rule_registry.py`.

## Rules intentionally left contextual

No automatic generation was implemented for free word order/SOV, complex object case, noun-phrase reordering, arbitrary postpositions, broad sandhi, negation generation, volitive/involitive conversion, causatives, honorific selection, deixis, numeral agreement, or register conversion. These require reviewed linguistic context unavailable to the current backend.

## Tests added

Coverage includes clean preservation, numbers, entities, URL/email, ambiguous pairs, shared-lexicon spelling, inanimate plural, animate agreement mismatch, compound predicates, non-verbal predicates, quotations, polarity, tense, large rewrites, short sentences, case attachment, ZWJ changes, feature disablement, persistence, endpoint integration, rule IDs, and fail-open behavior.

The original implementation suite passed: `465 passed in 9.71s`. After policy recalibration and the added precedence/regression cases, the complete backend suite passes `470 passed in 9.70s`.

## Dataset audit findings

The generated audit inspected 28 configured files and 15,032 valid rows with no missing configured path or malformed row. High-risk deterministic misuse was identified for SOV, negation, deixis, honorific, involitive, causative, passive/register, and plural-agreement data. `verb.jsonl` and `news_ai_formal_dataset.jsonl` each contain at least one input mapped to multiple targets within the same file and need human triage.

## Evaluation results

The saved v27 transcript contains 154 examples. Measured replay produced:

| System | Exact | Change needed | Preservation | Edit P | Edit R | F0.5 | Entity mutation |
|---|---:|---:|---:|---:|---:|---:|---:|
| v27 model only | 66.88% | 56.90% | 97.37% | 88.27% | 71.14% | 0.8422 | 1.30% |
| Rules only | 24.68% | 0.00% | 100.00% | 0.00% | 0.00% | 0.0000 | 0.00% |
| v27 + rules | 57.14% | 43.97% | 97.37% | 89.68% | 56.22% | 0.8014 | 0.00% |

The hybrid removes measured entity mutations and slightly raises edit precision, but loses recall and exact match. This is a safety result, not evidence that the current thresholds improve overall GEC accuracy.

The follow-up recalibration preserves this table as the immutable legacy baseline. `SUGGEST` is now advisory, entity protection uses categorical evidence strength, and only high-confidence factual/safety `REJECT` edits are selectively reverted. Current measured results are in `HYBRID_GRAMMAR_RECALIBRATED_RESULTS.md`.

## Exact commands

See `docs/grammar-rule-validation.md#commands` for unit, model-only, rules-only, hybrid, audit, and review-export commands.

The unchanged web client also completed `npm run build`; Vite reported only its existing large-chunk advisory.

## Remaining limitations and recommended experiments

1. Obtain native-speaker labels for the exported v27 SUGGEST/REJECT cases, especially tense, voice, ZWJ, ambiguity, and edit-size downgrades.
2. Calibrate CHECK rules against those labels; do not relax PROTECT rules to recover benchmark recall.
3. Add a reviewed entity glossary or Sinhala NER component before claiming comprehensive entity protection.
4. Expand morphology only from reviewed sources with positive and negative tests.
5. Re-run the current GPU adapter to confirm the saved v27 replay against the exact deployment candidate.

## GPU command

```bash
cd SinAI-Training/work/sinllama
python scripts/test_grammar.py --adapter v27 --stage all
```
