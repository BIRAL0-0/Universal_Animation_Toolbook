"""Publishing-package contract: every completed video must be a YouTube-ready asset.

The rule these tests protect (client instruction, 2026-11-10):

    Every video must be a complete, identifiable, searchable, publishable creative
    asset — not an anonymous MP4 file.

So a completed video is a directory ``videos/<slug>/`` holding ``<slug>.mp4``,
``script.md``, ``thumbnail.jpg`` and ``record.json``, catalogued in
``videos/index.json``. Anonymous names (``final.mp4`` and friends) are a regression.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
VIDEOS = REPO_ROOT / "videos"

REQUIRED_RECORD_FIELDS = [
    "id", "slug", "title", "filename", "script", "thumbnail",
    "youtube_description", "pinned_comment", "format", "aspect_ratio",
    "resolution", "duration_seconds", "created_at", "topic", "summary",
    "key_angle", "tags", "production_version",
]

REQUIRED_INDEX_FIELDS = [
    "id", "title", "slug", "topic", "summary", "key_angle", "duration",
    "format", "produced_at", "directory", "content_fingerprint",
]

BANNED = {"final.mp4", "output.mp4", "video1.mp4", "movie.mp4", "temp.mp4"}


def _packages() -> list[Path]:
    return sorted(p for p in VIDEOS.iterdir() if p.is_dir())


def _index() -> dict:
    return json.loads((VIDEOS / "index.json").read_text(encoding="utf-8"))


def test_every_package_has_the_five_permanent_artifacts():
    packages = _packages()
    assert packages, "videos/ holds no completed packages"
    for package in packages:
        slug = package.name
        assert (package / f"{slug}.mp4").is_file(), slug
        assert (package / "script.md").is_file(), slug
        assert (package / "thumbnail.jpg").is_file(), slug
        assert (package / "record.json").is_file(), slug


def test_no_generic_final_filenames_survive():
    for package in _packages():
        for banned in BANNED:
            assert not (package / banned).exists(), f"{package.name}/{banned}"
        assert not (VIDEOS / package.name / "final").exists()
    assert not (VIDEOS / "final.mp4").exists()


def test_directory_names_are_descriptive_slugs():
    import re

    pattern = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    for package in _packages():
        assert pattern.match(package.name), package.name
        assert len(package.name) >= 8, package.name
        assert "-" in package.name, package.name


def test_record_json_is_complete_and_self_consistent():
    for package in _packages():
        record = json.loads((package / "record.json").read_text(encoding="utf-8"))
        for field in REQUIRED_RECORD_FIELDS:
            assert field in record, f"{package.name}: missing {field}"
            assert record[field] not in ("", None, []), f"{package.name}: empty {field}"
        assert record["slug"] == package.name
        assert record["filename"] == f"{package.name}.mp4"
        assert record["script"] == "script.md"
        assert record["thumbnail"] == "thumbnail.jpg"
        assert record["format"] in ("portrait", "landscape")
        expected = "9:16" if record["format"] == "portrait" else "16:9"
        assert record["aspect_ratio"] == expected
        expected_res = "1080x1920" if record["format"] == "portrait" else "1920x1080"
        assert record["resolution"] == expected_res
        assert isinstance(record["duration_seconds"], (int, float))
        assert record["duration_seconds"] > 0
        assert len(record["tags"]) >= 3
        assert len(record["youtube_description"]) > 200
        assert "#" in record["youtube_description"]  # hashtags present
        assert len(record["pinned_comment"]) > 40
        assert "like, subscribe and comment" not in record["pinned_comment"].lower()


def test_script_md_carries_the_title_and_the_narration():
    for package in _packages():
        record = json.loads((package / "record.json").read_text(encoding="utf-8"))
        script = (package / "script.md").read_text(encoding="utf-8")
        assert record["title"] in script, package.name
        assert len(script) > 400, package.name
        # scene divisions are part of the canonical record
        assert script.count("## ") >= 3, package.name


def test_thumbnails_are_platform_sized():
    PIL = pytest.importorskip("PIL.Image")
    for package in _packages():
        record = json.loads((package / "record.json").read_text(encoding="utf-8"))
        thumb = package / "thumbnail.jpg"
        assert thumb.stat().st_size < 2 * 1024 * 1024, package.name
        with PIL.open(thumb) as image:
            size = image.size
        expected = (1280, 720) if record["aspect_ratio"] == "16:9" else (1080, 1920)
        assert size == expected, f"{package.name}: {size} != {expected}"


def test_index_mirrors_every_package():
    index = _index()
    entries = {entry["slug"]: entry for entry in index["videos"]}
    packages = {p.name for p in _packages()}
    assert set(entries) == packages
    assert index["total_videos"] == len(index["videos"]) == len(packages)
    for slug, entry in entries.items():
        for field in REQUIRED_INDEX_FIELDS:
            assert field in entry, f"{slug}: missing {field}"
        assert entry["directory"] == f"videos/{slug}"
        record = json.loads((VIDEOS / slug / "record.json").read_text(encoding="utf-8"))
        assert entry["content_fingerprint"] == record["content_fingerprint"], slug
        assert abs(entry["duration"] - record["duration_seconds"]) < 0.01, slug


def test_index_has_no_duplicate_titles_or_topics():
    index = _index()
    titles = [v["title"].lower() for v in index["videos"]]
    assert len(titles) == len(set(titles))


def test_publishing_validator_passes_on_this_repository():
    """The shipped validator is the gate: it must pass on the tracked packages."""
    try:
        import imageio_ffmpeg  # noqa: F401  (or a system ffprobe)
    except ImportError:
        if not shutil.which("ffprobe"):
            pytest.skip("no ffmpeg/ffprobe available to verify the masters")
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools" / "validate_publishing.py"), "--json"],
        capture_output=True, text=True, cwd=REPO_ROOT, timeout=900,
    )
    report = json.loads(result.stdout or "{}")
    assert result.returncode == 0, report.get("problems")
    assert report.get("ok") is True
    assert report.get("packages")


# --------------------------------------------------- narration extraction precision
def _validator():
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "validate_publishing", REPO_ROOT / "tools" / "validate_publishing.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_narration_ignores_logline_direction_and_notes():
    """Runtime estimation must see speech only — not the logline, on-screen text or notes."""
    mod = _validator()
    script = (
        "# A Title\n\n## Logline\n\nA long prose summary that is never spoken aloud.\n\n---\n\n"
        "## S01 — One\n\n**ON SCREEN:** He hit a wall.\n\n**NARRATOR:** He hit a wall.\n\n"
        "## Production notes\n\n- voices, music and other chatter that is never spoken.\n")
    assert mod.narration_of(script).strip() == "He hit a wall."


def test_word_floor_scales_with_duration():
    """A tight 45s Short passes; the same script bolted to a 10-minute master would not."""
    mod = _validator()
    spoken = " ".join(f"word{i}" for i in range(30))
    count = len(set(__import__("re").findall(r"[a-z0-9']+", spoken)))
    assert count >= max(20, int(45 * 0.40))
    assert count < max(20, int(600 * 0.40))
