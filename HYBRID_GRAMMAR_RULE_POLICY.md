# Hybrid grammar rule policy

## Objective

The neural model remains the correction engine. Deterministic code protects factual invariants and records explainable linguistic diagnostics. It does not claim to decide context-sensitive Sinhala grammar from surface patterns alone.

## Decision semantics

| Decision | Reconstruction | Intended use |
|---|---|---|
| `ACCEPT` | Apply the candidate edit | No serious rule conflict. |
| `SUGGEST` | Apply the candidate edit | Advisory warning for UI, logging, review, or research. |
| `REJECT` | Restore only the original aligned span | High-confidence factual or safety violation. |
| `KEEP` | No proposed edit | Original and candidate are unchanged. |

The result-level decision is an aggregate status. It never causes sentence-wide rollback. Mixed sentences retain safe `ACCEPT` and advisory `SUGGEST` edits while reverting only individual `REJECT` spans.

## Hard blockers

The hard-block policy is restricted to:

- `NUMBER_PROTECT_001` / `SEMANTIC_NUMBER_001`: changed factual numbers, dates, percentages, currency, or digit quantities.
- `URL_PROTECT_001`: changed URL values.
- `EMAIL_PROTECT_001`: changed email values.
- `POLARITY_PROTECT_001` / `SEMANTIC_POLARITY_001`: explicit affirmative/negative reversal.
- `ENTITY_PROTECT_001` / `SEMANTIC_ENTITY_001`: only `HIGH` entity evidence.

All other current linguistic checks are non-blocking. A future rule may become a blocker only after a reviewed evaluation demonstrates high block precision on both positive and negative examples.

## Entity confidence

Confidence is categorical and is not a probability:

| Level | Evidence | Decision |
|---|---|---|
| `HIGH` | Explicit `protected_terms` newsroom metadata; clear substitution between different reviewed Sinhala surname endings; different all-uppercase Latin acronyms | `REJECT` unless explicitly approved |
| `MEDIUM` | Heuristic probable-person/entity shape, including spelling changes inside the same name ending | `SUGGEST`; apply candidate |
| `LOW` | Weak contextual signal without independent entity evidence | Do not use for entity rejection |

Approved entity replacements continue to bypass protection. This calibration distinguishes a factual identity substitution such as `ගුනවර්ධන → ගුණසේකර` from a spelling repair such as `කරුනාතිලක → කරුණාතිලක`.

## Advisory rules

The following measured over-blocking rules remain useful only as warnings:

- `AMBIG_KEEP_001`
- `HONORIFIC_CONTEXT_001`
- `ORTH_ZWJ_001`
- `QUOTE_PROTECT_001`
- `PASSIVE_AUX_001`
- `REGISTER_CONTEXT_001`
- `SEMANTIC_EDIT_SIZE_001`
- `SEMANTIC_TENSE_001` / `VERB_TENSE_001`
- `SEMANTIC_VOICE_001` / `VERB_VOICE_001`
- contextual agreement, case, deixis, causative, and volitive signals when they lack deterministic evidence

They attach stable rule IDs, reasons, severity, decision, and categorical evidence strength while preserving the model output.

## Confidence and compatibility

`confidence_level` is emitted as `HIGH`, `MEDIUM`, or `LOW` on each edit and trigger. The old numeric `confidence` response field remains nullable for compatibility, but the recalibrated validator does not invent probability-like numbers. Older stored validation JSON remains readable because new API fields are optional on input.

The existing enum is retained for compatibility: `SUGGEST` now means applied advisory behavior. Existing `corrected`, `corrections`, and `suggestions` response fields remain present; applied advisory corrections carry `decision="SUGGEST"` and their rule metadata.

## Telemetry

Validation counts retain the old keys and add explicit policy counters:

- `applied`
- `advisory_warnings`
- `hard_rejections`
- `selectively_reverted`
- `entity_protections`
- `number_protections`
- `ambiguous_warnings`
- `tense_warnings`
- `voice_warnings`
- `edit_size_warnings`

## Evaluation policy

The historical v27 report is immutable. The evaluator replays it with `apply_advisory_edits=false` and `legacy_entity_policy=true`, then evaluates the recalibrated default against the same 154 inputs, targets, and saved model outputs. This reproduces the measured old hybrid metrics exactly before comparing the new policy.

`apps/backend-api/tests/data/grammar_rule_eval.jsonl` is a separate, hand-auditable policy fixture set. It measures rule trigger precision/recall, hard-block precision, false-block rate, coverage, and expected decision effect. Policy-only Sinhala examples that still require native linguistic judgment are explicitly marked in their notes.

## Research interpretation

Rules-only output is a safety baseline, not a competitive grammar-correction system. The recommended paper comparison is:

1. neural model;
2. rules-only safety baseline;
3. recalibrated neural plus safety rules;
4. legacy over-blocking hybrid as an ablation demonstrating why advisory semantics matter.

Claims should separate factual safety from grammar quality and should report both aggregate GEC metrics and rule-level outcomes. Native Sinhala linguist or journalist adjudication remains required before promoting any context-sensitive rule to hard-block status.
