"""Regression test for KI-017: a render must be validated against the file it wrote.

Root cause (2026-11-11): ``run_studio.py render --shorts --draft --workers 4`` finished with
``status: COMPLETE``, ``warnings: []`` and a validation report claiming ``valid: true`` and
``frames: 3919`` — while the MP4 held **only an audio stream**. The video encoder had failed
on an intermittent worker race, and nothing noticed, because every check in the validation
report was computed from the *compiled plan* rather than from the encoded file.

The fix adds ``_probe_output_streams()``, which asks ffprobe (falling back to imageio-ffmpeg)
what was actually written, and makes ``valid`` / ``status`` depend on it. An audio-only file
is now a hard failure with a non-zero exit code.

These tests pin the probe itself against real files, and pin the ordering rule that ``valid``
cannot be true when the artifact is not a video.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
RUN_STUDIO = REPO_ROOT / "universal_toolbook" / "run_studio.py"


def _load_run_studio():
    spec = importlib.util.spec_from_file_location("run_studio_ki017", RUN_STUDIO)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def rs():
    return _load_run_studio()


@pytest.fixture(scope="module")
def ffmpeg():
    imageio_ffmpeg = pytest.importorskip("imageio_ffmpeg")
    return imageio_ffmpeg.get_ffmpeg_exe()


@pytest.fixture(scope="module")
def audio_only_mp4(tmp_path_factory, ffmpeg):
    """An MP4 with a real audio stream and no video stream — the exact failure shape."""
    out = tmp_path_factory.mktemp("ki017") / "audio_only.mp4"
    subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
         "-c:a", "aac", str(out)],
        check=True, capture_output=True)
    return out


@pytest.fixture(scope="module")
def real_video(tmp_path_factory, ffmpeg):
    out = tmp_path_factory.mktemp("ki017v") / "real.mp4"
    subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=180x320:rate=10:duration=2",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)],
        check=True, capture_output=True)
    return out


def test_probe_reports_zero_video_streams_for_audio_only(rs, audio_only_mp4):
    """The regression itself: this file used to be reported as a valid render."""
    info = rs._probe_output_streams(audio_only_mp4)
    assert info["video_streams"] == 0, info
    assert info["probe_error"], "an audio-only file must explain why it is not a video"


def test_probe_reports_real_dimensions_for_a_video(rs, real_video):
    info = rs._probe_output_streams(real_video)
    assert info["video_streams"] == 1, info
    assert (info["width"], info["height"]) == (180, 320), info
    assert not info["probe_error"]


def test_probe_reports_missing_output(rs, tmp_path):
    info = rs._probe_output_streams(tmp_path / "nope.mp4")
    assert info["video_streams"] == 0
    assert "missing" in (info["probe_error"] or "")


def test_validation_valid_key_is_derived_from_the_artifact(rs):
    """`valid` must AND-in artifact_ok — not just the compiled plan and the aspect check.

    Guarded as source text because the combination lives inside cmd_render, whose full
    execution needs an environment. This asserts the ordering rule that caused KI-017:
    if `valid` can be true without artifact_ok, an audio-only encode passes silently.
    """
    source = RUN_STUDIO.read_text(encoding="utf-8")
    start = source.find('"valid":')
    assert start != -1, "the validation report no longer writes a `valid` key"
    block = source[start:start + 200]
    assert "dimensions_match_aspect" in block, "`valid` stopped ANDing the aspect check"
    assert "artifact_ok" in block, (
        "`valid` is computed without consulting the encoded artifact — KI-017 can recur")


def test_failed_encode_exits_non_zero(rs):
    """A failed encode must not exit 0, or scripts and CI treat it as success."""
    source = RUN_STUDIO.read_text(encoding="utf-8")
    assert "return 3" in source, "the incomplete-encode path does not signal failure"
    assert "INCOMPLETE_ENCODE" in source, "the report has no status for a bad encode"


def test_completed_reports_are_not_silently_incomplete():
    """Every shipped master must actually contain a video stream.

    Cheap: only the eight published packages. This is the check that would have caught
    an audio-only file reaching ``videos/``.
    """
    pytest.importorskip("imageio_ffmpeg")
    import imageio_ffmpeg

    videos = REPO_ROOT / "videos"
    if not videos.is_dir():
        pytest.skip("no videos directory")
    empty = []
    for pkg in sorted(p for p in videos.iterdir() if p.is_dir()):
        master = pkg / f"{pkg.name}.mp4"
        if not master.exists():
            empty.append(f"{pkg.name}: missing master")
            continue
        try:
            meta = next(imageio_ffmpeg.read_frames(str(master)))
            if not meta.get("size"):
                empty.append(f"{pkg.name}: no frame size")
        except Exception as exc:  # noqa: BLE001
            empty.append(f"{pkg.name}: unreadable ({type(exc).__name__})")
    assert not empty, f"published masters without a video stream: {empty}"


def test_a_real_render_completes_and_records_the_artifact(tmp_path):
    """Execute cmd_render on a tiny spec — not just read its source.

    KI-017 shipped a fix whose ordering was wrong: ``artifact_ok`` was referenced
    before assignment, so every render crashed with ``NameError``. The source-text
    tests above all passed, because text is not execution. This runs the command
    and asserts the report was actually written.
    """
    import json
    import subprocess
    import sys

    pytest.importorskip("imageio_ffmpeg")
    spec = {
        "title": "KI-017 smoke",
        "bgm": "reflective_piano",
        "subtitles_mode": "off",
        "cast": {"ada": {"name": "ADA", "style": "cel", "color": "#f8fafc", "scale": 1.1}},
        "scenes": [{
            "id": "S01", "duration": 2.0, "environment": "library_study",
            "mood": "calm", "dialog": [],
            "dialogue": [{"speaker": "narrator", "text": "A short line.", "pause_after": 0.2}],
            "characters": [{"id": "ada", "show_name": False,
                            "beats": [{"start": 0.0, "end": 2.0, "action": "idle_stand",
                                       "x": 0.5, "facing": 1}]}],
        }],
    }
    src = tmp_path / "smoke.json"
    src.write_text(json.dumps(spec))
    out = tmp_path / "smoke.mp4"
    proc = subprocess.run(
        [sys.executable, str(RUN_STUDIO), "render", str(src), "--out", str(out),
         "--shorts", "--draft", "--voice", "none", "--workers", "1"],
        capture_output=True, text=True, timeout=600)
    assert proc.returncode == 0, (
        f"render failed (rc={proc.returncode}).\nSTDERR tail:\n{proc.stderr[-2000:]}")
    report_path = out.with_name("smoke_report.json")
    assert report_path.exists(), "no report was written"
    report = json.loads(report_path.read_text())
    assert report["status"] == "COMPLETE", report.get("status")
    assert report["encoded"]["video_streams"] >= 1, report.get("encoded")
    assert out.stat().st_size > 10_000, "the encoded file is implausibly small"
