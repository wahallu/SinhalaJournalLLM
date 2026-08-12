# Hybrid grammar evaluation

Source: `../../../manual dataset/Tested_results/v27 results.md`

All values below were measured by this script; no missing value was estimated.

| System | Exact Match | Change Needed | Preservation | Over-correction | Edit Precision | Edit Recall | F0.5 | Entity Errors | Number Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Neural model | 66.88% | 56.90% | 97.37% | 2.63% | 88.27% | 71.14% | 0.8422 | 1.30% | 0.00% |
| Rules only | 24.68% | 0.00% | 100.00% | 0.00% | 0.00% | 0.00% | 0.0000 | 0.00% | 0.00% |
| Neural + rules | 57.14% | 43.97% | 97.37% | 2.63% | 89.68% | 56.22% | 0.8014 | 0.00% | 0.00% |

## Rule coverage

`Correct Blocks` and `False Blocks` use local target-fragment adjudication; cases where neither fragment uniquely occurs in the target remain unadjudicated.

| Rule ID | Trigger Count | Correct Blocks | False Blocks | Precision | Decisions |
|---|---:|---:|---:|---:|---|
| AMBIG_KEEP_001 | 4 | 0 | 4 | 0.00% | SUGGEST=4 |
| CASE_ATTACH_001 | 5 | 0 | 0 | n/a | ACCEPT=5 |
| ENTITY_PROTECT_001 | 3 | 0 | 1 | 0.00% | REJECT=2, SUGGEST=1 |
| HONORIFIC_CONTEXT_001 | 1 | 0 | 1 | 0.00% | SUGGEST=1 |
| MORPH_LEXICON_001 | 96 | 0 | 0 | n/a | ACCEPT=96 |
| MORPH_SUFFIX_001 | 5 | 0 | 0 | n/a | ACCEPT=5 |
| ORTH_SPACE_001 | 1 | 0 | 0 | n/a | ACCEPT=1 |
| ORTH_ZWJ_001 | 7 | 2 | 3 | 40.00% | SUGGEST=7 |
| PASSIVE_AUX_001 | 2 | 0 | 2 | 0.00% | SUGGEST=2 |
| REGISTER_CONTEXT_001 | 4 | 0 | 3 | 0.00% | SUGGEST=4 |
| SANDHI_JOIN_001 | 5 | 0 | 0 | n/a | ACCEPT=5 |
| SEMANTIC_EDIT_SIZE_001 | 13 | 3 | 8 | 27.27% | SUGGEST=13 |
| SEMANTIC_ENTITY_001 | 2 | 0 | 1 | 0.00% | REJECT=2 |
| SEMANTIC_TENSE_001 | 5 | 1 | 3 | 25.00% | SUGGEST=5 |
| SEMANTIC_VOICE_001 | 2 | 0 | 2 | 0.00% | SUGGEST=2 |
| SPELL_CONSONANT_CONFUSION_001 | 89 | 0 | 0 | n/a | ACCEPT=89 |
| SPELL_VOWEL_LENGTH_001 | 7 | 0 | 0 | n/a | ACCEPT=7 |
| VERB_TENSE_001 | 5 | 1 | 3 | 25.00% | SUGGEST=5 |
| VERB_VOICE_001 | 2 | 0 | 2 | 0.00% | SUGGEST=2 |
