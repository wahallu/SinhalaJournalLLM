# Grammar rule policy recalibration

Source measurements: [`v27-hybrid-evaluation.md`](v27-hybrid-evaluation.md). Recalibrated measurements: [`../../HYBRID_GRAMMAR_RECALIBRATED_RESULTS.md`](../../HYBRID_GRAMMAR_RECALIBRATED_RESULTS.md).

The old validator already reconstructed output at aligned edit level; it did not roll back whole sentences. Recall fell because it treated every `SUGGEST` edit as non-applied. Of the 23 old locally candidate-supported false-block edits, 22 were `SUGGEST` rollbacks and one was an over-broad entity `REJECT`.

## Before and after

| Rule | Old behavior | Measured old block precision | New behavior | Reason |
|---|---|---:|---|---|
| `AMBIG_KEEP_001` | `SUGGEST` / revert | 0.00% | `SUGGEST` / apply | 4 candidate-supported false blocks from 4 triggers. |
| `HONORIFIC_CONTEXT_001` | `SUGGEST` / revert | 0.00% | `SUGGEST` / apply | Its only adjudicated v27 trigger supported the candidate. |
| `ORTH_ZWJ_001` | `SUGGEST` / revert | 40.00% | `SUGGEST` / apply | 2 original-supported versus 3 candidate-supported adjudications are insufficient for blocking. |
| `PASSIVE_AUX_001` | `SUGGEST` / revert | 0.00% | `SUGGEST` / apply | Both adjudicated v27 triggers supported the candidate. |
| `REGISTER_CONTEXT_001` | `SUGGEST` / revert | 0.00% | `SUGGEST` / apply | 3 candidate-supported false blocks and no measured correct block. |
| `SEMANTIC_EDIT_SIZE_001` | `SUGGEST` / revert | 27.27% | `SUGGEST` / apply | 3 original-supported versus 8 candidate-supported old adjudications; edit size is risk metadata, not proof of error. |
| `SEMANTIC_TENSE_001` | `SUGGEST` / revert | 25.00% | `SUGGEST` / apply | 1 original-supported versus 3 candidate-supported adjudications. |
| `VERB_TENSE_001` | `SUGGEST` / revert | 25.00% | `SUGGEST` / apply | Same five aligned tense edits as the semantic signal. |
| `SEMANTIC_VOICE_001` | `SUGGEST` / revert | 0.00% | `SUGGEST` / apply | Both adjudicated v27 edits supported the candidate. |
| `VERB_VOICE_001` | `SUGGEST` / revert | 0.00% | `SUGGEST` / apply | Same two aligned voice edits as the semantic signal. |
| `ENTITY_PROTECT_001` | Probable entity `REJECT`; generic suspicion `SUGGEST` / revert | 0.00% on locally adjudicated blocks | Confidence-based: `HIGH` reject, `MEDIUM` warn/apply | The old rule prevented one true surname substitution but also blocked a gold-correct surname spelling repair. |
| `SEMANTIC_ENTITY_001` | Probable entity `REJECT` | 0.00% on locally adjudicated blocks | Emit only with `HIGH` entity evidence and reject | Avoid presenting a heuristic entity shape as deterministic safety evidence. |
| `QUOTE_PROTECT_001` | `SUGGEST` / revert | n/a (no v27 trigger) | `SUGGEST` / apply | Quotation/register changes require editorial warning, but absence of v27 evidence does not justify blocking. |

`n/a` is not interpreted as proof of correctness. The policy change is structural and was not implemented as sentence-specific replacement pairs.

## Effective tiers

| Tier | Rules | Output authority |
|---|---|---|
| Hard protection | `NUMBER_PROTECT_001`, `URL_PROTECT_001`, `EMAIL_PROTECT_001`, `POLARITY_PROTECT_001`; conditional `ENTITY_PROTECT_001` / `SEMANTIC_ENTITY_001` | Revert only the unsafe aligned edit. Entity rules require `HIGH` confidence. |
| Deterministic safe | `ORTH_NFC_001`, `ORTH_SPACE_001`; attested `CASE_ATTACH_001` | May retain or perform only the existing deterministic surface correction. |
| Advisory | Ambiguity, honorific, quotation/register, ZWJ, passive, tense, voice, agreement, and edit-size checks | Apply the neural edit and attach `SUGGEST`, a reason, severity, and categorical confidence. |
| Supporting validation | Lexicon, suffix, sandhi, and spelling signals | Support neural candidates; they do not invent global replacements. |

## Entity evidence

- `HIGH`: explicit newsroom `protected_terms`; a clear change between different reviewed Sinhala surname endings; or a change between different all-uppercase Latin acronyms. These may reject.
- `MEDIUM`: a heuristic entity/name shape, including a spelling repair that preserves the same surname ending. These warn and apply.
- `LOW`: weak context without independent entity evidence. These cannot reject as entity protection.

These categories are policy evidence levels, not calibrated probabilities.

## Evaluation limits

No separate development split was available for this policy pass. Therefore the implementation changes only general decision semantics and evidence classes; it does not add v27 target replacements or sentence-specific rules. The same untouched 154-example test transcript is replayed for A/B/C reporting. Three policy fixtures for ZWJ and voice/passive behavior deliberately have `gold=null` and `needs_native_review=true`; they verify non-blocking behavior but make no linguistic correctness claim.
