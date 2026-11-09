#!/usr/bin/env python3
"""Render data tables into docs/production-workflow/TTS_VOICE_COMPARISON.md.

Fills three placeholders from real data (no hand-typed numbers):
  <!-- CATALOG_TABLE -->   the 44-voice catalog (from voices.json + installed voices)
  <!-- RESULTS_TABLE -->   kokoro benchmark runs (from results.json)
  <!-- PIPER_TABLE -->     piper benchmark runs (from results.json)

Usage:
    .venv/bin/python universal_toolbook/tools/tts_voice_report_tables.py \
        --results output/tts/benchmark2/results.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))


def catalog_table() -> str:
    from tts.config import load_config

    cfg = load_config()
    cat = cfg["engines"]["kokoro"].get("catalog", {})
    rows = []
    for name, meta in cat.items():
        if name.startswith("_"):
            continue
        rows.append(
            f"| `{name}` | {meta.get('set', '?')} | {meta.get('gender', '?')} "
            f"| {meta.get('style', '')} | {', '.join(meta.get('best_for', []))} |"
        )
    return (
        "| voice | set | gender | style (community description) | best-for (provisional) |\n"
        "| --- | --- | --- | --- | --- |\n" + "\n".join(rows)
    )


def results_table(runs: list[dict], engine: str) -> str:
    sel = [r for r in runs if r.get("engine") == engine and "error" not in r]
    rows = []
    for r in sel:
        rows.append(
            f"| {r['voice']} | {r['script']} | {r['audio_seconds']} | {r['rtf']} "
            f"| {r['words_per_min']} | {r['raw_peak']} | {r['raw_peak_dbfs']} "
            f"| {r['proc_rms_dbfs']} | {'yes' if r.get('limit_engaged') else '—'} |"
        )
    return (
        f"| {engine} voice | script | dur (s) | RTF | wpm | raw peak | raw peak dBFS "
        f"| proc RMS dBFS | limit engaged |\n"
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n" + "\n".join(rows)
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", required=True)
    ap.add_argument(
        "--doc",
        default=str(HERE.parent.parent / "docs" / "production-workflow" / "TTS_VOICE_COMPARISON.md"),
    )
    args = ap.parse_args()

    data = json.loads(Path(args.results).read_text(encoding="utf-8"))
    runs = data["runs"]
    doc = Path(args.doc).read_text(encoding="utf-8")

    doc = doc.replace("<!-- CATALOG_TABLE -->", catalog_table())
    doc = doc.replace("<!-- RESULTS_TABLE -->", results_table(runs, "kokoro"))
    doc = doc.replace("<!-- PIPER_TABLE -->", results_table(runs, "piper"))

    Path(args.doc).write_text(doc, encoding="utf-8")
    n_k = sum(1 for r in runs if r.get("engine") == "kokoro" and "error" not in r)
    n_p = sum(1 for r in runs if r.get("engine") == "piper" and "error" not in r)
    print(f"catalog: {catalog_table().count(chr(10)) - 2} voices; "
          f"kokoro runs: {n_k}; piper runs: {n_p} -> {args.doc}")


if __name__ == "__main__":
    main()
