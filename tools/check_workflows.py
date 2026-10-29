#!/usr/bin/env python3
"""
Lint the GitHub Actions workflows in this repository.

A single unquoted `name: value` inside a plain `run:` scalar makes the whole file invalid YAML,
and GitHub then fails the run in 0 s with "This run likely failed because of a workflow file
issue" — no log, no failing step. That is invisible until you actually push, so it is checked
here: every workflow must parse, and every job/step must have the fields Actions requires.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.y*ml"))

try:
    import yaml
except ImportError:  # pragma: no cover - CI installs it explicitly
    sys.exit("pyyaml is required: pip install pyyaml")


def check(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - the parse error is the finding
        return [f"{path.name}: invalid YAML -> {exc}"]

    if not isinstance(doc, dict) or not doc.get("jobs"):
        return [f"{path.name}: no `jobs:` mapping"]

    for job_id, job in doc["jobs"].items():
        if not isinstance(job, dict):
            errors.append(f"{path.name}: job `{job_id}` is not a mapping")
            continue
        for field in ("runs-on", "steps"):
            if field not in job:
                errors.append(f"{path.name}: job `{job_id}` is missing `{field}`")
        steps = job.get("steps") or []
        if not isinstance(steps, list) or not steps:
            errors.append(f"{path.name}: job `{job_id}` has no steps")
            continue
        for idx, step in enumerate(steps):
            if not isinstance(step, dict):
                errors.append(f"{path.name}: {job_id}.steps[{idx}] is not a mapping")
                continue
            if "run" not in step and "uses" not in step:
                errors.append(f"{path.name}: {job_id}.steps[{idx}] has neither `run` nor `uses`")
    return errors


def main() -> int:
    if not WORKFLOWS:
        sys.exit("no workflow files found under .github/workflows")

    errors: list[str] = []
    for path in WORKFLOWS:
        errors.extend(check(path))

    if errors:
        print("WORKFLOW CHECK FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1

    total_jobs = 0
    total_steps = 0
    for path in WORKFLOWS:
        doc = yaml.safe_load(path.read_text(encoding="utf-8"))
        total_jobs += len(doc["jobs"])
        total_steps += sum(len(j.get("steps") or []) for j in doc["jobs"].values())
    print(f"WORKFLOW CHECK OK: {len(WORKFLOWS)} file(s), {total_jobs} job(s), {total_steps} step(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
