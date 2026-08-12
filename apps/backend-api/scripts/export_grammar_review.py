#!/usr/bin/env python3
"""Export SUGGEST/REJECT hybrid decisions for native-speaker review."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.grammar.rule_validator import SinhalaRuleValidator  # noqa: E402
from evaluate_grammar_hybrid import load_examples  # noqa: E402

FIELDS = (
    "id", "original", "model_candidate", "hybrid_output", "decision",
    "rule_ids", "reason", "category", "reviewer_decision",
    "reviewer_correction", "notes",
)


def rows(path: Path) -> list[dict[str, str]]:
    validator = SinhalaRuleValidator()
    out: list[dict[str, str]] = []
    for example in load_examples(path):
        result = validator.validate(example.input, example.model_output)
        for index, edit in enumerate(result.edits, 1):
            if edit.decision.value not in {"SUGGEST", "REJECT"}:
                continue
            out.append({
                "id": f"{example.id}:{index}",
                "original": example.input,
                "model_candidate": example.model_output,
                "hybrid_output": result.final_text,
                "decision": edit.decision.value,
                "rule_ids": "|".join(edit.rule_ids),
                "reason": edit.reason,
                "category": edit.category,
                "reviewer_decision": "",
                "reviewer_correction": "",
                "notes": "",
            })
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("predictions", type=Path)
    parser.add_argument("output", type=Path, help=".csv or .jsonl")
    args = parser.parse_args()
    output_rows = rows(args.predictions)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.suffix.lower() == ".csv":
        with args.output.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(output_rows)
    elif args.output.suffix.lower() == ".jsonl":
        args.output.write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in output_rows),
            encoding="utf-8",
        )
    else:
        raise SystemExit("Output must end in .csv or .jsonl")
    print(f"Exported {len(output_rows)} cases to {args.output}")


if __name__ == "__main__":
    main()
