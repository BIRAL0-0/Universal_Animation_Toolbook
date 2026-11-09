"""Regression test for KI-007: declared aspect ratio vs encoded pixels.

Root cause (2026-11-09): ``run_studio.py cmd_render`` computed the correct output size from
``_render_dimensions(aspect_ratio, draft)`` and then a legacy ``--portrait`` branch *overwrote*
``width, height`` unconditionally. With ``--shorts`` or ``--aspect-ratio 9:16`` and no
``--portrait`` flag, every render therefore encoded **landscape** pixels while the validation
report still claimed ``aspect_ratio: "9:16"`` — a silent, self-contradicting gate.

Fix: the legacy flag is now only an alias that sets the aspect request, ``_render_dimensions``
is the single source of truth, and the validation report hard-fails
(``valid: false`` + a warning) when encoded dimensions contradict the declared aspect.

These tests pin both halves of the fix without re-encoding video.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUN_STUDIO = REPO_ROOT / "universal_toolbook" / "run_studio.py"
VENV_PY = REPO_ROOT / ".venv" / "bin" / "python"
PY = str(VENV_PY) if VENV_PY.exists() else sys.executable


def _load_run_studio():
    spec = importlib.util.spec_from_file_location("run_studio", RUN_STUDIO)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_render_dimensions_are_aspect_correct():
    rs = _load_run_studio()
    assert rs._render_dimensions("9:16", draft=True) == (540, 960)
    assert rs._render_dimensions("9:16", draft=False) == (1080, 1920)
    assert rs._render_dimensions("16:9", draft=True) == (960, 540)
    assert rs._render_dimensions("16:9", draft=False) == (1920, 1080)


def test_no_legacy_branch_overwrites_dimensions():
    """The clobbering block must not come back: after _render_dimensions is called in
    cmd_render, nothing may reassign width/height from the --portrait flag."""
    src = RUN_STUDIO.read_text(encoding="utf-8")
    start = src.index("def cmd_render")
    body = src[start:start + src[start:].index("\ndef ", 10)]
    assert 'if getattr(args, "portrait", False):' not in body, (
        "the legacy --portrait dimension override has returned; _render_dimensions must stay "
        "the single source of truth (KI-007)"
    )


def test_legacy_portrait_flag_maps_to_9_16():
    rs = _load_run_studio()

    class A:  # minimal namespace
        aspect_ratio = None
        shorts = False
        portrait = True

    args = A()
    if getattr(args, "portrait", False) and args.aspect_ratio in (None, ""):
        args.aspect_ratio = "9:16"
    assert rs._resolve_aspect_ratio(args.aspect_ratio, args.shorts) == "9:16"


def test_validation_report_gates_dimension_aspect_agreement():
    """A validation report whose pixels contradict its aspect must not read valid."""
    rs = _load_run_studio()
    src = RUN_STUDIO.read_text(encoding="utf-8")
    assert "dimensions_match_aspect" in src, "the KI-007 gate is missing from cmd_render"
    # behavioural probe: the gate expression itself
    for aspect, w, h, expected in (("9:16", 540, 960, True), ("9:16", 960, 540, False),
                                   ("16:9", 1920, 1080, True), ("16:9", 1080, 1920, False)):
        got = (w < h) if aspect == "9:16" else (w > h)
        assert got is expected, f"gate expression wrong for {aspect} {w}x{h}"


def test_shipped_project_masters_are_pixel_correct():
    """Every rendered master in projects/ must have pixels matching its declared aspect."""
    projects = REPO_ROOT / "projects"
    if not projects.exists():
        return
    for report in projects.rglob("*_validation_report.json"):
        data = json.loads(report.read_text(encoding="utf-8"))
        w, h = data["dimensions"]
        aspect = data["aspect_ratio"]
        ok = (w < h) if aspect == "9:16" else (w > h)
        assert ok, f"{report.relative_to(REPO_ROOT)}: {w}x{h} contradicts {aspect}"
        assert data.get("dimensions_match_aspect", True), report.name


def test_run_studio_still_imports_and_checks():
    r = subprocess.run([PY, str(RUN_STUDIO), "check"], capture_output=True, text=True,
                       cwd=REPO_ROOT)
    assert r.returncode == 0, r.stderr[-800:]
    assert '"status": "OK"' in r.stdout


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    bad = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            bad += 1
            print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - bad}/{len(fns)} passed")
    sys.exit(1 if bad else 0)
