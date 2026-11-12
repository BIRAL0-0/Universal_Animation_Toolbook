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
import re
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


def _verbalizer():
    """Load the verbalizer by path (the ``tts`` package pulls in numpy; this is pure text)."""
    import importlib.util

    path = ROOT / "universal_toolbook" / "tts" / "verbalize.py"
    if not path.exists():
        return None
    name = "_utb_verbalize_for_validate"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def register_problems(spec: Path) -> list[str]:
    """Keep the display and spoken registers of a dialogue line from diverging.

    A line may declare `spoken` (what the engine says) alongside `text` (what the subtitle
    shows). That split exists so a subtitle can keep the authored written form -- `254 days`
    -- while the audio says "two hundred and fifty four days". It must never let a film
    make two different claims, so:

    * `spoken` has to be a non-empty string when present.
    * if `spoken` is omitted, the engine verbalizes `text`; that is always safe.
    * if `spoken` is present and `text` is already fully spellable, an override that is not
      just the verbalization of `text` has rewritten the words rather than the
      pronunciation. That is a meaning change and belongs in the script, not here.
    """
    try:
        data = json.loads(spec.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    problems: list[str] = []
    vz = _verbalizer()

    def tokens(s: str) -> list[str]:
        return [w for w in re.findall(r"[a-z0-9']+", s.lower()) if w]

    for scene in data.get("scenes", []) or []:
        sid = scene.get("id", "?")
        for line in scene.get("dialogue") or []:
            if "spoken" not in line:
                continue
            text = str(line.get("text") or "")
            spoken = line.get("spoken")
            if not isinstance(spoken, str) or not spoken.strip():
                problems.append(
                    f"{spec.name}:{sid} `spoken` must be a non-empty string when present — "
                    f"got {type(spoken).__name__}; omit it to let the engine verbalize `text`"
                )
                continue
            if vz is None:
                continue
            expected = vz.verbalize(text).spoken
            if tokens(spoken) == tokens(expected):
                continue
            # The override says different words than the written line would produce.
            problems.append(
                f"{spec.name}:{sid} `spoken` says something different from `text`: "
                f"text={text!r} would be voiced {expected!r}, but `spoken` is {spoken!r}. "
                "`spoken` may only control pronunciation — change the words in `text` instead"
            )
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

    warnings = (
        list(data.get("warnings") or [])
        + motion_problems(spec)
        + chapter_problems(spec)
        + register_problems(spec)
    )
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
