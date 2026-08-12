#!/usr/bin/env python3
"""Evaluate model-only, deterministic-only, and hybrid Sinhala GEC systems.

Input may be a JSONL prediction file with ``input``, ``target`` (or ``output``),
and ``model_output`` fields, or a saved SINAI transcript containing INPUT,
PREDICT, and EXPECTED lines. No model or network call is made.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.grammar.morphology import polarity  # noqa: E402
from app.services.grammar.rule_types import Decision  # noqa: E402
from app.services.grammar.rule_validator import SinhalaRuleValidator  # noqa: E402
from app.services.grammar.safety_gate import protected_counters  # noqa: E402
from app.services.grammar.substitution_guard import is_probable_name  # noqa: E402

_TRANSCRIPT = re.compile(r"^\s*(INPUT|PREDICT|EXPECTED)\s*:\s*(.*)$")


@dataclass(frozen=True)
class Example:
    id: str
    input: str
    target: str
    model_output: str


def load_examples(path: Path) -> list[Example]:
    """Load the repository JSONL or saved evaluation-transcript format."""
    if path.suffix.lower() == ".jsonl":
        out: list[Example] = []
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            row = json.loads(line)
            target = row.get("target", row.get("output"))
            prediction = row.get("model_output", row.get("prediction"))
            if target is None or prediction is None:
                raise ValueError(f"{path}:{line_no}: target/output and model_output are required")
            out.append(Example(str(row.get("id", line_no)), row["input"], target, prediction))
        return out

    examples: list[Example] = []
    current: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = _TRANSCRIPT.match(line)
        if not match:
            continue
        current[match.group(1)] = match.group(2)
        if all(key in current for key in ("INPUT", "PREDICT", "EXPECTED")):
            examples.append(Example(
                str(len(examples) + 1), current["INPUT"], current["EXPECTED"], current["PREDICT"]
            ))
            current = {}
    if not examples:
        raise ValueError(f"No prediction triples found in {path}")
    return examples


def _tokens(text: str) -> list[str]:
    return re.findall(r"\S+", unicodedata.normalize("NFC", text))


def edit_set(source: str, target: str) -> set[tuple[int, int, tuple[str, ...], tuple[str, ...]]]:
    """Exact whitespace-token edits suitable for precision/recall comparison."""
    old, new = _tokens(source), _tokens(target)
    edits = set()
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
        if tag != "equal":
            edits.add((i1, i2, tuple(old[i1:i2]), tuple(new[j1:j2])))
    return edits


@dataclass
class Metrics:
    total: int = 0
    exact: int = 0
    change_total: int = 0
    change_exact: int = 0
    clean_total: int = 0
    clean_preserved: int = 0
    overcorrected: int = 0
    undercorrected: int = 0
    true_edits: int = 0
    predicted_edits: int = 0
    matched_edits: int = 0
    entity_mutations: int = 0
    number_mutations: int = 0
    polarity_mutations: int = 0

    def add(self, example: Example, prediction: str) -> None:
        self.total += 1
        self.exact += prediction == example.target
        if example.input == example.target:
            self.clean_total += 1
            self.clean_preserved += prediction == example.input
            self.overcorrected += prediction != example.input
        else:
            self.change_total += 1
            self.change_exact += prediction == example.target
            self.undercorrected += prediction == example.input

        gold_edits = edit_set(example.input, example.target)
        predicted = edit_set(example.input, prediction)
        self.true_edits += len(gold_edits)
        self.predicted_edits += len(predicted)
        self.matched_edits += len(gold_edits & predicted)
        before, after = protected_counters(example.input), protected_counters(prediction)
        self.number_mutations += before["number"] != after["number"]
        self.entity_mutations += _entity_mutated(example.input, prediction)
        self.polarity_mutations += _polarity_mutated(example.input, prediction)

    def summary(self) -> dict[str, float | int]:
        ratio = lambda numerator, denominator: numerator / denominator if denominator else 0.0
        precision = ratio(self.matched_edits, self.predicted_edits)
        recall = ratio(self.matched_edits, self.true_edits)
        beta_sq = 0.25
        f05 = (
            (1 + beta_sq) * precision * recall / (beta_sq * precision + recall)
            if precision or recall else 0.0
        )
        return {
            "N": self.total,
            "exact_match": round(ratio(self.exact, self.total), 4),
            "correction_needed_exact": round(ratio(self.change_exact, self.change_total), 4),
            "clean_preservation": round(ratio(self.clean_preserved, self.clean_total), 4),
            "overcorrection_rate": round(ratio(self.overcorrected, self.clean_total), 4),
            "undercorrection_rate": round(ratio(self.undercorrected, self.change_total), 4),
            "edit_precision": round(precision, 4),
            "edit_recall": round(recall, 4),
            "edit_f0.5": round(f05, 4),
            "entity_mutation_rate": round(ratio(self.entity_mutations, self.total), 4),
            "number_mutation_rate": round(ratio(self.number_mutations, self.total), 4),
            "polarity_mutation_rate": round(ratio(self.polarity_mutations, self.total), 4),
        }


def _entity_mutated(original: str, candidate: str) -> bool:
    old, new = _tokens(original), _tokens(candidate)
    matcher = SequenceMatcher(None, old, new, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        if any(is_probable_name(word.strip(".,;:!?\"'“”")) for word in old[i1:i2] + new[j1:j2]):
            return True
    return False


def _polarity_mutated(original: str, candidate: str) -> bool:
    left, right = polarity(original), polarity(candidate)
    return left != right and (left is not None or right is not None)


@dataclass
class RuleCoverage:
    trigger_count: int = 0
    correct_blocks: int = 0
    false_blocks: int = 0
    decisions: Counter[str] = field(default_factory=Counter)


def evaluate(examples: Iterable[Example]) -> dict:
    validator = SinhalaRuleValidator()
    metrics = {name: Metrics() for name in ("model_only", "rules_only", "hybrid")}
    decision_counts: Counter[str] = Counter()
    coverage: dict[str, RuleCoverage] = defaultdict(RuleCoverage)
    examples = list(examples)

    for example in examples:
        rules_output = validator.apply_rules_only(example.input)
        validation = validator.validate(example.input, example.model_output)
        predictions = {
            "model_only": example.model_output,
            "rules_only": rules_output,
            "hybrid": validation.final_text,
        }
        for system, prediction in predictions.items():
            metrics[system].add(example, prediction)

        decision_counts.update(edit.decision.value for edit in validation.edits)
        for edit in validation.edits:
            for rule_id in edit.rule_ids:
                item = coverage[rule_id]
                item.trigger_count += 1
                item.decisions[edit.decision.value] += 1
                if edit.decision in {Decision.REJECT, Decision.SUGGEST}:
                    original_supported = bool(edit.original and edit.original in example.target)
                    candidate_supported = bool(edit.candidate and edit.candidate in example.target)
                    if original_supported and not candidate_supported:
                        item.correct_blocks += 1
                    elif candidate_supported and not original_supported:
                        item.false_blocks += 1

    return {
        "systems": {name: value.summary() for name, value in metrics.items()},
        "validator_decisions": dict(decision_counts),
        "rule_coverage": {
            rule_id: {
                "trigger_count": value.trigger_count,
                "correct_blocks": value.correct_blocks,
                "false_blocks": value.false_blocks,
                "precision": round(
                    value.correct_blocks / (value.correct_blocks + value.false_blocks), 4
                ) if value.correct_blocks + value.false_blocks else None,
                "decisions": dict(value.decisions),
            }
            for rule_id, value in sorted(coverage.items())
        },
    }


def markdown_report(result: dict, source: Path) -> str:
    systems = result["systems"]
    lines = [
        "# Hybrid grammar evaluation",
        "",
        f"Source: `{source}`",
        "",
        "All values below were measured by this script; no missing value was estimated.",
        "",
        "| System | Exact Match | Change Needed | Preservation | Over-correction | Edit Precision | Edit Recall | F0.5 | Entity Errors | Number Errors |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    labels = {"model_only": "Neural model", "rules_only": "Rules only", "hybrid": "Neural + rules"}
    for key in ("model_only", "rules_only", "hybrid"):
        row = systems[key]
        pct = lambda name: f"{100 * row[name]:.2f}%"
        lines.append(
            f"| {labels[key]} | {pct('exact_match')} | {pct('correction_needed_exact')} | "
            f"{pct('clean_preservation')} | {pct('overcorrection_rate')} | {pct('edit_precision')} | "
            f"{pct('edit_recall')} | {row['edit_f0.5']:.4f} | {pct('entity_mutation_rate')} | "
            f"{pct('number_mutation_rate')} |"
        )

    lines += [
        "",
        "## Rule coverage",
        "",
        "`Correct Blocks` and `False Blocks` use local target-fragment adjudication; cases where neither fragment uniquely occurs in the target remain unadjudicated.",
        "",
        "| Rule ID | Trigger Count | Correct Blocks | False Blocks | Precision | Decisions |",
        "|---|---:|---:|---:|---:|---|",
    ]
    for rule_id, row in result["rule_coverage"].items():
        precision = "n/a" if row["precision"] is None else f"{100 * row['precision']:.2f}%"
        decisions = ", ".join(f"{key}={value}" for key, value in row["decisions"].items())
        lines.append(
            f"| {rule_id} | {row['trigger_count']} | {row['correct_blocks']} | "
            f"{row['false_blocks']} | {precision} | {decisions} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("predictions", type=Path, help="JSONL predictions or saved eval transcript")
    parser.add_argument("--system", choices=("all", "model", "rules", "hybrid"), default="all")
    parser.add_argument("--json-output", type=Path)
    parser.add_argument("--markdown-output", type=Path)
    args = parser.parse_args()

    result = evaluate(load_examples(args.predictions))
    if args.system != "all":
        key = {"model": "model_only", "rules": "rules_only", "hybrid": "hybrid"}[args.system]
        result = {"systems": {key: result["systems"][key]}, **{
            name: result[name] for name in ("validator_decisions", "rule_coverage")
        }}
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(rendered + "\n", encoding="utf-8")
    if args.markdown_output:
        if args.system != "all":
            raise SystemExit("--markdown-output requires --system all")
        args.markdown_output.parent.mkdir(parents=True, exist_ok=True)
        args.markdown_output.write_text(markdown_report(result, args.predictions), encoding="utf-8")


if __name__ == "__main__":
    main()
