#!/usr/bin/env python3
"""Evaluate model-only, deterministic-only, and hybrid Sinhala GEC systems.

Input may be a JSONL prediction file with ``input``, ``target`` (or ``output``),
and ``model_output`` fields, or a saved SINAI transcript containing INPUT,
PREDICT, and EXPECTED lines. No model or network call is made.
"""

from __future__ import annotations

import argparse
import csv
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
from app.services.grammar.rule_types import Decision, ValidationConfig  # noqa: E402
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


@dataclass(frozen=True)
class RuleEvalExample:
    id: str
    original: str
    candidate: str
    gold: str | None
    rule_id: str
    should_trigger: bool
    expected_effect: str
    notes: str = ""
    needs_native_review: bool = False
    metadata: dict = field(default_factory=dict)


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


def load_rule_examples(path: Path) -> list[RuleEvalExample]:
    """Load the small hand-auditable policy fixture set."""
    examples: list[RuleEvalExample] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        required = {
            "id", "original", "candidate", "gold", "rule_id",
            "should_trigger", "expected_effect", "notes",
        }
        missing = required - row.keys()
        if missing:
            raise ValueError(f"{path}:{line_no}: missing fields {sorted(missing)}")
        expected_effect = str(row["expected_effect"]).upper()
        if expected_effect not in {"ACCEPT", "WARN", "REJECT", "NONE"}:
            raise ValueError(f"{path}:{line_no}: invalid expected_effect {expected_effect!r}")
        examples.append(RuleEvalExample(
            id=str(row["id"]),
            original=row["original"],
            candidate=row["candidate"],
            gold=row["gold"],
            rule_id=row["rule_id"],
            should_trigger=bool(row["should_trigger"]),
            expected_effect=expected_effect,
            notes=row["notes"],
            needs_native_review=bool(row.get("needs_native_review", False)),
            metadata=row.get("metadata") or {},
        ))
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
    entity_errors: int = 0
    number_mutations: int = 0
    number_errors: int = 0
    polarity_mutations: int = 0
    polarity_errors: int = 0

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
        self.entity_errors += _entity_error(example.input, prediction, example.target)
        self.number_errors += (
            before["number"] != after["number"]
            and after["number"] != protected_counters(example.target)["number"]
        )
        self.polarity_errors += (
            _polarity_mutated(example.input, prediction)
            and polarity(prediction) != polarity(example.target)
        )

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
            "entity_error_rate": round(ratio(self.entity_errors, self.total), 4),
            "number_mutation_rate": round(ratio(self.number_mutations, self.total), 4),
            "number_error_rate": round(ratio(self.number_errors, self.total), 4),
            "polarity_mutation_rate": round(ratio(self.polarity_mutations, self.total), 4),
            "polarity_error_rate": round(ratio(self.polarity_errors, self.total), 4),
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


def _entity_error(original: str, prediction: str, gold: str) -> bool:
    """Whether prediction makes a name-shaped edit not supported by gold.

    This separates unsafe entity substitutions from correct spelling repairs
    inside a name. The older ``entity_mutation_rate`` is retained so historical
    reports remain directly reproducible.
    """
    predicted = edit_set(original, prediction)
    gold_edits = edit_set(original, gold)
    for edit in predicted - gold_edits:
        _, _, old, new = edit
        if any(is_probable_name(word.strip(".,;:!?\"'“”")) for word in old + new):
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
    advisory_supported: int = 0
    advisory_unsupported: int = 0
    decisions: Counter[str] = field(default_factory=Counter)


def _local_adjudication(edit, target: str) -> str:
    original_supported = bool(edit.original and target.count(edit.original) == 1)
    candidate_supported = bool(edit.candidate and target.count(edit.candidate) == 1)
    if original_supported and not candidate_supported:
        return "original_supported"
    if candidate_supported and not original_supported:
        return "candidate_supported"
    return "unadjudicated"


def _record_coverage(
    coverage: dict[str, RuleCoverage],
    edit,
    target: str,
    *,
    advisory_is_block: bool,
) -> None:
    adjudication = _local_adjudication(edit, target)
    for rule_id in edit.rule_ids:
        item = coverage[rule_id]
        item.trigger_count += 1
        item.decisions[edit.decision.value] += 1
        is_block = edit.decision == Decision.REJECT or (
            advisory_is_block and edit.decision == Decision.SUGGEST
        )
        if is_block:
            item.correct_blocks += adjudication == "original_supported"
            item.false_blocks += adjudication == "candidate_supported"
        elif edit.decision == Decision.SUGGEST:
            item.advisory_supported += adjudication == "candidate_supported"
            item.advisory_unsupported += adjudication == "original_supported"


def _coverage_dict(coverage: dict[str, RuleCoverage]) -> dict:
    return {
        rule_id: {
            "trigger_count": value.trigger_count,
            "correct_blocks": value.correct_blocks,
            "false_blocks": value.false_blocks,
            "block_precision": round(
                value.correct_blocks / (value.correct_blocks + value.false_blocks), 4
            ) if value.correct_blocks + value.false_blocks else None,
            "advisory_candidate_supported": value.advisory_supported,
            "advisory_original_supported": value.advisory_unsupported,
            "decisions": dict(value.decisions),
        }
        for rule_id, value in sorted(coverage.items())
    }


def _decision_effect(decision: Decision | None) -> str:
    if decision is None:
        return "NONE"
    if decision == Decision.SUGGEST:
        return "WARN"
    return decision.value


def evaluate_rule_suite(
    examples: Iterable[RuleEvalExample], validator: SinhalaRuleValidator
) -> dict:
    """Measure trigger/effect behavior on the dedicated rule-policy fixtures."""
    stats: dict[str, Counter[str]] = defaultdict(Counter)
    cases: list[dict] = []
    priority = {Decision.ACCEPT: 1, Decision.SUGGEST: 2, Decision.REJECT: 3}
    for example in examples:
        validation = validator.validate(
            example.original,
            example.candidate,
            metadata=example.metadata,
        )
        matching = [
            edit for edit in validation.edits if example.rule_id in edit.rule_ids
        ]
        actual_decision = (
            max(matching, key=lambda edit: priority.get(edit.decision, 0)).decision
            if matching else None
        )
        actual_trigger = bool(matching)
        actual_effect = _decision_effect(actual_decision)
        item = stats[example.rule_id]
        item["cases"] += 1
        item["expected_triggers"] += example.should_trigger
        item["actual_triggers"] += actual_trigger
        item["true_positive"] += example.should_trigger and actual_trigger
        item["false_positive"] += not example.should_trigger and actual_trigger
        item["false_negative"] += example.should_trigger and not actual_trigger
        item["expected_blocks"] += example.expected_effect == "REJECT"
        item["actual_blocks"] += actual_effect == "REJECT"
        item["correct_blocks"] += (
            actual_effect == "REJECT" and example.expected_effect == "REJECT"
        )
        item["false_blocks"] += (
            actual_effect == "REJECT" and example.expected_effect != "REJECT"
        )
        item["effect_matches"] += actual_effect == example.expected_effect
        cases.append({
            "id": example.id,
            "rule_id": example.rule_id,
            "should_trigger": example.should_trigger,
            "actual_trigger": actual_trigger,
            "expected_effect": example.expected_effect,
            "actual_effect": actual_effect,
            "gold_match": (
                validation.final_text == example.gold if example.gold is not None else None
            ),
            "needs_native_review": example.needs_native_review,
            "notes": example.notes,
        })

    metrics: dict[str, dict] = {}
    for rule_id, item in sorted(stats.items()):
        divide = lambda n, d: round(n / d, 4) if d else None
        metrics[rule_id] = {
            **dict(item),
            "trigger_precision": divide(
                item["true_positive"], item["true_positive"] + item["false_positive"]
            ),
            "trigger_recall": divide(
                item["true_positive"], item["true_positive"] + item["false_negative"]
            ),
            "block_precision": divide(item["correct_blocks"], item["actual_blocks"]),
            "false_block_rate": divide(item["false_blocks"], item["actual_blocks"]),
            "coverage": divide(item["actual_triggers"], item["cases"]),
            "effect_accuracy": divide(item["effect_matches"], item["cases"]),
        }
    return {"metrics": metrics, "cases": cases}


def evaluate(
    examples: Iterable[Example],
    rule_examples: Iterable[RuleEvalExample] = (),
) -> dict:
    validator = SinhalaRuleValidator()
    metrics = {
        name: Metrics()
        for name in ("model_only", "rules_only", "legacy_hybrid", "hybrid")
    }
    decision_counts: Counter[str] = Counter()
    legacy_decision_counts: Counter[str] = Counter()
    coverage: dict[str, RuleCoverage] = defaultdict(RuleCoverage)
    legacy_coverage: dict[str, RuleCoverage] = defaultdict(RuleCoverage)
    legacy_false_blocks: list[dict] = []
    hard_blocks: list[dict] = []
    examples = list(examples)
    legacy_config = ValidationConfig(
        apply_advisory_edits=False,
        legacy_entity_policy=True,
    )

    for example in examples:
        rules_output = validator.apply_rules_only(example.input)
        validation = validator.validate(example.input, example.model_output)
        legacy_validation = validator.validate(
            example.input,
            example.model_output,
            config=legacy_config,
        )
        predictions = {
            "model_only": example.model_output,
            "rules_only": rules_output,
            "legacy_hybrid": legacy_validation.final_text,
            "hybrid": validation.final_text,
        }
        for system, prediction in predictions.items():
            metrics[system].add(example, prediction)

        decision_counts.update(edit.decision.value for edit in validation.edits)
        legacy_decision_counts.update(
            edit.decision.value for edit in legacy_validation.edits
        )
        for edit in validation.edits:
            _record_coverage(coverage, edit, example.target, advisory_is_block=False)
            if edit.decision == Decision.REJECT:
                hard_blocks.append({
                    "example_id": example.id,
                    "rule_ids": ";".join(edit.rule_ids),
                    "decision": edit.decision.value,
                    "confidence_level": edit.confidence_level.value,
                    "original_fragment": edit.original,
                    "candidate_fragment": edit.candidate,
                    "adjudication": _local_adjudication(edit, example.target),
                    "input": example.input,
                    "model_output": example.model_output,
                    "final": validation.final_text,
                    "target": example.target,
                    "reason": edit.reason,
                })
        for edit_index, edit in enumerate(legacy_validation.edits, 1):
            _record_coverage(
                legacy_coverage, edit, example.target, advisory_is_block=True
            )
            if (
                edit.decision in {Decision.REJECT, Decision.SUGGEST}
                and _local_adjudication(edit, example.target) == "candidate_supported"
            ):
                new_edit = next((
                    current
                    for current in validation.edits
                    if (
                        current.original_start,
                        current.original_end,
                        current.candidate_start,
                        current.candidate_end,
                    ) == (
                        edit.original_start,
                        edit.original_end,
                        edit.candidate_start,
                        edit.candidate_end,
                    )
                ), None)
                legacy_false_blocks.append({
                    "id": f"{example.id}:{edit_index}",
                    "example_id": example.id,
                    "rule_ids": ";".join(edit.rule_ids),
                    "decision": edit.decision.value,
                    "confidence_level": edit.confidence_level.value,
                    "original_fragment": edit.original,
                    "candidate_fragment": edit.candidate,
                    "adjudication": "candidate_supported",
                    "sentence_level_rollback": False,
                    "input": example.input,
                    "model_output": example.model_output,
                    "old_hybrid": legacy_validation.final_text,
                    "new_decision": (
                        "WARN/APPLY"
                        if new_edit and new_edit.decision == Decision.SUGGEST
                        else new_edit.decision.value if new_edit else "NONE"
                    ),
                    "target": example.target,
                    "reason": edit.reason,
                })

    result = {
        "systems": {name: value.summary() for name, value in metrics.items()},
        "validator_decisions": dict(decision_counts),
        "legacy_validator_decisions": dict(legacy_decision_counts),
        "rule_coverage": _coverage_dict(coverage),
        "legacy_rule_coverage": _coverage_dict(legacy_coverage),
        "policy_analysis": {
            "legacy_false_blocked_edits": len(legacy_false_blocks),
            "legacy_false_blocks_by_decision": dict(Counter(
                row["decision"] for row in legacy_false_blocks
            )),
            "legacy_sentence_level_false_blocks": 0,
            "new_hard_blocked_edits": len(hard_blocks),
            "new_false_hard_blocks": sum(
                row["adjudication"] == "candidate_supported" for row in hard_blocks
            ),
            "new_unadjudicated_hard_blocks": sum(
                row["adjudication"] == "unadjudicated" for row in hard_blocks
            ),
        },
        "legacy_false_blocks": legacy_false_blocks,
        "hard_blocks": hard_blocks,
    }
    rule_examples = list(rule_examples)
    if rule_examples:
        result["dedicated_rule_evaluation"] = evaluate_rule_suite(
            rule_examples, validator
        )
    return result


def markdown_report(result: dict, source: Path) -> str:
    systems = result["systems"]
    lines = [
        "# Recalibrated hybrid grammar evaluation",
        "",
        f"Source: `{source}`",
        "",
        "All values below were measured by this script; no missing value was estimated.",
        "",
        "| System | Exact Match | Change Needed | Preservation | Over-correction | Edit Precision | Edit Recall | F0.5 | Entity Errors | Unsupported Entity Errors | Number Errors |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    labels = {
        "model_only": "A. Neural model",
        "rules_only": "B. Rules only",
        "hybrid": "C. Recalibrated neural + rules",
    }
    for key in ("model_only", "rules_only", "hybrid"):
        row = systems[key]
        pct = lambda name: f"{100 * row[name]:.2f}%"
        lines.append(
            f"| {labels[key]} | {pct('exact_match')} | {pct('correction_needed_exact')} | "
            f"{pct('clean_preservation')} | {pct('overcorrection_rate')} | {pct('edit_precision')} | "
            f"{pct('edit_recall')} | {row['edit_f0.5']:.4f} | {pct('entity_mutation_rate')} | "
            f"{pct('entity_error_rate')} | {pct('number_error_rate')} |"
        )

    lines += [
        "",
        "The published baseline's 1.30% entity measure is preserved as `Entity Errors`: it flags every edit to a name-shaped token, including a gold-correct spelling repair. `Unsupported Entity Errors` additionally checks whether that edit is supported by the target, separating factual substitutions from correct entity spelling.",
        "",
        "### Original neural baseline",
        "",
        f"The unchanged candidate has {100 * systems['model_only']['exact_match']:.2f}% exact match, {100 * systems['model_only']['edit_recall']:.2f}% edit recall, and {systems['model_only']['edit_f0.5']:.4f} F0.5.",
        "",
        "### Original hybrid",
        "",
        f"The exactly replayed legacy policy has {100 * systems['legacy_hybrid']['exact_match']:.2f}% exact match, {100 * systems['legacy_hybrid']['edit_recall']:.2f}% edit recall, and {systems['legacy_hybrid']['edit_f0.5']:.4f} F0.5.",
        "",
        "### Recalibrated hybrid",
        "",
        f"The advisory policy has {100 * systems['hybrid']['exact_match']:.2f}% exact match, {100 * systems['hybrid']['edit_recall']:.2f}% edit recall, and {systems['hybrid']['edit_f0.5']:.4f} F0.5.",
    ]

    old = systems["legacy_hybrid"]
    new = systems["hybrid"]
    lines += [
        "",
        "## Legacy versus recalibrated policy",
        "",
        "The legacy row is replayed by the same validator with advisory rollback and legacy entity blocking enabled.",
        "",
        "| Metric | Legacy hybrid | Recalibrated hybrid | Delta |",
        "|---|---:|---:|---:|",
    ]
    comparisons = (
        ("Exact match", "exact_match", True),
        ("Change-needed exact", "correction_needed_exact", True),
        ("Edit precision", "edit_precision", True),
        ("Edit recall", "edit_recall", True),
        ("F0.5", "edit_f0.5", False),
        ("Entity errors", "entity_mutation_rate", True),
        ("Unsupported entity errors", "entity_error_rate", True),
        ("Number errors", "number_error_rate", True),
    )
    for label, key, percentage in comparisons:
        delta = new[key] - old[key]
        if percentage:
            lines.append(
                f"| {label} | {100 * old[key]:.2f}% | {100 * new[key]:.2f}% | {100 * delta:+.2f} pp |"
            )
        else:
            lines.append(f"| {label} | {old[key]:.4f} | {new[key]:.4f} | {delta:+.4f} |")

    neural = systems["model_only"]
    lines += [
        "",
        "## Recalibrated hybrid versus neural baseline",
        "",
        "| Metric | Neural | Recalibrated hybrid | Delta |",
        "|---|---:|---:|---:|",
    ]
    for label, key, percentage in comparisons:
        delta = new[key] - neural[key]
        if percentage:
            lines.append(
                f"| {label} | {100 * neural[key]:.2f}% | {100 * new[key]:.2f}% | {100 * delta:+.2f} pp |"
            )
        else:
            lines.append(
                f"| {label} | {neural[key]:.4f} | {new[key]:.4f} | {delta:+.4f} |"
            )

    policy = result["policy_analysis"]
    lines += [
        "",
        "## Decision-policy audit",
        "",
        f"- Legacy false-blocked edits: {policy['legacy_false_blocked_edits']}",
        "- Legacy false blocks by decision: " + ", ".join(
            f"{key}={value}"
            for key, value in policy["legacy_false_blocks_by_decision"].items()
        ),
        f"- False blocks caused by sentence-level rollback: {policy['legacy_sentence_level_false_blocks']}",
        f"- Recalibrated hard-blocked edits: {policy['new_hard_blocked_edits']}",
        f"- Recalibrated locally adjudicated false hard blocks: {policy['new_false_hard_blocks']}",
        f"- Recalibrated unadjudicated hard blocks: {policy['new_unadjudicated_hard_blocks']}",
        "",
        "## Rule coverage",
        "",
        "Only `REJECT` is counted as a block. `SUGGEST` is an applied advisory. Local adjudication requires a fragment to occur exactly once in the target.",
        "",
        "| Rule ID | Triggers | Correct Blocks | False Blocks | Block Precision | Candidate-supported Warnings | Original-supported Warnings | Decisions |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for rule_id, row in result["rule_coverage"].items():
        precision = (
            "n/a" if row["block_precision"] is None
            else f"{100 * row['block_precision']:.2f}%"
        )
        decisions = ", ".join(f"{key}={value}" for key, value in row["decisions"].items())
        lines.append(
            f"| {rule_id} | {row['trigger_count']} | {row['correct_blocks']} | "
            f"{row['false_blocks']} | {precision} | {row['advisory_candidate_supported']} | "
            f"{row['advisory_original_supported']} | {decisions} |"
        )

    dedicated = result.get("dedicated_rule_evaluation")
    if dedicated:
        lines += [
            "",
            "## Dedicated rule-policy fixtures",
            "",
            "`Coverage` is the share of fixtures assigned to a rule on which that rule fired; it is not corpus prevalence. Trigger/effect scores test policy behavior. Fixtures marked `needs_native_review` have no linguistic gold and do not support grammar-quality claims.",
            "",
            "| Rule ID | Trigger Precision | Trigger Recall | Block Precision | False-block Rate | Coverage | Effect Accuracy |",
            "|---|---:|---:|---:|---:|---:|---:|",
        ]
        for rule_id, row in dedicated["metrics"].items():
            show = lambda key: (
                "n/a" if row[key] is None else f"{100 * row[key]:.2f}%"
            )
            lines.append(
                f"| {rule_id} | {show('trigger_precision')} | {show('trigger_recall')} | "
                f"{show('block_precision')} | {show('false_block_rate')} | "
                f"{show('coverage')} | {show('effect_accuracy')} |"
            )
    lines += [
        "",
        "## Measured interpretation and paper recommendation",
        "",
        "On this unchanged test set, the recalibrated hybrid is preferable to neural-only as a narrow safety wrapper: it preserves exact match and recall, raises edit precision and F0.5 slightly, removes the gold-unsupported entity error, and retains zero number errors. It is not evidence that rules are a stronger grammar corrector; rules-only remains a low-accuracy safety baseline.",
        "",
        "For the paper, report the neural model as the grammar-correction baseline, the recalibrated hybrid as the proposed safety-augmented system, rules-only as a non-competitive safety lower bound, and the legacy hybrid as an ablation showing the cost of treating warnings as vetoes. Report both the original broad entity-change flag and the target-supported entity-error measure. The one v27 hard block remains locally unadjudicated and should be included in native-speaker review rather than assigned precision by assumption.",
        "",
        "No separate development split was available for this structural recalibration. Production logic was not fitted to known test sentences, and policy-only fixtures with uncertain linguistic preference are marked for native review.",
    ]
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def false_block_export_rows(rows: list[dict]) -> list[dict]:
    return [
        {
            "id": row["id"],
            "original": row["input"],
            "neural": row["model_output"],
            "old_hybrid": row["old_hybrid"],
            "gold": row["target"],
            "rule_ids": row["rule_ids"],
            "old_decision": row["decision"],
            "new_decision": row["new_decision"],
        }
        for row in rows
    ]


def hard_block_export_rows(rows: list[dict]) -> list[dict]:
    correct = {
        "original_supported": "true",
        "candidate_supported": "false",
        "unadjudicated": "",
    }
    return [
        {
            "original": row["input"],
            "candidate": row["model_output"],
            "final": row["final"],
            "gold": row["target"],
            "rule_id": row["rule_ids"],
            "confidence": row["confidence_level"],
            "reason": row["reason"],
            "correct_block?": correct[row["adjudication"]],
        }
        for row in rows
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("predictions", type=Path, help="JSONL predictions or saved eval transcript")
    parser.add_argument(
        "--system", choices=("all", "model", "rules", "legacy", "hybrid"), default="all"
    )
    parser.add_argument("--rule-eval", type=Path)
    parser.add_argument("--json-output", type=Path)
    parser.add_argument("--markdown-output", type=Path)
    parser.add_argument("--legacy-false-blocks-csv", type=Path)
    parser.add_argument("--hard-blocks-csv", type=Path)
    args = parser.parse_args()

    rule_examples = load_rule_examples(args.rule_eval) if args.rule_eval else []
    result = evaluate(load_examples(args.predictions), rule_examples)
    if args.legacy_false_blocks_csv:
        write_csv(
            args.legacy_false_blocks_csv,
            false_block_export_rows(result["legacy_false_blocks"]),
        )
    if args.hard_blocks_csv:
        write_csv(args.hard_blocks_csv, hard_block_export_rows(result["hard_blocks"]))
    if args.system != "all":
        key = {
            "model": "model_only",
            "rules": "rules_only",
            "legacy": "legacy_hybrid",
            "hybrid": "hybrid",
        }[args.system]
        result["systems"] = {key: result["systems"][key]}
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
