#!/usr/bin/env python3
"""Replay the production grammar post-processing layers on Stage 6 v27 output.

The replay compares the saved adapter prediction, the backend validator output,
and the web app's optional Auto suggestion mode. It also carries forward the
frozen provisional alternative-acceptance audit, with explicit decisions for
every row changed by Auto mode.

Run with the backend virtual environment. No model or network call is made.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
RESEARCH_ROOT = BACKEND.parents[2]
SINAI_SCRIPTS = RESEARCH_ROOT / "SinAI-Training/work/sinllama/scripts"
for import_path in (BACKEND, SINAI_SCRIPTS):
    if str(import_path) not in sys.path:
        sys.path.insert(0, str(import_path))

from app.services.grammar import lexicon, sentence_final  # noqa: E402
from app.services.grammar.grammar_service import (  # noqa: E402
    _filter_unsafe_advisories,
    derive_corrections,
)
from app.services.grammar.rule_validator import SinhalaRuleValidator  # noqa: E402
from scripts.evaluate_grammar_hybrid import Example, Metrics  # noqa: E402
import audit_grammar_stage6_alternatives as raw_audit  # noqa: E402


# Provisional decisions for all 33 rows whose displayed text changes when the
# actual web Auto-mode overlap rules apply the backend spelling suggestions.
AUTO_REVIEW: dict[str, tuple[str, str]] = {
    "s6-0003": (
        raw_audit.DEFENSIBLE,
        "Auto also corrects නිර්දේෂය → නිර්දේශය; the single-edit gold is incomplete.",
    ),
    "s6-0004": (
        raw_audit.DEFENSIBLE,
        "Auto also corrects නිර්දේෂය → නිර්දේශය; the single-edit gold is incomplete.",
    ),
    "s6-0007": (
        raw_audit.PLAUSIBLE,
        "Auto corrects මීර්පුර් → මීර්පූර්, but the තරග/තරඟ variant still needs review.",
    ),
    "s6-0008": (
        raw_audit.PLAUSIBLE,
        "Auto corrects මීර්පුර් → මීර්පූර්, but the තරග/තරඟ variant still needs review.",
    ),
    "s6-0079": (
        raw_audit.CLEAR_FAILURE,
        "Auto changes the publication title සිරිකත → සිරිකොත.",
    ),
    "s6-0080": (
        raw_audit.CLEAR_FAILURE,
        "Auto changes the publication title සිරිකත → සිරිකොත.",
    ),
    "s6-0085": (
        raw_audit.CLEAR_FAILURE,
        "Auto incorrectly changes රූ රැජින → රු රැජින.",
    ),
    "s6-0086": (
        raw_audit.CLEAR_FAILURE,
        "Auto incorrectly changes රූ රැජින → රු රැජින.",
    ),
    "s6-0099": (
        raw_audit.DEFENSIBLE,
        "Auto restores බරපතළ while retaining the valid බවය → බවයි correction.",
    ),
    "s6-0115": (
        raw_audit.PLAUSIBLE,
        "Auto repairs අධික්ශණයෙන් → අධීක්ෂණයෙන්; තරග/තරඟ still needs review.",
    ),
    "s6-0116": (
        raw_audit.PLAUSIBLE,
        "Auto repairs අධික්ෂණයෙන් → අධීක්ෂණයෙන්; තරග/තරඟ still needs review.",
    ),
    "s6-0117": (
        raw_audit.PLAUSIBLE,
        "Auto repairs කන්ඩයම → කණ්ඩයම; තරග/තරඟ still needs review.",
    ),
    "s6-0135": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0145": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0151": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0155": (
        raw_audit.CLEAR_FAILURE,
        "Auto changes the correct නිසඟ form to නිසග.",
    ),
    "s6-0156": (
        raw_audit.CLEAR_FAILURE,
        "Auto changes correct වනාහී and නිසඟ forms away from the supplied gold.",
    ),
    "s6-0161": (
        raw_audit.DEFENSIBLE,
        "Auto corrects තිබූනි → තිබුණි; the supplied gold form තිබූණි is malformed.",
    ),
    "s6-0162": (
        raw_audit.DEFENSIBLE,
        "Auto corrects the malformed supplied-gold form තිබූණි → තිබුණි.",
    ),
    "s6-0166": (
        raw_audit.CLEAR_FAILURE,
        "Auto introduces පරික්ෂණවලදී.",
    ),
    "s6-0180": (
        raw_audit.CLEAR_FAILURE,
        "Auto changes the proper name රංජීත් → රංජිත් without adjudication.",
    ),
    "s6-0187": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0207": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0211": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0219": (
        raw_audit.DEFENSIBLE,
        "Auto corrects ස්ත්‍රි → ස්ත්‍රී; punctuation spacing is also normalized.",
    ),
    "s6-0239": (
        raw_audit.CLEAR_FAILURE,
        "Auto fixes සුරකිම but leaves සඳහා වන joined as සඳහාවන.",
    ),
    "s6-0241": (
        raw_audit.DEFENSIBLE,
        "Auto corrects හැරිමෙන් → හැරීමෙන් and normalizes punctuation spacing.",
    ),
    "s6-0247": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0256": (
        raw_audit.DEFENSIBLE,
        "Auto corrects the malformed supplied-gold form කණාටුව → කුණාටුව.",
    ),
    "s6-0259": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0261": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0269": (raw_audit.STRICT_EXACT, "Auto produces the supplied gold exactly."),
    "s6-0283": (
        raw_audit.PLAUSIBLE,
        "Auto corrects මීනි → මිනී, but the case-suffix spacing needs native review.",
    ),
}


CODE_EVIDENCE = (
    BACKEND / "app/services/grammar/rule_validator.py",
    BACKEND / "app/services/grammar/orthography.py",
    BACKEND / "app/services/grammar/lexicon.py",
    BACKEND / "app/services/grammar/sentence_final.py",
    BACKEND / "app/services/grammar/grammar_service.py",
    RESEARCH_ROOT / "SinhalaJournalLLM/apps/web-app/src/lib/suggestions.js",
    RESEARCH_ROOT / "SinhalaJournalLLM/apps/web-app/src/lib/suggestionMode.js",
)


@dataclass
class PipelineRow:
    example: Example
    model_output: str
    backend_output: str
    auto_output: str
    server_suggestions: list
    applied_suggestions: list
    audit_status: str
    audit_reason: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", required=True, type=Path)
    parser.add_argument("--gold", required=True, type=Path)
    parser.add_argument("--markdown-output", required=True, type=Path)
    return parser.parse_args()


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ui_auto_resolve(text: str, suggestions: list, corrections: list) -> tuple[str, list]:
    """Match suggestions.js: drop overlaps with model corrections, then apply."""

    claimed: list[tuple[int, int]] = []
    cursor = 0
    for correction in corrections:
        if correction.suspicious:
            raise ValueError(
                "Frozen Stage 6 replay unexpectedly produced a suspicious name edit; "
                "the UI name-rollback path needs an explicit audit"
            )
        term = correction.corrected
        if not term:
            continue
        position = text.find(term, cursor)
        if position < 0:
            continue
        claimed.append((position, position + len(term)))
        cursor = position + len(term)

    usable = []
    for suggestion in suggestions:
        start = suggestion.position
        end = start + len(suggestion.original)
        if text[start:end] != suggestion.original:
            continue
        if any(start < claim_end and claim_start < end for claim_start, claim_end in claimed):
            continue
        usable.append(suggestion)

    parts: list[str] = []
    cursor = 0
    applied = []
    for suggestion in sorted(usable, key=lambda item: item.position):
        if suggestion.position < cursor:
            continue
        parts.extend((text[cursor:suggestion.position], suggestion.suggestion))
        cursor = suggestion.position + len(suggestion.original)
        applied.append(suggestion)
    parts.append(text[cursor:])
    return "".join(parts), applied


def load_pipeline_rows(args: argparse.Namespace) -> list[PipelineRow]:
    raw_audit.validate_artifact_hashes(args.predictions, args.gold)
    gold_rows = raw_audit.load_jsonl(args.gold)
    prediction_rows = raw_audit.load_jsonl(args.predictions)
    predictions = {str(row["id"]): row for row in prediction_rows}
    raw_reviews = {
        row.row_id: row
        for row in raw_audit.audit_rows(gold_rows, prediction_rows)
    }

    validator = SinhalaRuleValidator()
    rows: list[PipelineRow] = []
    changed_ids: set[str] = set()
    for gold in gold_rows:
        row_id = str(gold["id"])
        example = Example(
            row_id,
            gold["input"],
            gold["output"],
            predictions[row_id]["prediction"],
        )
        validation = validator.validate(example.input, example.model_output)
        backend_output = validation.final_text
        corrections = derive_corrections(
            example.input,
            backend_output,
            validation_edits=validation.edits,
        )

        found = list(lexicon.check(backend_output, min_ratio=3))
        taken = {suggestion.position for suggestion in found}
        found.extend(
            suggestion
            for suggestion in sentence_final.check(backend_output, lexicon._lexicon())
            if suggestion.position not in taken
        )
        found = _filter_unsafe_advisories(found, backend_output)
        found.sort(key=lambda suggestion: suggestion.position)
        auto_output, applied = ui_auto_resolve(backend_output, found, corrections)

        if auto_output != backend_output:
            changed_ids.add(row_id)
            status, reason = AUTO_REVIEW[row_id]
        else:
            review = raw_reviews[row_id]
            status, reason = review.status, review.reason

        if (status == raw_audit.STRICT_EXACT) != (auto_output == example.target):
            raise ValueError(f"Strict-exact decision mismatch for {row_id}")
        rows.append(
            PipelineRow(
                example=example,
                model_output=example.model_output,
                backend_output=backend_output,
                auto_output=auto_output,
                server_suggestions=found,
                applied_suggestions=applied,
                audit_status=status,
                audit_reason=reason,
            )
        )

    if changed_ids != set(AUTO_REVIEW):
        raise ValueError(
            f"Auto-mode changed-row drift: missing decisions={sorted(changed_ids - set(AUTO_REVIEW))}, "
            f"stale decisions={sorted(set(AUTO_REVIEW) - changed_ids)}"
        )
    return rows


def metrics(rows: list[PipelineRow], field: str) -> tuple[Metrics, dict]:
    result = Metrics()
    for row in rows:
        result.add(row.example, getattr(row, field))
    return result, result.summary()


def pct(value: float) -> str:
    return f"{100 * value:.2f}%"


def suggestion_text(row: PipelineRow) -> str:
    return "; ".join(
        f"{item.original} → {item.suggestion}" for item in row.applied_suggestions
    )


def render_report(args: argparse.Namespace, rows: list[PipelineRow]) -> str:
    model_counts, model = metrics(rows, "model_output")
    backend_counts, backend = metrics(rows, "backend_output")
    auto_counts, auto = metrics(rows, "auto_output")
    audit_counts = Counter(row.audit_status for row in rows)
    conservative = audit_counts[raw_audit.STRICT_EXACT] + audit_counts[raw_audit.DEFENSIBLE]
    upper_bound = conservative + audit_counts[raw_audit.PLAUSIBLE]

    raw_reviews = raw_audit.audit_rows(
        raw_audit.load_jsonl(args.gold), raw_audit.load_jsonl(args.predictions)
    )
    raw_counts = Counter(row.status for row in raw_reviews)
    raw_conservative = raw_counts[raw_audit.STRICT_EXACT] + raw_counts[raw_audit.DEFENSIBLE]

    changed = [row for row in rows if row.auto_output != row.backend_output]
    gains = [
        row for row in changed
        if row.backend_output != row.example.target and row.auto_output == row.example.target
    ]
    losses = [
        row for row in changed
        if row.backend_output == row.example.target and row.auto_output != row.example.target
    ]
    server_suggestions = sum(len(row.server_suggestions) for row in rows)
    applied_suggestions = sum(len(row.applied_suggestions) for row in rows)
    backend_changed = sum(row.backend_output != row.model_output for row in rows)

    lines = [
        "# Stage 6 end-to-end grammar system evaluation",
        "",
        "> **Scope:** frozen SinLLaMA v27 predictions replayed through the current "
        "backend validator and the web app's optional Auto suggestion mode. No model "
        "or network request was made.",
        "",
        "## Recommended panel result",
        "",
        f"**End-to-end Auto-assist acceptable-output agreement: {conservative}/286 "
        f"({100 * conservative / 286:.2f}%).**",
        "",
        "This is a **provisional model-assisted acceptable-output metric**, not a "
        "human-adjudicated exact-match accuracy. It includes only strict matches and "
        "the defensible alternative corrections listed in the audits.",
        "",
        "Suggested wording:",
        "",
        f"> On the frozen unseen Stage 6 benchmark, the complete SinAI grammar "
        f"workflow in Auto-assist mode achieved **{100 * conservative / 286:.2f}% "
        "provisional acceptable-output agreement**. The deterministic Auto-assist "
        "layer raised "
        f"agreement from {100 * raw_conservative / 286:.2f}% for the adapter output "
        f"to {100 * conservative / 286:.2f}% end to end.",
        "",
        "## Strict automatic-gold comparison",
        "",
        "| System output | Overall exact | Change exact | Clean preserved | "
        "Over-correction | Edit F0.5 |",
        "|---|---:|---:|---:|---:|---:|",
        f"| Saved v27 adapter | {model_counts.exact}/286 ({pct(model['exact_match'])}) | "
        f"{pct(model['correction_needed_exact'])} | {pct(model['clean_preservation'])} | "
        f"{pct(model['overcorrection_rate'])} | {model['edit_f0.5']:.4f} |",
        f"| Backend validated | {backend_counts.exact}/286 ({pct(backend['exact_match'])}) | "
        f"{pct(backend['correction_needed_exact'])} | {pct(backend['clean_preservation'])} | "
        f"{pct(backend['overcorrection_rate'])} | {backend['edit_f0.5']:.4f} |",
        f"| Web Auto-assist | {auto_counts.exact}/286 ({pct(auto['exact_match'])}) | "
        f"{pct(auto['correction_needed_exact'])} | {pct(auto['clean_preservation'])} | "
        f"{pct(auto['overcorrection_rate'])} | {auto['edit_f0.5']:.4f} |",
        "",
        "## Acceptable-output audit comparison",
        "",
        "| System output | Strict | Defensible alternatives | Conservative agreement | "
        "Plausible review tier | Review-inclusive upper bound | Clear failures |",
        "|---|---:|---:|---:|---:|---:|---:|",
        f"| Saved v27 adapter | {raw_counts[raw_audit.STRICT_EXACT]} | "
        f"{raw_counts[raw_audit.DEFENSIBLE]} | **{raw_conservative}/286 "
        f"({100 * raw_conservative / 286:.2f}%)** | {raw_counts[raw_audit.PLAUSIBLE]} | "
        f"{286 - raw_counts[raw_audit.CLEAR_FAILURE]}/286 "
        f"({100 * (286 - raw_counts[raw_audit.CLEAR_FAILURE]) / 286:.2f}%) | "
        f"{raw_counts[raw_audit.CLEAR_FAILURE]} |",
        f"| End-to-end Auto-assist | {audit_counts[raw_audit.STRICT_EXACT]} | "
        f"{audit_counts[raw_audit.DEFENSIBLE]} | **{conservative}/286 "
        f"({100 * conservative / 286:.2f}%)** | {audit_counts[raw_audit.PLAUSIBLE]} | "
        f"{upper_bound}/286 ({100 * upper_bound / 286:.2f}%) | "
        f"{audit_counts[raw_audit.CLEAR_FAILURE]} |",
        "",
        "## What the code contributed",
        "",
        f"- Backend validator output differed from the saved adapter output on "
        f"**{backend_changed} rows**. On this Stage 6 artifact it classified edits "
        "but did not change the returned text because no edit received a hard rejection.",
        f"- The backend emitted **{server_suggestions}** spelling/final-form suggestions.",
        f"- The web overlap rule applied **{applied_suggestions} suggestions across "
        f"{len(changed)} rows** in optional Auto mode.",
        f"- Against strict automatic gold, Auto mode produced **{len(gains)} exact "
        f"gains and {len(losses)} exact losses**, a net gain of "
        f"**{auto_counts.exact - backend_counts.exact} rows**.",
        f"- Under the provisional acceptable-output audit, the code layer added "
        f"**{conservative - raw_conservative} net acceptable rows** (+"
        f"{100 * (conservative - raw_conservative) / 286:.2f} percentage points).",
        "- Lexicon suggestions are not part of the API's `corrected` field and are not "
        "applied in the web app's default Manual mode. The end-to-end figure therefore "
        "describes the explicit **Auto-assist configuration**.",
        "",
        "## Auto-mode changed rows",
        "",
        "| ID | Applied code suggestion(s) | Strict effect | Provisional audit | Reason |",
        "|---|---|---|---|---|",
    ]
    for row in changed:
        strict_effect = (
            "gain" if row in gains else "loss" if row in losses else "no exact change"
        )
        lines.append(
            f"| `{row.example.id}` | {suggestion_text(row)} | {strict_effect} | "
            f"{row.audit_status} | {row.audit_reason} |"
        )

    lines.extend(
        [
            "",
            "## Evidence hashes",
            "",
            f"- Predictions: `{file_hash(args.predictions)}`",
            f"- Gold: `{file_hash(args.gold)}`",
        ]
    )
    for path in CODE_EVIDENCE:
        lines.append(f"- `{path.relative_to(RESEARCH_ROOT)}`: `{file_hash(path)}`")

    lines.extend(
        [
            "",
            "## Reporting boundary",
            "",
            f"- The panel-facing result is **{100 * conservative / 286:.2f}% provisional "
            "end-to-end acceptable-output agreement** for Auto-assist mode.",
            "- Do not rename this value to exact-match accuracy or human accuracy.",
            f"- Do not present the {100 * upper_bound / 286:.2f}% review-inclusive upper "
            "bound as a measured result; it contains unresolved variants.",
            "- A final publication claim requires native Sinhala adjudication of the "
            "defensible and plausible rows.",
            "",
            "## Reproduction command",
            "",
            "Run from `SinhalaJournalLLM/apps/backend-api`:",
            "",
            "```bash",
            "PYTHONPATH=. .venv/bin/python scripts/evaluate_stage6_end_to_end.py \\",
            f"  --predictions {json.dumps(str(args.predictions))} \\",
            f"  --gold {json.dumps(str(args.gold))} \\",
            f"  --markdown-output {json.dumps(str(args.markdown_output))}",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    rows = load_pipeline_rows(args)
    args.markdown_output.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_output.write_text(render_report(args, rows), encoding="utf-8")
    counts = Counter(row.audit_status for row in rows)
    conservative = counts[raw_audit.STRICT_EXACT] + counts[raw_audit.DEFENSIBLE]
    print(f"End-to-end strict exact: {counts[raw_audit.STRICT_EXACT]}/286")
    print(f"End-to-end defensible alternatives: {counts[raw_audit.DEFENSIBLE]}")
    print(f"End-to-end conservative agreement: {conservative}/286")
    print(f"Report: {args.markdown_output}")


if __name__ == "__main__":
    main()
