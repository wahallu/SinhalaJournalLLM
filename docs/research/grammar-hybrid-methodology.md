# Hybrid Sinhala grammatical-error-correction methodology

## Motivation

SINAI's neural grammar model can generate contextual corrections but may also over-correct correct text or mutate factual newsroom content. The deterministic layer is designed to improve precision, factual safety, and explainability. It is not presented as a complete hand-written Sinhala grammar checker.

The saved v27 evaluation supports that framing: v27 is conservative and preserves clean text strongly, while correction-needed and unseen-transfer performance remain materially lower. The repository does not contain proof of which adapter is currently selected in the runtime settings database, so v27 is treated here as the latest measured research baseline, not as a confirmed live deployment.

## Architecture and model/rule interaction

```text
Preprocessed chunk
  -> neural generator proposes candidate
  -> lossless token alignment
  -> factual protection (number, URL, email, entity, polarity, quote)
  -> linguistic validation (orthography, lexicon/morphology, agreement, predicate, tense/voice)
  -> semantic edit-size gate
  -> ACCEPT / SUGGEST / REJECT / KEEP per edit
  -> safe automatic text plus structured research metadata
```

This implements the safer interaction:

```text
Rule detects or supplies features
  -> model generates a contextual correction
  -> rule validates whether the proposed edit is safe
```

The validator accepts two strings and optional context/metadata. It never calls the model and requires no network access.

## Rule categories

- Orthographic: NFC, spacing, joiner/grapheme uncertainty.
- Factual protection: numbers/dates/percentages, URLs, emails, probable names, approved newsroom glossary terms.
- Morphological: structured pronouns, exact reviewed predicate features, case-suffix attachment, shared lexicon evidence.
- Agreement/predicate: known person/number/gender compatibility, mandatory inanimate-plural exception, compound-predicate recognition, non-verbal-predicate restraint.
- Semantic preservation: polarity, tense, voice, quote/register, and edit-size checks.
- Contextual-only: word order, object case, deixis, honorifics, negation generation, causatives, volitive/involitive, and broad register conversion.

## Safety mechanisms

Protected factual values are compared as multisets, retaining repeated values. Token alignment preserves whitespace/punctuation so an unsafe local edit can be reverted without rewriting unrelated text. The existing substitution guard is reused, uppercase Latin names/acronyms and repository-attested institution designators are protected, and multi-token newsroom glossary spans are supported. High-confidence probable entity mutations are rejected, while generic low-similarity lexical substitutions are downgraded for review rather than mislabeled as certain named entities.

Large-rewrite detection combines an absolute changed-token floor with a relative ratio. This prevents a valid one-word edit in a very short sentence from being rejected only because its percentage is high.

No production-approved global replacement ships in the rule data. Both-valid forms reuse the corpus builder's protected inventory and are suggestion-only.

## Evaluation design and ablation

All three systems consume the same held-out examples:

1. Neural only: saved/generated model output.
2. Rules only: AUTO deterministic surface rules without a neural candidate.
3. Hybrid: the same neural output followed by rule validation.

The evaluator accepts the repository JSONL prediction format or a saved `test_grammar.py` transcript. Replay of a saved transcript needs no GPU and guarantees every ablation sees identical model candidates.

Reported metrics are:

- sentence exact match;
- correction-needed exact match;
- clean preservation and over-correction;
- under-correction;
- exact whitespace-token edit precision, recall, and F0.5;
- entity, number, and polarity mutation rates;
- validator ACCEPT/SUGGEST/REJECT counts;
- per-rule trigger counts and locally adjudicable correct/false blocks.

F0.5 weights precision more heavily than recall, matching the newsroom safety objective. Char-F1 is not used as the primary measure because unchanged characters dominate and can conceal correction failure.

## Measured v27 transcript replay

The checked-in report `docs/research/v27-hybrid-evaluation.md` was generated from 154 saved v27 predictions. It shows the intended trade-off rather than an unqualified improvement: entity mutations fell from 1.30% to 0%, edit precision rose from 88.27% to 89.68%, edit recall fell from 71.14% to 56.22%, and exact match fell from 66.88% to 57.14%. The current rules are therefore safety-oriented and too conservative to claim an overall accuracy gain. Native-speaker review and rule-specific calibration should target the false downgrades before production thresholds are relaxed.

## Human review

`scripts/export_grammar_review.py` exports each SUGGEST/REJECT case with blank reviewer fields. A native Sinhala linguist or journalist can label whether the model candidate, original, or another correction is appropriate. Those labels should be used to estimate real rule precision and decide whether any CHECK rule may safely become AUTO.

## Known limitations

The current feature lexicon is deliberately incomplete; unknown values remain unknown. There is no full Sinhala POS tagger, dependency parser, NER model, or morphological analyzer in the current backend. The system therefore cannot prove complex agreement, differential object marking, word order, honorific agreement, deixis, causativity, or involitive readings. Adding speculative suffix tables would produce a larger-looking system but weaker research validity.
