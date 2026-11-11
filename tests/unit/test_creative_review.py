"""Contracts for `tools/creative_review.py`.

The post-render review exists to catch a film that contradicts its own record —
a promise placed past the end, a record misdescribing the file it shipped with.
Those are the only things it may fail on.

Everything stylistic is an observation. That boundary was set by testing: the
luminance comparison between cover and film fired on four shipped covers that
the calibrated `thumbnail_style.py` rates MATCH, because a designed cover is
normally brighter than an average film frame. A measure that disagrees with the
evidence must inform, not block.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "creative_review.py"

# The CI `fresh checkout` job installs only the kit's runtime requirements, which
# do not include Pillow. These tests must skip there rather than fail collection.
pytest.importorskip("PIL", reason="review needs Pillow")
imageio_ffmpeg = pytest.importorskip("imageio_ffmpeg", reason="needs a video encoder")
np = pytest.importorskip("numpy", reason="needs numpy")

sys.path.insert(0, str(ROOT / "tools"))
import creative_review  # noqa: E402


def _make_clip(path: Path, seconds: float = 3.0, moving: bool = True) -> Path:
    """Synthetic film: a block that either travels or sits still."""
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = imageio_ffmpeg.write_frames(
        str(path), (160, 288), fps=30, codec="libx264",
        pix_fmt_in="rgb24", output_params=["-crf", "30", "-pix_fmt", "yuv420p"],
    )
    writer.send(None)
    for index in range(int(seconds * 30)):
        frame = np.zeros((288, 160, 3), dtype=np.uint8)
        # Every channel must be constant when the clip is meant to be still, or the
        # frame-delta measure correctly reports movement that the fixture did not intend.
        frame[:, :, 2] = 30 + (index if moving else 0)
        left = 10 + (index % 120) if moving else 40
        frame[100:220, left : left + 60] = 220
        writer.send(frame.tobytes())
    writer.close()
    return path


def _package(tmp_path: Path, seconds: float = 3.0, moving: bool = True, **overrides) -> Path:
    slug = "review-fixture"
    package = tmp_path / "videos" / slug
    package.mkdir(parents=True, exist_ok=True)
    _make_clip(package / f"{slug}.mp4", seconds=seconds, moving=moving)
    record = {
        "title": "A Fixture Film",
        "slug": slug,
        "duration": seconds,
        "resolution": "160x288",
        "creative": {"retention_map": [
            {"at_sec": 0.0, "kind": "hook", "purpose": "open"},
            {"at_sec": seconds - 0.5, "kind": "payoff", "purpose": "close"},
        ]},
    }
    record.update(overrides)
    (package / "record.json").write_text(json.dumps(record), encoding="utf-8")
    return package


def test_still_film_is_reported_not_failed(tmp_path, monkeypatch):
    """A visually static film is a choice; the review notes it and still passes."""
    package = _package(tmp_path, moving=False)
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    report = creative_review.review("review-fixture")
    assert report["hook_is_static"] is True
    assert report["problems"] == []


def test_moving_film_is_not_reported_as_static(tmp_path, monkeypatch):
    package = _package(tmp_path, moving=True)
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    report = creative_review.review("review-fixture")
    assert report["hook_is_static"] is False


def test_promise_past_the_end_is_a_failure(tmp_path, monkeypatch):
    """The record must not put a beat where the film has already stopped."""
    package = _package(tmp_path, seconds=3.0)
    record = json.loads((package / "record.json").read_text())
    record["creative"]["retention_map"].append(
        {"at_sec": 99.0, "kind": "reveal", "purpose": "never happens"}
    )
    (package / "record.json").write_text(json.dumps(record), encoding="utf-8")
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    report = creative_review.review("review-fixture")
    assert any("ends at" in problem for problem in report["problems"])


def test_payoff_on_the_final_frame_is_allowed(tmp_path, monkeypatch):
    """A film whose payoff lands on its last frame is legitimate."""
    package = _package(tmp_path, seconds=3.0)
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    report = creative_review.review("review-fixture")
    assert report["problems"] == []


def test_wrong_resolution_in_record_is_a_failure(tmp_path, monkeypatch):
    package = _package(tmp_path, resolution="1920x1080")
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    report = creative_review.review("review-fixture")
    assert any("record says 1920x1080" in problem for problem in report["problems"])


def test_cover_light_gap_is_an_observation_not_a_failure(tmp_path, monkeypatch):
    """This measure fired on four shipped covers that thumbnail_style rates MATCH."""
    package = _package(tmp_path)
    from PIL import Image

    Image.new("RGB", (160, 288), (255, 255, 255)).save(package / "thumbnail.jpg")
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    report = creative_review.review("review-fixture")
    assert report["problems"] == []
    assert report["cover_world_delta"] is not None


def test_saves_frames_for_human_inspection(tmp_path, monkeypatch):
    package = _package(tmp_path)
    monkeypatch.setattr(creative_review, "VIDEOS", package.parents[1] / "videos")
    out = tmp_path / "frames"
    report = creative_review.review("review-fixture", out)
    assert len(report["frames_saved"]) >= 3
    for path in report["frames_saved"]:
        assert (ROOT / path).exists() or Path(path).exists()


def test_cli_passes_on_the_shipped_films():
    """The real catalog must satisfy its own records."""
    proc = subprocess.run(
        [sys.executable, str(TOOL), "--all", "--json"],
        cwd=ROOT, capture_output=True, text=True, timeout=1800,
    )
    assert proc.returncode == 0, proc.stdout[-3000:] + proc.stderr[-2000:]
    payload = json.loads(proc.stdout)
    assert payload["failed"] == 0
    assert len(payload["reports"]) >= 8
