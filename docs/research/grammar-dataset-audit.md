# Sinhala grammar dataset rule-risk audit

Dataset root inspected: `/Users/nisalfonseka/Documents/GitHub/Research/manual dataset`

This audit does not rewrite or relabel data. `Conflicting inputs` counts identical inputs mapped to more than one target within the same file; it is a triage signal, not automatic proof that either target is wrong.

| Dataset | Rows | Changed | Preserved | Conflicting inputs | Rule category | Deterministic/contextual | Possible noisy assumption | Risk |
|---|---:|---:|---:|---:|---|---|---|---|
| `Mixed.jsonl` | 341 | 336 | 5 | 0 | Multiple phenomena | Mixed | A row may combine safe spelling with contextual rewrites. | High |
| `causative.jsonl` | 59 | 48 | 11 | 0 | Causativity/valency | Contextual | Suffix resemblance does not prove a causative reading. | High |
| `copula.jsonl` | 76 | 49 | 27 | 0 | Copular/non-verbal predicate | Mostly contextual | Valid non-verbal predicates must not be rejected for lacking a finite verb. | Medium |
| `correct.jsonl` | 780 | 0 | 780 | 0 | Clean preservation | Deterministic target | Source quality determines whether unchanged labels are trustworthy. | Low |
| `correct_extra.jsonl` | 35 | 0 | 35 | 0 | Clean preservation | Deterministic target | Same preservation-label caveat as correct.jsonl. | Low |
| `definiteness.jsonl` | 99 | 58 | 41 | 0 | Definiteness | Contextual/check | Article choice can depend on discourse and noun semantics. | Medium |
| `deixis.jsonl` | 42 | 28 | 14 | 0 | Deixis/anaphora | Contextual | Sentence-local substitution may lack the referent needed to choose මේ/ඒ/අර. | High |
| `honorific.jsonl` | 76 | 58 | 18 | 0 | Honorific agreement | Contextual | Requires referent, title, gender/social context, and register. | High |
| `involitive.jsonl` | 126 | 89 | 37 | 0 | Volitive/involitive | Contextual | Predicate form and argument structure must be jointly interpreted. | High |
| `negation.jsonl` | 111 | 79 | 32 | 0 | Negation/polarity | Contextual/protect | Naive transformations can reverse factual polarity. | High |
| `numeral.jsonl` | 109 | 31 | 78 | 0 | Numeral morphology | Protection plus check | Numeric value must remain distinct from nearby morphology. | High |
| `paragraph.jsonl` | 98 | 89 | 9 | 0 | Multi-sentence grammar | Mixed | Several corrections and quote/register changes may be entangled. | Medium |
| `passive.jsonl` | 334 | 248 | 86 | 0 | Passive/voice | Contextual/check | Some rows also formalize register; active/passive conversion can change emphasis. | High |
| `plural.jsonl` | 249 | 229 | 20 | 0 | Agreement | Check | A blanket plural-subject rule would mishandle inanimate plural exceptions. | High |
| `pronoun.jsonl` | 179 | 158 | 21 | 0 | Pronoun/tense/case | Mixed | File includes more than pronoun-form correction, so filename is not a pure label. | Medium |
| `register.jsonl` | 249 | 16 | 233 | 0 | Journalistic register | Contextual | Valid colloquial forms, especially quotations, are not grammatical errors. | High |
| `sandhi.jsonl` | 104 | 90 | 14 | 0 | Joining/case attachment | Deterministic/check | Arbitrary adjacent words cannot be merged without morphology/lexicon evidence. | Medium |
| `sov.jsonl` | 378 | 369 | 9 | 0 | Word order | Contextual/soft | Sinhala scrambling means non-SOV is not automatically ungrammatical. | High |
| `spelling.jsonl` | 853 | 796 | 57 | 0 | Orthography | Deterministic/check | Both members of confusable pairs may be valid words in context. | Medium |
| `verb.jsonl` | 191 | 180 | 11 | 1 | Tense/aspect | Contextual/check | Temporal adverbs are evidence but not a license for global tense harmonization. | High |
| `news_ai_grammar_dataset.jsonl` | 491 | 489 | 2 | 0 | AI-generated news grammar | Mixed | Generation provenance and lack of native review may amplify synthetic assumptions. | High |
| `news_ai_formal_dataset.jsonl` | 500 | 363 | 137 | 1 | AI-generated formalization | Contextual/register | Formalization should not be conflated with grammaticality. | High |
| `news_correct.jsonl` | 398 | 23 | 375 | 0 | News preservation | Deterministic target | Published text is useful but publication is not proof of grammatical correctness. | Medium |
| `stage5_round.jsonl` | 9000 | 7500 | 1500 | 0 | Targeted synthetic round | Mixed | Synthetic corruption targets benchmark gaps and can encode pair exposure. | High |
| `test data/grammar_test_stage2.jsonl` | 57 | 42 | 15 | 0 | Held-out stage 2 | Evaluation | Known historical gold contradictions require current-gold use. | Medium |
| `test data/grammar_test_stage3.jsonl` | 10 | 10 | 0 | 0 | Held-out stage 3 | Evaluation | No clean controls, so preservation cannot be measured in this stage alone. | Medium |
| `test data/grammar_test_stage4.jsonl` | 36 | 26 | 10 | 0 | Held-out real-news stage 4 | Evaluation | Small article count limits coverage. | Medium |
| `test data/grammar_test_stage5.jsonl` | 51 | 38 | 13 | 0 | Held-out hardest stage 5 | Evaluation | Small, intentionally difficult set; report confidence/absolute counts. | Medium |

## Findings

- Inspected 28 configured datasets containing 15,032 valid JSONL rows; 0 configured paths were missing and 0 rows were malformed.
- `sov.jsonl`, `deixis.jsonl`, `honorific.jsonl`, `involitive.jsonl`, `causative.jsonl`, and `negation.jsonl` are unsuitable as direct global replacement tables. They require context or soft validation.
- `plural.jsonl` must not be converted into a universal plural-subject to plural-predicate rule; the runtime validator explicitly implements `AGR_INANIMATE_EXCEPTION_001`.
- `sandhi.jsonl` supports case-suffix attachment evidence, but only an attested merged form is auto-accepted. Unknown merges remain suggestions.
- `spelling.jsonl` is useful for candidate generation, while the repository's `AMBIGUOUS_KEEP` inventory prevents both-valid word pairs becoming global substitutions.
- AI-generated and corpus-derived data remain training evidence, not linguistic authority. Native-speaker adjudication is still required for high-risk categories.
