"""Environment readiness checklist for a fresh (ephemeral) sandbox.

The Arena sandbox is temporary: Python packages, npm modules, TTS weights and renders do not
persist. This test documents and verifies the *bootstrap contract* — the exact sequence that turns
an empty machine into a working production environment — so a future session never has to
rediscover it (see docs/production/KNOWN_ISSUES.md KI-004 and LESSONS_LEARNED.md L-01).

Run it to check readiness without installing anything::

    .venv/bin/python tests/production/test_environment_readiness.py

Every check reports READY / MISSING rather than raising on the first failure, because a partially
bootstrapped machine is the normal state and the operator needs the whole picture.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
VENV_PY = REPO_ROOT / ".venv" / "bin" / "python"
PY = str(VENV_PY) if VENV_PY.exists() else sys.executable

BOOTSTRAP = [
    "# from the repository root, once per machine",
    "python3 -m venv .venv",
    ".venv/bin/pip install --upgrade pip",
    ".venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml",
    "npm install --prefix universal_toolbook",
    ".venv/bin/python universal_toolbook/setup_tts.py",
    ".venv/bin/python universal_toolbook/run_studio.py check",
]


def _check(name, fn):
    try:
        ok, detail = fn()
    except Exception as e:  # noqa: BLE001 - report, never crash the checklist
        ok, detail = False, f"{type(e).__name__}: {e}"
    print(f"{'READY  ' if ok else 'MISSING'}  {name}: {detail}")
    return ok


def test_bootstrap_documented_in_start_here():
    text = (REPO_ROOT / "START_HERE.md").read_text(encoding="utf-8")
    assert "npm install --prefix universal_toolbook" in text
    assert "setup_tts.py" in text


def test_bootstrap_command_list_is_exact():
    """The documented sequence must stay installable on a PEP 668 box (venv, not system pip)."""
    joined = "\n".join(BOOTSTRAP)
    assert ".venv" in joined, "bootstrap must use the repo venv, never system pip"
    assert "setup_tts.py" in joined


def run_checklist() -> bool:
    results = []

    def py_imports():
        r = subprocess.run([PY, "-c",
                            "import numpy, imageio_ffmpeg; "
                            "print(imageio_ffmpeg.get_ffmpeg_exe())"],
                           capture_output=True, text=True, cwd=REPO_ROOT)
        return r.returncode == 0, r.stdout.strip().splitlines()[-1] if r.returncode == 0 \
            else r.stderr.strip().splitlines()[-1]

    def canvas_backend():
        p = REPO_ROOT / "universal_toolbook" / "node_modules"
        ok = (p / "@napi-rs" / "canvas").exists() or (p / "canvas").exists()
        return ok, "@napi-rs/canvas" if ok else "node_modules missing — npm install --prefix universal_toolbook"

    def kokoro_weights():
        d = REPO_ROOT / "cache" / "tts"
        onnx = d / "kokoro.onnx"
        npz = d / "voices.npz"
        ok = onnx.exists() and npz.exists()
        detail = f"{onnx.stat().st_size/1e6:.0f}MB + {npz.stat().st_size/1e6:.0f}MB" if ok \
            else "run .venv/bin/python universal_toolbook/setup_tts.py"
        return ok, detail

    def ffmpeg_binary():
        exe = shutil.which("ffmpeg")
        if exe:
            return True, exe
        r = subprocess.run([PY, "-c",
                            "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
                           capture_output=True, text=True, cwd=REPO_ROOT)
        return r.returncode == 0, (r.stdout.strip() or "imageio-ffmpeg missing")

    results.append(_check("numpy + imageio-ffmpeg", py_imports))
    results.append(_check("2D canvas backend", canvas_backend))
    results.append(_check("ffmpeg binary", ffmpeg_binary))
    results.append(_check("Kokoro weights (cache/tts)", kokoro_weights))
    return all(results)


if __name__ == "__main__":
    print("Bootstrap contract (exact commands):")
    for line in BOOTSTRAP:
        print("  " + line)
    print()
    ok = run_checklist()
    print("\n" + ("ENVIRONMENT READY" if ok else "ENVIRONMENT INCOMPLETE — run the bootstrap above"))
    # pytest-facing assertions live in the two test_* functions; the checklist is informational.
    test_bootstrap_documented_in_start_here()
    test_bootstrap_command_list_is_exact()
    sys.exit(0 if ok else 1)
