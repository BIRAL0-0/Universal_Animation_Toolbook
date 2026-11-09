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

    warnings = data.get("warnings") or []
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
