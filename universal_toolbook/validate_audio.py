#!/usr/bin/env python3
"""Validate TTS audio: corruption, silence, clipping, duration, ordering.

Accepts a WAV file, a directory of WAVs, or a job directory containing a
manifest.json (in which case segment durations are checked against the
manifest and segment ordering/coverage is verified).

Exit codes: 0 all good, 1 problems found.

Examples:
    python3 universal_toolbook/validate_audio.py output/tts/my_video/
    python3 universal_toolbook/validate_audio.py some.wav --max-silence 1.5
    python3 universal_toolbook/validate_audio.py output/tts/my_video/final/full.wav
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tts import audio as A  # noqa: E402
from tts.manifest import load_manifest  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="WAV file, directory, or job dir with manifest.json")
    ap.add_argument("--max-silence", type=float, default=1.5,
                    help="flag files whose longest silence exceeds this (seconds)")
    ap.add_argument("--max-leading-silence", type=float, default=0.5)
    ap.add_argument("--max-trailing-silence", type=float, default=1.0)
    ap.add_argument("--json", action="store_true", help="print JSON report")
    args = ap.parse_args()

    t = Path(args.target).expanduser()
    manifest = load_manifest(t) if (t / "manifest.json").exists() else None
    results = []
    problems = 0

    def check(path: Path, expected_dur: float | None = None) -> None:
        nonlocal problems
        a = A.analyze(path)
        issues = list(a.errors)
        if a.ok and a.longest_internal_silence_s > args.max_silence:
            issues.append(f"long internal silence: {a.longest_internal_silence_s:.2f}s > {args.max_silence}s")
        if a.ok and a.leading_silence_s > args.max_leading_silence:
            issues.append(f"long leading silence: {a.leading_silence_s:.2f}s")
        if a.ok and a.trailing_silence_s > args.max_trailing_silence:
            issues.append(f"long trailing silence: {a.trailing_silence_s:.2f}s")
        if expected_dur is not None and abs(a.duration_s - expected_dur) > max(0.35, 0.15 * expected_dur):
            issues.append(f"duration {a.duration_s:.2f}s != expected {expected_dur:.2f}s")
        row = {"file": str(path), "ok": not issues, **a.to_dict(), "issues": issues}
        results.append(row)
        if issues:
            problems += 1
            print(f"[FAIL] {path.name}: {'; '.join(issues)}")
        else:
            print(f"[ ok ] {path.name}: {a.duration_s:.2f}s  peak {a.peak_dbfs:.1f}  rms {a.rms_dbfs:.1f}  "
                  f"@ {a.sample_rate}Hz/{a.channels}ch")

    if t.is_file():
        check(t)
    elif manifest is not None:
        for s in manifest.segments:
            if s.status == "ok" and s.audio_file:
                check(t / s.audio_file, expected_dur=s.duration_seconds or None)
        if manifest.final.get("wav"):
            check(t / manifest.final["wav"])
        # ordering + coverage
        ids = [s.segment_id for s in manifest.segments]
        expect = [f"seg-{i:03d}" for i in range(len(ids))]
        if ids != expect:
            problems += 1
            results.append({"file": "manifest", "ok": False,
                            "issues": [f"segment ordering/coverage broken: {ids}"]})
        n_ok = sum(1 for s in manifest.segments if s.status == "ok")
        n_failed = sum(1 for s in manifest.segments if s.status == "failed")
        print(f"\nmanifest {manifest.job_id}: {n_ok} ok, {n_failed} failed, "
              f"final={manifest.final.get('wav', '-')}")
    elif t.is_dir():
        for f in sorted(t.glob("*.wav")):
            check(f)
    else:
        print(f"ERROR: {t} not found", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(results, indent=2))
    verdict = "PASS" if problems == 0 else f"FAIL ({problems} problem(s))"
    print(f"\n{verdict}")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
