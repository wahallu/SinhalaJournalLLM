# Journal grammar rules: error analysis and measurements

Analysis date: 2026-10-18. Code: `apps/backend-api/app/services/grammar/journal_rules.py`.
Tests: `apps/backend-api/tests/test_journal_rules.py`. Demo articles: `grammar-demo-articles.md`.

## Why a rule layer exists

The grammar pipeline is **model → validator → (rule layer)**. The SinLlama adapter mostly
learned spelling repairs. The validator (`rule_validator.py`) only accepts, downgrades or
rejects edits the model already made, and it never proposes one. On Stage 6 it changed
0 of 286 outputs. So grammar errors the model leaves alone were never corrected.
`journal_rules.py` proposes those corrections deterministically, after validation, and
labels each one with its rule ID and a bilingual explanation.

## Data used

| Source | Size | Used for |
|---|---|---|
| Training pairs (`manual dataset/*.jsonl`, `cleaned_v10_full.jsonl`) | 23,070 distinct changed input→output pairs | Finding which grammar errors the team annotated |
| Published news (Lankadeepa, ITN, Ada Derana) | 229,362 articles, 1,182,728 unique sentences | Attesting verb forms, and measuring how often each rule fires on edited copy |
| Held-out test sets (`test data/grammar_test_stage2-5.jsonl`) | 154 rows | One-time agreement check against gold |

The private Stage 6 gold was **not** used to design or tune the rules, so it remains a clean
benchmark.

## What the training pairs show

Most annotated edits are orthographic, for example ි/ී (1,917), න/ණ (1,321 + 1,210),
ග/ඟ (803) and ල/ළ (504). The grammar edits that recur are:

- **Spoken verb forms replaced with written ones:** සිටියා→සිටියහ (94), කරනවා→කරයි (78),
  දුන්නා→දුන්නේය (76), and කරලා තියෙනවා→කර තිබේ.
- **Spoken reported clause replaced with written:** "කරනවා කියලාය"→"කරන බවයි",
  "කිව්වා කියලා"→"පැවසුවේ".
- **Detached case suffix:** "ප්‍රදේශ වල"→"ප්‍රදේශවල" (29), "ස්ථාන වල"→"ස්ථානවල" (24), and others.
- **Subject–verb agreement in formal plural:** for example `plural.jsonl`
  "නිලධාරීන් … පවත්වනවා"→"නිලධාරීහු … පවත්වති".
- **Other:** passive conversion (`passive.jsonl`), copula වේ insertion (`copula.jsonl`), and
  animate/inanimate indefinites (`definiteness.jsonl`).

## Rules, and how often each fires on published news

Published news is edited copy, so a rule that fires often there is either catching real
errors that editors let through, or is wrong. Every rule below was run over 1,061,957
hard-news sentences (Lankadeepa, ITN, Ada Derana). I then read samples of its hits and
tightened the rule until the hits in the sample were real errors.

| Rule | Concept | Fires per 10k published sentences | Sample review |
|---|---|---:|---|
| `GRAM_CASE_ATTACH_001` | Bound case suffix written joined (ප්‍රදේශ වල → ප්‍රදේශවල, X ගේ → Xගේ) | 151 | Joins a detached suffix; published copy detaches 17,044 times vs 118,878 joined, and the team's gold joins it |
| `GRAM_CLEFT_FOCUS_001` | Focus sentence ending: මේ බව පැවසුවේ … අමතමින් → අමතමිනි | 5.1 | Mostly ITN; Lankadeepa style already uses -මිනි |
| `GRAM_AGR_001` | Subject–verb number/gender agreement (past and present) | 1.8 | Mostly real errors, e.g. "නිලධාරීහු … පැවසීය", "හෙතෙම … දුන්හ", "පොලිසිය … පවත්වති" |
| `GRAM_VOICE_001` | විසින් agent needs a passive predicate (… කරන ලදී) | 1.6 | Prescriptive rule; published copy often breaks it |
| `GRAM_REGISTER_001` | Written plural subject (-හු) with a spoken verb (කළා → කළහ) | 1.2 | All sampled hits were real register mixes |
| `GRAM_VOICE_002` | Active speech verb takes no විසින් | 0.05 | — |
| `GRAM_CLAUSE_001` | Focused reporting verb closes with බවයි / ලෙසයි | 0.05 | — |
| `GRAM_TENSE_001` | Time word fixes tense (ඊයේ / හෙට / ලබන සතියේ) | 0.03 | — |
| `GRAM_CASE_DATIVE_001` | Warn/advise/inform takes dative -ට | 0.02 | — |
| `GRAM_CASE_ABLATIVE_001` | Request/question takes animate ablative -ගෙන් | <0.01 | — |

The verb endings used by agreement come from `data/journal_verb_forms.json`: 36 past and 36
present rows, each attested in the corpus. Rebuild it with
`scripts/build_journal_verb_forms.py`.

### Guards added because of false alarms on published news

- **Clause boundaries.** බව, යැයි, ලෙස and යනුවෙන් are boundaries, and so are fused
  quotatives and subordinators (ඇතැයි, තිබියදී, යද්දී, කළහොත්). No rule reaches across one.
- **Subject choice.** All subject-like words in the clause must agree, or the sentence is
  left alone. Subjects of embedded participles are ignored ("ඔහු කියවමින් හුන් තැනට").
  "X ඇතුළු", coordinations, group nouns and monk honorifics are skipped.
- **Agreement direction.** A plural verb is made singular only when the subject is a
  pronoun or an institution, because "X මහතා … කළහ" may be honorific or a list of names.
  A feminine verb is never changed, because the subject is often an unmarked woman's name.
  Passive auxiliaries (කරනු ලැබීය), impersonal modals (හැකි විය) and event verbs
  (සිදු විය, හට ගත්තේය) are skipped.
- **Case marking.** "X-ගෙන් උපදෙස් ලබා ගත්තා" (obtain from) is left alone. A -ට noun with
  anything between it and ඉල්ලා is a beneficiary ("ජනතාවට යුක්තිය ඉල්ලා"). "ඔහුට ඉල්ලා සිටිය හැකිය"
  is an experiencer -ට.
- **Tense.** The rule does not fire when the time word modifies a relative or purpose
  clause, when there is also අද or දැන්, or when it marks a span (ඊයේ සිට, … තුළ).
  Figurative "හෙට දවස" is not treated as a time word.
- **Quoted speech.** Sentences containing quotation marks are left alone. So is unquoted
  direct speech after a cleft (a comma after the verb, or first-person or spoken words).

## Rules tried and rejected

| Candidate | Evidence | Decision |
|---|---|---|
| Numeral classifier: "පුද්ගලයන් 3ක්" → "3 දෙනෙක්" | Fired 20 per 10k sentences on published news; the team's own `numeral.jsonl` gold keeps "පුද්ගලයින් 10ක්" as correct | **Removed.** It was in the first demo version. |
| පොලීසිය ↔ පොලිසිය spelling | 12,392 vs 18,960 in published news; the training data prefers පොලීසිය | **Removed.** Both spellings are in normal use. |
| Spoken reported clause "… කරනවා කියලා" → "… කරන බව" | 7,840 published sentences, mostly quoted speech and ITN broadcast style | Rejected. This is a register choice, not an error. |
| Animate indefinite "-යක්" → "-යෙක්" | The ending also matches ඕවරයක් (cricket "over"); few real cases | Rejected for low precision. |
| Unrestricted subject agreement (v1) | Fired 10.9 per 10k with many false alarms | Replaced by the guarded version above (1.8 per 10k). |

## Held-out check (stage 2–5 test sets, 154 rows)

- The rules changed **0** already-correct rows.
- **10** of their 11 edits match the gold correction: 8 case-suffix joins and 2 spellings.
- The other edit joins "විමර්ශන වලදී", which that gold row left detached.
- The stage 2–5 inputs contain few of the targeted constructions, so this shows restraint,
  not recall.

## Limits

- This is a curated rule layer for the constructions listed above, not a general Sinhala
  grammar.
- The sample reviews are the analyst's reading, not native-speaker annotation. A proper
  precision figure needs a reviewer to label a random sample of hits for each rule.
- The rules have not been evaluated on Stage 6 and must not be reported as an accuracy
  figure.
- The layer can be turned off with the runtime setting `grammar.journal_rules_enabled`.
  Turn it off for model-only evaluations.
