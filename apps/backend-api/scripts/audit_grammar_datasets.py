#!/usr/bin/env python3
"""Generate a reproducible risk audit of the repository's Sinhala GEC data."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

SCRIPT = Path(__file__).resolve()
REPO = SCRIPT.parents[3]
DEFAULT_DATASET_ROOT = SCRIPT.parents[4] / "manual dataset"
DEFAULT_OUTPUT = REPO / "docs/research/grammar-dataset-audit.md"


@dataclass(frozen=True)
class Category:
    filename: str
    rule_category: str
    deterministic: str
    noisy_assumptions: str
    risk: str


CATEGORIES = (
    Category("Mixed.jsonl", "Multiple phenomena", "Mixed", "A row may combine safe spelling with contextual rewrites.", "High"),
    Category("causative.jsonl", "Causativity/valency", "Contextual", "Suffix resemblance does not prove a causative reading.", "High"),
    Category("copula.jsonl", "Copular/non-verbal predicate", "Mostly contextual", "Valid non-verbal predicates must not be rejected for lacking a finite verb.", "Medium"),
    Category("correct.jsonl", "Clean preservation", "Deterministic target", "Source quality determines whether unchanged labels are trustworthy.", "Low"),
    Category("correct_extra.jsonl", "Clean preservation", "Deterministic target", "Same preservation-label caveat as correct.jsonl.", "Low"),
    Category("definiteness.jsonl", "Definiteness", "Contextual/check", "Article choice can depend on discourse and noun semantics.", "Medium"),
    Category("deixis.jsonl", "Deixis/anaphora", "Contextual", "Sentence-local substitution may lack the referent needed to choose මේ/ඒ/අර.", "High"),
    Category("honorific.jsonl", "Honorific agreement", "Contextual", "Requires referent, title, gender/social context, and register.", "High"),
    Category("involitive.jsonl", "Volitive/involitive", "Contextual", "Predicate form and argument structure must be jointly interpreted.", "High"),
    Category("negation.jsonl", "Negation/polarity", "Contextual/protect", "Naive transformations can reverse factual polarity.", "High"),
    Category("numeral.jsonl", "Numeral morphology", "Protection plus check", "Numeric value must remain distinct from nearby morphology.", "High"),
    Category("paragraph.jsonl", "Multi-sentence grammar", "Mixed", "Several corrections and quote/register changes may be entangled.", "Medium"),
    Category("passive.jsonl", "Passive/voice", "Contextual/check", "Some rows also formalize register; active/passive conversion can change emphasis.", "High"),
    Category("plural.jsonl", "Agreement", "Check", "A blanket plural-subject rule would mishandle inanimate plural exceptions.", "High"),
    Category("pronoun.jsonl", "Pronoun/tense/case", "Mixed", "File includes more than pronoun-form correction, so filename is not a pure label.", "Medium"),
    Category("register.jsonl", "Journalistic register", "Contextual", "Valid colloquial forms, especially quotations, are not grammatical errors.", "High"),
    Category("sandhi.jsonl", "Joining/case attachment", "Deterministic/check", "Arbitrary adjacent words cannot be merged without morphology/lexicon evidence.", "Medium"),
    Category("sov.jsonl", "Word order", "Contextual/soft", "Sinhala scrambling means non-SOV is not automatically ungrammatical.", "High"),
    Category("spelling.jsonl", "Orthography", "Deterministic/check", "Both members of confusable pairs may be valid words in context.", "Medium"),
    Category("verb.jsonl", "Tense/aspect", "Contextual/check", "Temporal adverbs are evidence but not a license for global tense harmonization.", "High"),
    Category("news_ai_grammar_dataset.jsonl", "AI-generated news grammar", "Mixed", "Generation provenance and lack of native review may amplify synthetic assumptions.", "High"),
    Category("news_ai_formal_dataset.jsonl", "AI-generated formalization", "Contextual/register", "Formalization should not be conflated with grammaticality.", "High"),
    Category("news_correct.jsonl", "News preservation", "Deterministic target", "Published text is useful but publication is not proof of grammatical correctness.", "Medium"),
    Category("stage5_round.jsonl", "Targeted synthetic round", "Mixed", "Synthetic corruption targets benchmark gaps and can encode pair exposure.", "High"),
    Category("test data/grammar_test_stage2.jsonl", "Held-out stage 2", "Evaluation", "Known historical gold contradictions require current-gold use.", "Medium"),
    Category("test data/grammar_test_stage3.jsonl", "Held-out stage 3", "Evaluation", "No clean controls, so preservation cannot be measured in this stage alone.", "Medium"),
    Category("test data/grammar_test_stage4.jsonl", "Held-out real-news stage 4", "Evaluation", "Small article count limits coverage.", "Medium"),
    Category("test data/grammar_test_stage5.jsonl", "Held-out hardest stage 5", "Evaluation", "Small, intentionally difficult set; report confidence/absolute counts.", "Medium"),
)


def inspect_jsonl(path: Path) -> dict[str, int]:
    rows = changed = clean = malformed = conflicts = 0
    outputs: dict[str, set[str]] = defaultdict(set)
    if not path.exists():
        return {"rows": 0, "changed": 0, "clean": 0, "malformed": 0, "conflicts": 0, "missing": 1}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            source, target = row["input"], row["output"]
        except (json.JSONDecodeError, KeyError, TypeError):
            malformed += 1
            continue
        rows += 1
        changed += source != target
        clean += source == target
        outputs[source].add(target)
    conflicts = sum(len(values) > 1 for values in outputs.values())
    return {"rows": rows, "changed": changed, "clean": clean, "malformed": malformed, "conflicts": conflicts, "missing": 0}


def report(dataset_root: Path) -> str:
    lines = [
        "# Sinhala grammar dataset rule-risk audit",
        "",
        f"Dataset root inspected: `{dataset_root}`",
        "",
        "This audit does not rewrite or relabel data. `Conflicting inputs` counts identical inputs mapped to more than one target within the same file; it is a triage signal, not automatic proof that either target is wrong.",
        "",
        "| Dataset | Rows | Changed | Preserved | Conflicting inputs | Rule category | Deterministic/contextual | Possible noisy assumption | Risk |",
        "|---|---:|---:|---:|---:|---|---|---|---|",
    ]
    totals = CounterLike()
    for category in CATEGORIES:
        stats = inspect_jsonl(dataset_root / category.filename)
        totals.add(stats)
        name = f"`{category.filename}`" + (" (missing)" if stats["missing"] else "")
        lines.append(
            f"| {name} | {stats['rows']} | {stats['changed']} | {stats['clean']} | "
            f"{stats['conflicts']} | {category.rule_category} | {category.deterministic} | "
            f"{category.noisy_assumptions} | {category.risk} |"
        )
    lines += [
        "",
        "## Findings",
        "",
        f"- Inspected {totals.files} configured datasets containing {totals.rows:,} valid JSONL rows; {totals.missing} configured paths were missing and {totals.malformed} rows were malformed.",
        "- `sov.jsonl`, `deixis.jsonl`, `honorific.jsonl`, `involitive.jsonl`, `causative.jsonl`, and `negation.jsonl` are unsuitable as direct global replacement tables. They require context or soft validation.",
        "- `plural.jsonl` must not be converted into a universal plural-subject to plural-predicate rule; the runtime validator explicitly implements `AGR_INANIMATE_EXCEPTION_001`.",
        "- `sandhi.jsonl` supports case-suffix attachment evidence, but only an attested merged form is auto-accepted. Unknown merges remain suggestions.",
        "- `spelling.jsonl` is useful for candidate generation, while the repository's `AMBIGUOUS_KEEP` inventory prevents both-valid word pairs becoming global substitutions.",
        "- AI-generated and corpus-derived data remain training evidence, not linguistic authority. Native-speaker adjudication is still required for high-risk categories.",
    ]
    return "\n".join(lines) + "\n"


class CounterLike:
    def __init__(self):
        self.files = self.rows = self.malformed = self.missing = 0

    def add(self, stats: dict[str, int]) -> None:
        self.files += 1
        self.rows += stats["rows"]
        self.malformed += stats["malformed"]
        self.missing += stats["missing"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, default=DEFAULT_DATASET_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    rendered = report(args.dataset_root.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
