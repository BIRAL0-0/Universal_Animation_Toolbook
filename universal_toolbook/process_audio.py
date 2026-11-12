#!/usr/bin/env python3
"""Reusable audio processing: resample, loudness normalize, peak limit.

Processes WAV files (a single file or a whole directory) WITHOUT touching the
originals: each input ``x.wav`` becomes ``x_processed.wav`` next to it (or in
``--out``). Prints a JSON analysis report for every processed file.

Examples:
    python3 universal_toolbook/process_audio.py runtime/renders/tts/my_video/final/seg-000.wav
    python3 universal_toolbook/process_audio.py runtime/renders/tts/my_video/segments/ --out runtime/renders/tts/my_video/final/
    python3 universal_toolbook/process_audio.py foo.wav --resample-rate 48000 --no-rms
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tts import audio as A  # noqa: E402
from tts.config import load_config  # noqa: E402


def main() -> None:
    cfg_proc = load_config().get("processing", {})
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="WAV file or directory of WAV files")
    ap.add_argument("--out", default=None, help="output dir (default: next to input)")
    ap.add_argument("--resample-rate", type=int, default=None)
    ap.add_argument("--normalize-peak", type=float, default=None, help="target peak dBFS")
    ap.add_argument("--normalize-rms", type=float, default=None, help="target RMS dBFS")
    ap.add_argument("--limit", type=float, default=None, help="soft-limit threshold dBFS")
    ap.add_argument("--no-resample", action="store_true")
    ap.add_argument("--no-peak", action="store_true")
    ap.add_argument("--no-rms", action="store_true")
    ap.add_argument("--no-limit", action="store_true")
    args = ap.parse_args()

    resample_rate = None if args.no_resample else (args.resample_rate or cfg_proc.get("resample_rate"))
    n_peak = None if args.no_peak else (args.normalize_peak if args.normalize_peak is not None else cfg_proc.get("normalize_peak_dbfs"))
    n_rms = None if args.no_rms else (args.normalize_rms if args.normalize_rms is not None else cfg_proc.get("normalize_rms_dbfs"))
    limit = None if args.no_limit else (args.limit if args.limit is not None else cfg_proc.get("limit_dbfs"))

    p = Path(args.input).expanduser()
    files = sorted(p.glob("*.wav")) if p.is_dir() else [p]
    if not files:
        print(f"ERROR: no .wav files found in {p}", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.out).expanduser() if args.out else None
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    report = []
    for f in files:
        if out_dir:
            dst = out_dir / f"{f.stem}_processed.wav"
        else:
            dst = f.with_name(f"{f.stem}_processed.wav")
        try:
            an, steps = A.process_audio(
                f, dst,
                resample_rate=resample_rate,
                normalize_peak_dbfs=n_peak,
                normalize_rms_dbfs=n_rms,
                limit_dbfs=limit,
            )
            entry = {"input": str(f), "output": str(dst), "applied": steps,
                     "report": an.to_dict()}
            status = "ok" if an.ok else "issues"
            print(f"[{status}] {f.name} -> {dst.name}  "
                  f"peak {an.peak_dbfs:.1f} dBFS / rms {an.rms_dbfs:.1f} dBFS / "
                  f"{an.duration_s:.2f}s @ {an.sample_rate}Hz")
            report.append(entry)
        except Exception as e:
            print(f"[FAIL] {f.name}: {e}", file=sys.stderr)
            report.append({"input": str(f), "error": str(e)})

    out_json = (out_dir or p if p.is_dir() else p.parent) / "process_report.json"
    if out_dir or p.is_dir():
        out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nreport: {out_json}")
    bad = [r for r in report if "error" in r or r.get("report", {}).get("ok") is False]
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
