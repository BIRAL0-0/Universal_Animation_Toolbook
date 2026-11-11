"""Contracts for `tools/thumbnail_legibility.py`.

The one thing this tool is allowed to *fail* on is two covers being the same
picture at phone size, so that measure has to be trustworthy: it must fire on
genuine duplicates and stay quiet on covers that merely share a palette.

The rest of the tool renders the mobile sizes and reports indicative numbers.
Those numbers must never fail the build, because they were tested against the
eight shipped covers and disagreed with the eye — `the-first-plank` measures a
7% "subject share" and reads perfectly at 168 px. These tests pin that boundary
so a later change cannot quietly promote a misleading number into a gate.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "thumbnail_legibility.py"

PIL = pytest.importorskip("PIL", reason="thumbnail measurement needs Pillow")
pytest.importorskip("numpy", reason="thumbnail measurement needs numpy")

from PIL import Image  # noqa: E402

sys.path.insert(0, str(ROOT / "tools"))
import thumbnail_legibility as legibility  # noqa: E402


def _cover(path: Path, fill=(30, 26, 22), blob=(240, 236, 228)) -> Path:
    """A stand-in cover: dark field with one bright centred shape."""
    image = Image.new("RGB", (540, 960), fill)
    from PIL import ImageDraw

    draw = ImageDraw.Draw(image)
    draw.ellipse((150, 250, 390, 620), fill=blob)
    draw.rectangle((120, 720, 420, 760), fill=blob)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, quality=92)
    return path


def test_identical_covers_collide(tmp_path):
    a = _cover(tmp_path / "one" / "thumbnail.jpg")
    b = _cover(tmp_path / "two" / "thumbnail.jpg")
    assert legibility.signature_distance(Image.open(a), Image.open(b)) < legibility.DUPLICATE_DISTANCE


def test_rescaled_and_recompressed_covers_still_collide(tmp_path):
    """A re-save must not hide a duplicate — the same film, exported twice."""
    a = _cover(tmp_path / "one" / "thumbnail.jpg")
    small = tmp_path / "two" / "thumbnail.jpg"
    small.parent.mkdir(parents=True, exist_ok=True)
    Image.open(a).resize((270, 480)).save(small, quality=70)
    assert legibility.signature_distance(Image.open(a), Image.open(small)) < legibility.DUPLICATE_DISTANCE


def test_different_covers_do_not_collide(tmp_path):
    a = _cover(tmp_path / "one" / "thumbnail.jpg")
    b = tmp_path / "two" / "thumbnail.jpg"
    b.parent.mkdir(parents=True, exist_ok=True)
    other = Image.new("RGB", (1280, 720), (10, 14, 24))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(other)
    draw.rectangle((40, 120, 300, 600), fill=(204, 41, 43))
    draw.rectangle((900, 60, 1240, 300), fill=(217, 165, 33))
    other.save(b, quality=92)
    assert legibility.signature_distance(Image.open(a), Image.open(b)) > legibility.DUPLICATE_DISTANCE


def test_indicative_measures_are_reported_but_do_not_gate(tmp_path):
    """A low 'subject share' must not fail the tool — that number is advisory only."""
    path = _cover(tmp_path / "tiny-subject" / "thumbnail.jpg")
    result = legibility.audit(path)
    assert "subject_share_indicative" in result
    assert "luma_spread_at_search_indicative" in result
    # The gating key set must not include a legibility verdict at all.
    assert "problems" not in result


def test_measured_at_both_real_mobile_sizes():
    assert legibility.SEARCH_WIDTH == 168
    assert legibility.FEED_WIDTH == 216


def test_cli_passes_on_the_shipped_covers():
    proc = subprocess.run(
        [sys.executable, str(TOOL), "--all", "--json"], cwd=ROOT, capture_output=True, text=True
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["sizes"] == [168, 216]
    assert payload["duplicate_pairs"] == []
    assert "whether the cover is legible" in payload["not_gating"]


def test_cli_writes_a_contact_sheet_at_real_sizes(tmp_path):
    out = tmp_path / "sheet.png"
    proc = subprocess.run(
        [sys.executable, str(TOOL), "--all", "--sheet", str(out)],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert out.exists() and out.stat().st_size > 10_000


def test_cli_reports_duplicates_across_two_named_files(tmp_path):
    a = _cover(tmp_path / "one" / "thumbnail.jpg")
    b = _cover(tmp_path / "two" / "thumbnail.jpg")
    proc = subprocess.run(
        [sys.executable, str(TOOL), str(a), str(b)], cwd=ROOT, capture_output=True, text=True
    )
    assert proc.returncode == 1
    assert "same picture at search size" in proc.stdout
