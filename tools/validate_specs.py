#!/usr/bin/env python3
"""Validate every episode spec in the repository and fail if any reports warnings.

Wraps `run_studio.py validate` so the check is one command locally and in CI:

    python3 tools/validate_specs.py                     # template + all of examples/
    python3 tools/validate_specs.py --specs runtime/work/*.json  # specific files
    python3 tools/validate_specs.py --allow-warnings     # report only, never fail

Exit code 0 only when every spec parses, validates and reports `warnings: []`.
"""
from __future__ import annotations

import argparse
import glob
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / "universal_toolbook" / "run_studio.py"


def default_specs() -> list[Path]:
    specs = [ROOT / "universal_toolbook" / "templates" / "episode_minimal.json"]
    specs += sorted(Path(p) for p in glob.glob(str(ROOT / "examples" / "*.json")))
    return [s for s in specs if s.exists()]



# KI-018c: a beat is a pose somebody holds. Holding the SAME pose for a third of a minute is
# not a slow beat, it is a still image with a moving camera. `discipline-vs-obsession` holds
# `celebrate_arms_up` for 64.8 seconds. Measured on `the-first-plank`, the stretches that read
# as dead air are exactly the single-beat scenes: stage motion falls to 34% of the film median.
MAX_SINGLE_BEAT_SEC = 6.0
HOLD_ACTIONS = {
    "idle_stand", "sit_desk_slump", "sit_cafe_listen", "sit_bench", "sit_bed_edge",
    "cross_arms_skeptical", "head_in_hands", "listen_nod", "kneel_exhausted",
}


def motion_problems(spec: Path) -> list[str]:
    """Static-authoring defects a schema validator cannot see."""
    try:
        data = json.loads(spec.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    problems: list[str] = []
    for scene in data.get("scenes", []):
        sid = scene.get("id", "?")
        dur = float(scene.get("duration") or 0)
        for ch in scene.get("characters", []):
            beats = ch.get("beats") or []
            if not beats:
                continue
            if len(beats) == 1 and dur > MAX_SINGLE_BEAT_SEC:
                action = beats[0].get("action")
                hint = " (a hold action)" if action in HOLD_ACTIONS else ""
                problems.append(
                    f"{spec.name}:{sid} character '{ch.get('id')}' holds '{action}' for the "
                    f"whole {dur:.1f}s scene{hint} — beats longer than {MAX_SINGLE_BEAT_SEC:.0f}s "
                    "need at least one change of action, or the scene reads as a still")
            for beat in beats:
                end = float(beat.get("end") or 0)
                start = float(beat.get("start") or 0)
                if end - start > MAX_SINGLE_BEAT_SEC * 2 and beat.get("action") in HOLD_ACTIONS:
                    problems.append(
                        f"{spec.name}:{sid} character '{ch.get('id')}' holds '{beat.get('action')}' "
                        f"for {end - start:.1f}s — split it into two beats so something changes")
    return problems


def chapter_problems(spec: Path) -> list[str]:
    """`chapter` is a "Label | Title" string; an object silently renders as `[object Object]`.

    KI-021: the episode compiler stores `String(sc.chapter)` and the ribbon and the YouTube
    chapters file both print that value directly. An authored object therefore passed `validate`
    (which only counted it as present) and shipped `[object Object]` into a real render — as a
    burned-in title ribbon and as every line of the chapters file.
    """
    try:
        data = json.loads(spec.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    problems: list[str] = []
    for scene in data.get("scenes", []):
        if "chapter" not in scene or scene.get("chapter") in (None, ""):
            continue
        value = scene["chapter"]
        if not isinstance(value, str):
            problems.append(
                f"{spec.name}:{scene.get('id', '?')} `chapter` must be a string like "
                f"\"One | The Title\" — got {type(value).__name__}, which renders as "
                "[object Object] in the ribbon and the chapters file")
            continue
        if not value.strip():
            problems.append(f"{spec.name}:{scene.get('id', '?')} `chapter` is blank")
    return problems


def validate(spec: Path) -> tuple[bool, str]:
    proc = subprocess.run(
        [sys.executable, str(RUN), "validate", str(spec)],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0:
        return False, f"exit {proc.returncode}: {out.strip().splitlines()[-1] if out.strip() else 'no output'}"
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return False, "validate did not emit JSON"

    warnings = list(data.get("warnings") or []) + motion_problems(spec) + chapter_problems(spec)
    rel = spec.relative_to(ROOT) if spec.is_relative_to(ROOT) else spec
    line = (
        f"{str(rel):52s} {data.get('scene_count', '?'):>3} scenes  "
        f"{data.get('duration_sec', '?'):>8} s  warnings={len(warnings)}"
    )
    if warnings:
        detail = "; ".join(str(w) for w in warnings[:3])
        return False, f"{line}\n      -> {detail}"
    return True, line


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("specs", nargs="*", help="spec paths (default: template + examples/)")
    ap.add_argument("--allow-warnings", action="store_true")
    args = ap.parse_args()

    specs = [Path(s).resolve() for s in args.specs] if args.specs else default_specs()
    if not specs:
        print("no specs found", file=sys.stderr)
        return 1

    failures = 0
    print(f"validating {len(specs)} spec(s)\n")
    for spec in specs:
        ok, message = validate(spec)
        print(("  PASS  " if ok else "  FAIL  ") + message)
        if not ok:
            failures += 1

    print()
    if failures and not args.allow_warnings:
        print(f"FAILED: {failures} of {len(specs)} spec(s) did not validate cleanly")
        return 1
    print(f"OK: all {len(specs)} spec(s) validated, warnings: []")
    return 0


if __name__ == "__main__":
    sys.exit(main())
