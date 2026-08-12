# Recalibrated hybrid grammar evaluation

Source: `../../../manual dataset/Tested_results/v27 results.md`

All values below were measured by this script; no missing value was estimated.

| System | Exact Match | Change Needed | Preservation | Over-correction | Edit Precision | Edit Recall | F0.5 | Entity Errors | Unsupported Entity Errors | Number Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Neural model | 66.88% | 56.90% | 97.37% | 2.63% | 88.27% | 71.14% | 0.8422 | 1.30% | 0.65% | 0.00% |
| B. Rules only | 24.68% | 0.00% | 100.00% | 0.00% | 0.00% | 0.00% | 0.0000 | 0.00% | 0.00% | 0.00% |
| C. Recalibrated neural + rules | 66.88% | 56.90% | 97.37% | 2.63% | 88.82% | 71.14% | 0.8462 | 0.65% | 0.00% | 0.00% |

The published baseline's 1.30% entity measure is preserved as `Entity Errors`: it flags every edit to a name-shaped token, including a gold-correct spelling repair. `Unsupported Entity Errors` additionally checks whether that edit is supported by the target, separating factual substitutions from correct entity spelling.

### Original neural baseline

The unchanged candidate has 66.88% exact match, 71.14% edit recall, and 0.8422 F0.5.

### Original hybrid

The exactly replayed legacy policy has 57.14% exact match, 56.22% edit recall, and 0.8014 F0.5.

### Recalibrated hybrid

The advisory policy has 66.88% exact match, 71.14% edit recall, and 0.8462 F0.5.

## Legacy versus recalibrated policy

The legacy row is replayed by the same validator with advisory rollback and legacy entity blocking enabled.

| Metric | Legacy hybrid | Recalibrated hybrid | Delta |
|---|---:|---:|---:|
| Exact match | 57.14% | 66.88% | +9.74 pp |
| Change-needed exact | 43.97% | 56.90% | +12.93 pp |
| Edit precision | 89.68% | 88.82% | -0.86 pp |
| Edit recall | 56.22% | 71.14% | +14.92 pp |
| F0.5 | 0.8014 | 0.8462 | +0.0448 |
| Entity errors | 0.00% | 0.65% | +0.65 pp |
| Unsupported entity errors | 0.00% | 0.00% | +0.00 pp |
| Number errors | 0.00% | 0.00% | +0.00 pp |

## Recalibrated hybrid versus neural baseline

| Metric | Neural | Recalibrated hybrid | Delta |
|---|---:|---:|---:|
| Exact match | 66.88% | 66.88% | +0.00 pp |
| Change-needed exact | 56.90% | 56.90% | +0.00 pp |
| Edit precision | 88.27% | 88.82% | +0.55 pp |
| Edit recall | 71.14% | 71.14% | +0.00 pp |
| F0.5 | 0.8422 | 0.8462 | +0.0040 |
| Entity errors | 1.30% | 0.65% | -0.65 pp |
| Unsupported entity errors | 0.65% | 0.00% | -0.65 pp |
| Number errors | 0.00% | 0.00% | +0.00 pp |

## Decision-policy audit

- Legacy false-blocked edits: 23
- Legacy false blocks by decision: SUGGEST=20, REJECT=3
- False blocks caused by sentence-level rollback: 0
- Recalibrated hard-blocked edits: 1
- Recalibrated locally adjudicated false hard blocks: 0
- Recalibrated unadjudicated hard blocks: 1

## Rule coverage

Only `REJECT` is counted as a block. `SUGGEST` is an applied advisory. Local adjudication requires a fragment to occur exactly once in the target.

| Rule ID | Triggers | Correct Blocks | False Blocks | Block Precision | Candidate-supported Warnings | Original-supported Warnings | Decisions |
|---|---:|---:|---:|---:|---:|---:|---|
| AMBIG_KEEP_001 | 4 | 0 | 0 | n/a | 4 | 0 | SUGGEST=4 |
| CASE_ATTACH_001 | 5 | 0 | 0 | n/a | 0 | 0 | ACCEPT=5 |
| ENTITY_PROTECT_001 | 5 | 0 | 0 | n/a | 3 | 0 | SUGGEST=4, REJECT=1 |
| HONORIFIC_CONTEXT_001 | 1 | 0 | 0 | n/a | 1 | 0 | SUGGEST=1 |
| MORPH_LEXICON_001 | 96 | 0 | 0 | n/a | 0 | 0 | ACCEPT=96 |
| MORPH_SUFFIX_001 | 5 | 0 | 0 | n/a | 0 | 0 | ACCEPT=5 |
| ORTH_SPACE_001 | 1 | 0 | 0 | n/a | 0 | 0 | ACCEPT=1 |
| ORTH_ZWJ_001 | 5 | 0 | 0 | n/a | 1 | 2 | SUGGEST=5 |
| PASSIVE_AUX_001 | 2 | 0 | 0 | n/a | 2 | 0 | SUGGEST=2 |
| REGISTER_CONTEXT_001 | 4 | 0 | 0 | n/a | 3 | 0 | SUGGEST=4 |
| SANDHI_JOIN_001 | 5 | 0 | 0 | n/a | 0 | 0 | ACCEPT=5 |
| SEMANTIC_EDIT_SIZE_001 | 13 | 0 | 0 | n/a | 6 | 3 | SUGGEST=13 |
| SEMANTIC_ENTITY_001 | 1 | 0 | 0 | n/a | 0 | 0 | REJECT=1 |
| SEMANTIC_TENSE_001 | 5 | 0 | 0 | n/a | 3 | 1 | SUGGEST=5 |
| SEMANTIC_VOICE_001 | 2 | 0 | 0 | n/a | 2 | 0 | SUGGEST=2 |
| SPELL_CONSONANT_CONFUSION_001 | 89 | 0 | 0 | n/a | 0 | 0 | ACCEPT=89 |
| SPELL_VOWEL_LENGTH_001 | 7 | 0 | 0 | n/a | 0 | 0 | ACCEPT=7 |
| VERB_TENSE_001 | 5 | 0 | 0 | n/a | 3 | 1 | SUGGEST=5 |
| VERB_VOICE_001 | 2 | 0 | 0 | n/a | 2 | 0 | SUGGEST=2 |

## Dedicated rule-policy fixtures

`Coverage` is the share of fixtures assigned to a rule on which that rule fired; it is not corpus prevalence. Trigger/effect scores test policy behavior. Fixtures marked `needs_native_review` have no linguistic gold and do not support grammar-quality claims.

| Rule ID | Trigger Precision | Trigger Recall | Block Precision | False-block Rate | Coverage | Effect Accuracy |
|---|---:|---:|---:|---:|---:|---:|
| AMBIG_KEEP_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| CASE_ATTACH_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| EMAIL_PROTECT_001 | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% |
| ENTITY_PROTECT_001 | 100.00% | 100.00% | 100.00% | 0.00% | 66.67% | 100.00% |
| HONORIFIC_CONTEXT_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| NUMBER_PROTECT_001 | 100.00% | 100.00% | 100.00% | 0.00% | 50.00% | 100.00% |
| ORTH_ZWJ_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| PASSIVE_AUX_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| POLARITY_PROTECT_001 | 100.00% | 100.00% | 100.00% | 0.00% | 50.00% | 100.00% |
| REGISTER_CONTEXT_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| SEMANTIC_EDIT_SIZE_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| SEMANTIC_ENTITY_001 | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% |
| SPELL_CONSONANT_CONFUSION_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| URL_PROTECT_001 | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% |
| VERB_TENSE_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |
| VERB_VOICE_001 | 100.00% | 100.00% | n/a | n/a | 100.00% | 100.00% |

## Measured interpretation and paper recommendation

On this unchanged test set, the recalibrated hybrid is preferable to neural-only as a narrow safety wrapper: it preserves exact match and recall, raises edit precision and F0.5 slightly, removes the gold-unsupported entity error, and retains zero number errors. It is not evidence that rules are a stronger grammar corrector; rules-only remains a low-accuracy safety baseline.

For the paper, report the neural model as the grammar-correction baseline, the recalibrated hybrid as the proposed safety-augmented system, rules-only as a non-competitive safety lower bound, and the legacy hybrid as an ablation showing the cost of treating warnings as vetoes. Report both the original broad entity-change flag and the target-supported entity-error measure. The one v27 hard block remains locally unadjudicated and should be included in native-speaker review rather than assigned precision by assumption.

No separate development split was available for this structural recalibration. Production logic was not fitted to known test sentences, and policy-only fixtures with uncertain linguistic preference are marked for native review.
