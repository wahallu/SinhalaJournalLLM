"""
Run the labelled sports-relevance fixture through the live classifier.

Usage (from apps/backend-api, with GROQ_API_KEY or OPENROUTER_API_KEY set):
    python scripts/evaluate_sports_classifier.py

Reports each sample's expected vs actual label, then the false positives
(non-sports let through as SPORTS_RELATED) and false negatives (sports articles
blocked as NOT_SPORTS_RELATED) that matter for the Sports style gate.
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.style.sports_classifier import classify_sports_relevance  # noqa: E402

FIXTURE = (
    Path(__file__).resolve().parents[2] / "web-app" / "src" / "lib" / "fixtures" / "sportsSamples.json"
)


async def main() -> int:
    samples = json.loads(FIXTURE.read_text(encoding="utf-8"))
    rows = []
    for s in samples:
        result = await classify_sports_relevance(s["text"])
        rows.append((s, result))
        mark = "ok " if result.label == s["expected"] else "MISS"
        print(f'{mark} {s["id"]:9} {s["language"]:5} expected={s["expected"]:19} actual={result.label:19} ({result.classifier})')

    unavailable = [s["id"] for s, r in rows if r.classifier == "unavailable"]
    fp = [s["id"] for s, r in rows if s["expected"] == "NOT_SPORTS_RELATED" and r.label == "SPORTS_RELATED"]
    fn = [s["id"] for s, r in rows if s["expected"] == "SPORTS_RELATED" and r.label == "NOT_SPORTS_RELATED"]
    held = [s["id"] for s, r in rows if s["expected"] == "NOT_SPORTS_RELATED" and r.label == "UNCERTAIN"]
    exact = sum(r.label == s["expected"] for s, r in rows)
    print(f"\nexact {exact}/{len(rows)}")
    print(f"false positives (non-sports passed): {fp or 'none'}")
    print(f"false negatives (sports blocked):    {fn or 'none'}")
    print(f"non-sports held as UNCERTAIN:        {held or 'none'}")
    print(f"classifier unavailable:              {unavailable or 'none'}")
    return 1 if fp or fn else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
