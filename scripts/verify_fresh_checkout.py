#!/usr/bin/env python3
"""Simulate a fresh checkout and verify the repository end to end.

Clones the current branch into a temporary directory, installs Python and Node dependencies,
runs every structural/test gate, renders the smallest valid episode silently, checks its
validation report and extracts one frame, then proves the kit works from inside its own folder.

Usage::

    python3 scripts/verify_fresh_checkout.py
    python3 scripts/verify_fresh_checkout.py --work-dir /tmp/fresh --keep

No Kokoro weights are downloaded; the render is deliberately silent (``--voice none``). The
script reports a frame extraction, not a subjective visual review.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(name: str, cmd: list[str], cwd: Path, steps: list[dict], *, check: bool = True) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    entry = {
        "name": name,
        "command": " ".join(str(c) for c in cmd),
        "exit_code": proc.returncode,
        "stdout_tail": proc.stdout.strip().splitlines()[-6:],
        "stderr_tail": proc.stderr.strip().splitlines()[-6:],
    }
    steps.append(entry)
    print(f"[{'OK' if proc.returncode == 0 else 'FAIL'}] {name}", flush=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"{name} failed (exit {proc.returncode}):\n{proc.stdout[-2000:]}\n{proc.stderr[-2000:]}")
    return proc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", type=Path, default=ROOT)
    ap.add_argument("--work-dir", type=Path, default=None)
    ap.add_argument("--keep", action="store_true", help="keep the clone for inspection")
    ap.add_argument("--skip-install", action="store_true", help="reuse an existing .venv in the clone")
    ap.add_argument("--skip-render", action="store_true")
    args = ap.parse_args()

    repo = args.repo.resolve()
    commit = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    branch = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "--abbrev-ref", "HEAD"], text=True).strip()
    temp_root = args.work_dir.resolve() if args.work_dir else Path(tempfile.mkdtemp(prefix="toolbook-fresh-"))
    temp_root.mkdir(parents=True, exist_ok=True)
    clone = temp_root / "checkout"
    if clone.exists():
        shutil.rmtree(clone)
    steps: list[dict] = []
    summary: dict = {"branch": branch, "commit": commit, "clone": str(clone),
                     "steps": steps, "status": "FAILED"}

    try:
        # Clone the committed state, then check out the exact HEAD commit. This works both on a
        # named local branch and on the detached HEAD that actions/checkout uses for a PR.
        run("git clone", ["git", "clone", "--no-hardlinks", str(repo), str(clone)], repo, steps)
        run("checkout HEAD commit", ["git", "-C", str(clone), "checkout", "--detach", commit], repo, steps)
        py = sys.executable
        venv_py = clone / ".venv" / "bin" / "python"
        system_py = shutil.which("python3") or py

        # Pure-python gates must work with no installed dependencies at all.
        run("check_docs", [system_py, "tools/check_docs.py"], clone, steps)
        run("validate_structure", [system_py, "tools/validate_structure.py"], clone, steps)

        if not args.skip_install:
            run("venv", [py, "-m", "venv", ".venv"], clone, steps)
            run("pip install", [str(venv_py), "-m", "pip", "install", "--quiet", "-r",
                                "universal_toolbook/requirements.txt", "pytest", "pyyaml"], clone, steps)
            run("npm install", ["npm", "install", "--prefix", "universal_toolbook",
                                "--no-audit", "--no-fund"], clone, steps)
        elif not venv_py.exists():
            raise RuntimeError("--skip-install requires an existing .venv in the clone")

        run("check_workflows", [str(venv_py), "tools/check_workflows.py"], clone, steps)
        run("environment check", [str(venv_py), "universal_toolbook/run_studio.py", "check"], clone, steps)
        run("validate specs", [str(venv_py), "tools/validate_specs.py"], clone, steps)
        run("JS regression", ["node", "tests/regression/run_all_tests.js"], clone, steps)
        run("Python integration", [str(venv_py), "tests/integration/test_studio_pipeline.py"], clone, steps)
        run("unit + production tests", [str(venv_py), "-m", "pytest", "tests/unit",
                                        "tests/production", "-q"], clone, steps)

        # The kit must work when the current directory IS the copied kit directory.
        run("kit standalone validate", [str(venv_py), "run_studio.py", "validate",
                                        "templates/episode_minimal.json"],
            clone / "universal_toolbook", steps)

        render_info: dict = {}
        if not args.skip_render:
            for folder in ("runtime/work", "runtime/renders", "runtime/previews", "runtime/cache", "runtime/logs"):
                (clone / folder).mkdir(parents=True, exist_ok=True)
            out = clone / "runtime" / "renders" / "fresh_checkout.mp4"
            proc = run("silent draft render", [str(venv_py), "universal_toolbook/run_studio.py", "render",
                                               "universal_toolbook/templates/episode_minimal.json",
                                               "--out", str(out), "--draft", "--voice", "none",
                                               "--workers", "2", "--chunk-sec", "20"], clone, steps)
            report = json.loads(proc.stdout[proc.stdout.index("{"):])
            vpath = out.with_name("fresh_checkout_validation_report.json")
            validation = json.loads(vpath.read_text(encoding="utf-8"))
            assert report["status"] == "COMPLETE" and report["voiced"] is False, report
            assert report["warnings"] == [], report["warnings"]
            assert validation["valid"] is True and validation["film_grain"] is False, validation
            assert validation["fps"] == 30 and validation["frames"] > 0, validation
            assert validation["warnings"] == [], validation["warnings"]
            assert out.is_file() and out.stat().st_size > 100_000, "rendered MP4 is missing or empty"

            ff = subprocess.check_output(
                [str(venv_py), "-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"],
                cwd=clone, text=True).strip()
            frame = clone / "runtime" / "previews" / "fresh_checkout_frame.png"
            run("extract one frame", [ff, "-v", "error", "-ss", "5", "-i", str(out),
                                      "-frames:v", "1", "-y", str(frame)], clone, steps)
            assert frame.is_file() and frame.stat().st_size > 1000, "extracted frame is empty"
            render_info = {
                "mp4_bytes": out.stat().st_size,
                "frames": validation["frames"],
                "fps": validation["fps"],
                "dimensions": validation["dimensions"],
                "voiced": report["voiced"],
                "frame_extracted": str(frame.relative_to(clone)),
                "visual_review": "not performed by this automated script",
            }

        summary["render"] = render_info
        summary["status"] = "PASSED"
        print(json.dumps(summary, indent=2))
        return 0
    except Exception as exc:  # noqa: BLE001 - report every failure with the step log
        summary["error"] = str(exc)
        print(json.dumps(summary, indent=2))
        return 1
    finally:
        if not args.keep and args.work_dir is None:
            shutil.rmtree(temp_root, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
