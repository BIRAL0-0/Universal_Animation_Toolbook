#!/usr/bin/env python3
"""Validate every completed video as a complete YouTube publishing package.

Usage::

    python3 tools/validate_publishing.py            # validate all packages
    python3 tools/validate_publishing.py --json     # machine-readable report

For each ``videos/<slug>/`` directory this checks the ten publishing rules:

1. Directory is a lowercase hyphenated slug and the MP4 inside is named
   ``<slug>.mp4`` — no ``final.mp4`` / ``output.mp4`` / ``video1.mp4``.
2. ``script.md`` exists, opens with the title, and its narration lines match the
   video record (non-trivial word overlap, source of truth = script).
3. ``thumbnail.jpg`` exists, is the right aspect/resolution for the format
   (1280x720 landscape, 1080x1920 portrait), and is < 2 MB (YouTube limit).
4. ``record.json`` is valid JSON with every required publishing field.
5. Length of description / pinned comment is realistic for YouTube.
6. ``videos/index.json`` carries a compact entry with slug, directory, summary,
   key angle and content fingerprint, and that fingerprint still matches the
   bytes on disk.
7. Format, aspect ratio and resolution agree with the actual MP4 (probed with
   ffprobe when available, otherwise recorded duration is trusted).
8. No stray temporary/unfinished files sit next to the package.
9. The master is **reproducible**: its first spoken line can be traced to a committed
   ``examples/*.json`` episode spec. Reported as a note, because a published master cannot
   be retracted and the gap can only be closed by re-authoring.

Exit code 0 = every package publishable; 1 = at least one problem.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "videos"

DEFAULT_FFMPEG = "/usr/bin/ffmpeg"

META_FLOAT = 0.1  # seconds of tolerance on recorded duration

REQUIRED_RECORD_FIELDS = [
    "id", "slug", "title", "filename", "script", "thumbnail",
    "youtube_description", "pinned_comment", "format", "aspect_ratio",
    "resolution", "duration_seconds", "created_at", "topic", "summary",
    "key_angle", "tags", "production_version", "format_policy_exception",
]

REQUIRED_INDEX_FIELDS = [
    "id", "title", "slug", "topic", "summary", "key_angle", "duration",
    "format", "produced_at", "directory", "content_fingerprint",
]

BANNED_FILENAMES = {"final.mp4", "output.mp4", "video1.mp4", "movie.mp4", "temp.mp4"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
TEMP_RE = re.compile(
    r"(^\.~|~$|\.tmp$|\.temp$|\.part$|\.partial$|\.bak$|\.orig$|\.swp$|"
    r"^untitled|^draft|_draft|^tmp_|^new-|\(1\)\.|copy\.)",
    re.IGNORECASE,
)

ALLOWED_EXTRA_FILES = {"script.md", "thumbnail.jpg", "record.json"}

MAX_THUMB_BYTES = 2 * 1024 * 1024
MIN_SEO_SCORE = 78
MIN_THUMB_STYLE = 0.62
MIN_DESCRIPTION_CHARS = 200
MIN_PINNED_CHARS = 40


# --------------------------------------------------------------------- helpers
def find_ffprobe() -> str | None:
    probe = shutil.which("ffprobe")
    if probe:
        return probe
    try:  # imageio-ffmpeg ships ffmpeg only, next to ffprobe in some builds
        import imageio_ffmpeg  # type: ignore

        return Path(imageio_ffmpeg.get_ffmpeg_exe()).with_name("ffprobe").as_posix() \
            if Path(imageio_ffmpeg.get_ffmpeg_exe()).with_name("ffprobe").exists() else None
    except Exception:
        return None


def probe_media(path: Path) -> dict | None:
    """Return {duration, width, height} for a video file, or None if unprobeable."""
    try:  # preferred: bundled ffmpeg via imageio-ffmpeg (no external ffprobe needed)
        import imageio_ffmpeg  # type: ignore

        meta = next(imageio_ffmpeg.read_frames(str(path)))
        return {
            "width": int(meta["size"][0]),
            "height": int(meta["size"][1]),
            "duration": float(meta["duration"]),
        }
    except Exception:
        pass
    probe = find_ffprobe()
    if not probe:
        return None
    cmd = [probe, "-v", "error", "-select_streams", "v:0",
           "-show_entries", "stream=width,height:format=duration",
           "-of", "json", str(path)]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        data = json.loads(out.stdout)
        stream = data["streams"][0]
        return {
            "width": int(stream["width"]),
            "height": int(stream["height"]),
            "duration": float(data["format"]["duration"]),
        }
    except Exception:
        return None


def thumbnail_size(path: Path) -> tuple[int, int] | None:
    try:
        from PIL import Image  # type: ignore

        with Image.open(path) as image:
            return image.size
    except Exception:
        try:  # minimal JPEG SOF parser fallback
            import struct

            data = path.read_bytes()
            index = 2
            while index < len(data):
                marker = data[index + 1]
                length = struct.unpack(">H", data[index + 2:index + 4])[0]
                if marker in (0xC0, 0xC1, 0xC2):
                    height, width = struct.unpack(">HH", data[index + 5:index + 9])
                    return width, height
                index += 2 + length
        except Exception:
            return None
    return None


def words(text: str) -> set[str]:
    return set(re.findall(r"[a-z']+", text.lower()))


SPOKEN_LABELS = ("NARRATOR", "KAI", "SAM", "DANIEL", "MARCUS", "MOTHER", "NIA", "OKORO",
                  "PANEL", "VOICE")
NON_SPOKEN_LABELS = ("ON SCREEN", "VISUAL DIRECTION", "NOTE", "MUSIC")


def narration_of(script: str) -> str:
    """Extract only spoken lines: drop headings, tables, direction, notes and credits.

    A script legitimately carries on-screen text (which duplicates the narration), visual
    direction and production notes. Counting those as speech would over-estimate runtime, so
    the runtime check must see the narration alone.
    """
    lines: list[str] = []
    in_notes = False
    in_logline = False
    seen: set[str] = set()
    for line in script.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            heading = stripped.lstrip("# ").strip()
            in_logline = bool(re.match(r"logline|summary|synopsis|premise", heading, re.I))
            # everything from a production/credits section onwards is not narration
            if re.search(r"production notes|credits|attribution", heading, re.IGNORECASE):
                in_notes = True
            continue
        if in_notes or in_logline or not stripped:
            continue
        if stripped == "---":
            in_logline = False
            continue
        if stripped.startswith(("|", ">", "_", "-")):
            continue
        label = re.match(r"^\*\*([A-Z][A-Z /]+):\*\*\s*(.*)$", stripped)
        if label:
            name, text = label.group(1).strip(), label.group(2).strip()
            if name.startswith(NON_SPOKEN_LABELS):
                continue
            if name in SPOKEN_LABELS or text:
                key = text.lower()
                if key in seen:      # on-screen text often repeats a spoken line
                    continue
                seen.add(key)
                lines.append(text)
            continue
        lines.append(stripped)
    return " ".join(lines)


def fingerprint_package(directory: Path, slug: str) -> str:
    digest = hashlib.sha256()
    for name in (f"{slug}.mp4", "script.md", "thumbnail.jpg"):
        path = directory / name
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
    return "sha256:" + digest.hexdigest()[:32]


def expected_dims(aspect_ratio: str) -> tuple[int, int]:
    return (1280, 720) if aspect_ratio == "16:9" else (1080, 1920)


def format_matches(aspect_ratio: str, width: int, height: int) -> bool:
    return (width, height) == expected_dims(aspect_ratio)


# ------------------------------------------------------------------ validation
def validate_package(directory: Path, index_entry: dict | None) -> tuple[list[str], list[str]]:
    problems: list[str] = []
    notes: list[str] = []
    slug = directory.name

    if not SLUG_RE.match(slug):
        problems.append(f"[naming] directory '{slug}' is not a lowercase hyphenated slug")
    if "-" not in slug:
        problems.append(f"[naming] directory '{slug}' is a single word — not descriptive")
    if len(slug) > 80 or len(slug) < 8:
        problems.append(f"[naming] slug '{slug}' length {len(slug)} outside 8–80 chars")

    record_path = directory / "record.json"
    if not record_path.exists():
        return problems + ["[record] record.json missing"], notes
    try:
        record = json.loads(record_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return problems + [f"[record] invalid JSON: {exc}"], notes

    for field in REQUIRED_RECORD_FIELDS:
        if field not in record:
            problems.append(f"[record] missing required field '{field}'")
        elif field != "format_policy_exception" and isinstance(record[field], str) \
                and not record[field].strip():
            problems.append(f"[record] empty required field '{field}'")

    if record.get("slug") != slug:
        problems.append(f"[record] slug '{record.get('slug')}' != directory '{slug}'")
    if record.get("filename") != f"{slug}.mp4":
        problems.append(f"[record] filename '{record.get('filename')}' != '{slug}.mp4'")
    if record.get("script") != "script.md":
        problems.append(f"[record] script field must be 'script.md', got '{record.get('script')}'")
    if record.get("thumbnail") != "thumbnail.jpg":
        problems.append("[record] thumbnail field must be 'thumbnail.jpg'")
    if record.get("format") not in ("portrait", "landscape"):
        problems.append(f"[record] format '{record.get('format')}' must be portrait|landscape")
    if record.get("aspect_ratio") not in ("9:16", "16:9"):
        problems.append(f"[record] aspect_ratio '{record.get('aspect_ratio')}' must be 9:16|16:9")
    elif (record.get("aspect_ratio") == "9:16") != (record.get("format") == "portrait"):
        problems.append("[record] format and aspect_ratio disagree")
    expected_master = (1920, 1080) if record.get("aspect_ratio") == "16:9" else (1080, 1920)
    expected = expected_dims(record.get("aspect_ratio", "9:16"))
    if record.get("resolution") != f"{expected_master[0]}x{expected_master[1]}":
        problems.append(
            f"[record] resolution '{record.get('resolution')}' != '{expected[0]}x{expected[1]}'")
    if not isinstance(record.get("tags"), list) or len(record.get("tags", [])) < 3:
        problems.append("[record] tags must be a list of at least 3 entries")

    description = record.get("youtube_description", "")
    if len(description) < MIN_DESCRIPTION_CHARS:
        problems.append(f"[record] youtube_description too short ({len(description)} chars)")
    if "#" not in description:
        problems.append("[record] youtube_description has no hashtags")
    pinned = record.get("pinned_comment", "")
    if len(pinned) < MIN_PINNED_CHARS:
        problems.append(f"[record] pinned_comment too short ({len(pinned)} chars)")
    if re.search(r"like,?\s*subscrib\w*\s*and\s*comment", pinned, re.IGNORECASE):
        problems.append("[record] pinned_comment is generic engagement bait")

    # ---- MP4
    mp4 = directory / f"{slug}.mp4"
    if not mp4.exists():
        problems.append(f"[mp4] missing {slug}.mp4")
    elif mp4.stat().st_size < 50_000:
        problems.append(f"[mp4] {slug}.mp4 suspiciously small ({mp4.stat().st_size} bytes)")
    else:
        media = probe_media(mp4)
        if media is None:
            problems.append("[mp4] could not probe duration/resolution (ffprobe unavailable)")
        else:
            if (media["width"], media["height"]) != expected_master:
                problems.append(
                    f"[mp4] {media['width']}x{media['height']} does not match "
                    f"{record.get('aspect_ratio')} master "
                    f"{expected_master[0]}x{expected_master[1]}")
            if abs(media["duration"] - float(record.get("duration_seconds", 0))) > META_FLOAT:
                problems.append(
                    f"[mp4] duration {media['duration']:.3f}s != recorded "
                    f"{record.get('duration_seconds')}s")
            auto_landscape = float(record["duration_seconds"]) >= 60.0
            if (record.get("aspect_ratio") == "16:9") != auto_landscape:
                if record.get("format_policy_exception"):
                    notes.append(f"approved format exception: {record['format_policy_exception']}")
                else:
                    problems.append(
                        f"[policy] {record['duration_seconds']}s implies "
                        f"{'16:9' if auto_landscape else '9:16'} but the package is "
                        f"{record.get('aspect_ratio')} and records no format_policy_exception")
            if media["duration"] < 1.0:
                problems.append("[mp4] duration under 1 second — not a finished video")

    # ---- script
    script_path = directory / "script.md"
    if not script_path.exists():
        problems.append("[script] script.md missing")
    else:
        script = script_path.read_text(encoding="utf-8")
        if record.get("title", "") not in script:
            problems.append("[script] script.md does not open with/contain the final title")
        if len(script) < 400:
            problems.append(f"[script] script.md suspiciously short ({len(script)} chars)")
        spoken = narration_of(script)
        spoken_words = words(spoken)
        # Duration-scaled floor: a tight 45s Short legitimately carries ~35 distinct words,
        # while an empty or stub script still fails. ~0.4 distinct words per second of runtime.
        min_words = max(20, int(float(record.get("duration_seconds", 0)) * 0.40))
        if len(spoken_words) < min_words:
            problems.append(
                f"[script] script.md carries {len(spoken_words)} distinct spoken words, "
                f"below the {min_words} expected for a {record.get('duration_seconds')}s master")
        # script must not contradict the record's own summary of the story
        summary_words = words(record.get("summary", "") + " " + record.get("topic", ""))
        if summary_words and len(summary_words & spoken_words) / len(summary_words) < 0.2:
            problems.append("[script] script.md narration barely overlaps the record topic/summary")
        if record.get("duration_seconds") and spoken:
            # ~2.5 spoken words/sec is the engine's rate; allow a wide band
            estimate = len(re.findall(r"[A-Za-z']+", spoken)) / 2.5
            if estimate > float(record["duration_seconds"]) * 1.9:
                problems.append(
                    f"[script] narration (~{estimate:.0f}s at 2.5 wps) far exceeds the "
                    f"{record['duration_seconds']}s master")

    # ---- thumbnail
    thumb = directory / "thumbnail.jpg"
    if not thumb.exists():
        problems.append("[thumbnail] thumbnail.jpg missing")
    else:
        size = thumb.stat().st_size
        if size > MAX_THUMB_BYTES:
            problems.append(f"[thumbnail] {size / 1024 / 1024:.2f} MB exceeds YouTube's 2 MB limit")
        dims = thumbnail_size(thumb)
        if dims is None:
            problems.append("[thumbnail] could not read thumbnail dimensions")
        else:
            want = expected_dims(record.get("aspect_ratio", "9:16"))
            if dims != want:
                problems.append(f"[thumbnail] {dims[0]}x{dims[1]} != required {want[0]}x{want[1]}")
            if min(dims) < 720:
                problems.append("[thumbnail] short edge under 720px — unreadable on mobile")

    # ---- SEO: the package must be findable, not just complete
    try:
        from seo_audit import audit as score_seo
    except ImportError:  # pragma: no cover - run as a script path
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "seo_audit", Path(__file__).resolve().parent / "seo_audit.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        score_seo = module.audit
    seo = score_seo(record)
    if seo["score"] < MIN_SEO_SCORE:
        problems.append(
            f"[seo] metadata scores {seo['score']}/100, below the {MIN_SEO_SCORE} floor — "
            + "; ".join(seo["notes"][:3]))

    # ---- stray files
    present = {p.name for p in directory.iterdir() if p.is_file()}
    allowed = {f"{slug}.mp4"} | ALLOWED_EXTRA_FILES
    for name in sorted(present - allowed):
        problems.append(f"[hygiene] unexpected file in package: {name}")
    for name in sorted(present):
        if TEMP_RE.search(name):
            problems.append(f"[hygiene] temporary/unfinished file present: {name}")

    # ---- index entry
    if index_entry is None:
        problems.append("[index] no entry in videos/index.json")
    else:
        for field in REQUIRED_INDEX_FIELDS:
            if field not in index_entry:
                problems.append(f"[index] missing field '{field}'")
        if index_entry.get("slug") != slug:
            problems.append("[index] slug does not match directory")
        if index_entry.get("directory") != f"videos/{slug}":
            problems.append("[index] directory does not point at videos/" + slug)
        if abs(float(index_entry.get("duration", 0)) - float(record.get("duration_seconds", 0))) > 0.01:
            problems.append("[index] duration disagrees with record.json")
        if index_entry.get("content_fingerprint") != record.get("content_fingerprint"):
            problems.append("[index] content_fingerprint disagrees with record.json")
        if mp4.exists() and script_path.exists() and thumb.exists():
            live = fingerprint_package(directory, slug)
            if live != index_entry.get("content_fingerprint"):
                problems.append(
                    "[index] content_fingerprint is stale — package bytes changed "
                    f"(index {index_entry.get('content_fingerprint')}, live {live})")
    # ---- reproducibility
    # A published film whose only record is its MP4 cannot be re-cut, re-rendered or
    # re-scored: `the-first-plank` had to be re-authored from scratch for exactly this
    # reason. Reported as a note, not a failure — a gate cannot retroactively create a
    # spec, only keep the gap visible so the next production does not repeat it.
    if script_path.exists():
        first = _first_spoken_line(script_path.read_text(encoding="utf-8"))
        if first and first not in spec_index():
            notes.append(
                "no committed episode spec reproduces this master — a re-cut or "
                "re-render would require re-authoring from script.md")
    return problems, notes


def _first_spoken_line(text: str) -> str:
    """The first narration line of a script, normalised for comparison."""
    import re

    for match in re.finditer(r"\*\*[A-Z ]+:\*\*\s*(.+)", text):
        line = match.group(1).strip()
        if line:
            return re.sub(r"[^a-z0-9]+", " ", line.lower()).strip()
    return ""


def spec_index() -> dict:
    """Map first-spoken-line -> episode spec path across every example spec.

    The first line of a cut is unique to that cut, which makes it a far more reliable
    identity than the title: several examples share a title ("The Two-Inch Bridge" has
    three) while their openings differ.
    """
    index: dict = {}
    examples = ROOT / "examples"
    if not examples.is_dir():
        return index
    for path in sorted(examples.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for scene in data.get("scenes", []):
            found = False
            for line in scene.get("dialogue", []):
                text = (line.get("text") or "").strip()
                if text:
                    index.setdefault(_first_spoken_line(f"**NARRATOR:** {text}"), path)
                    found = True
                    break
            if found:
                break
    return index


def validate_all() -> dict:
    index_path = VIDEOS / "index.json"
    report: dict = {"packages": {}, "problems": [], "notes": [], "ok": True}
    if not index_path.exists():
        report["problems"].append("videos/index.json missing")
        report["ok"] = False
        return report
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        report["problems"].append(f"videos/index.json invalid JSON: {exc}")
        report["ok"] = False
        return report

    entries = {v.get("slug"): v for v in index.get("videos", []) if v.get("slug")}
    directories = sorted(p for p in VIDEOS.iterdir() if p.is_dir())

    if not directories:
        report["problems"].append("no completed video packages under videos/")
        report["ok"] = False

    for directory in directories:
        problems, notes = validate_package(directory, entries.get(directory.name))
        report["packages"][directory.name] = problems
        report["problems"].extend(f"{directory.name}: {p}" for p in problems)
        report["notes"].extend(f"{directory.name}: {n}" for n in notes)

    for slug in sorted(set(entries) - {p.name for p in directories}):
        report["problems"].append(f"{slug}: index entry has no package directory")

    if index.get("total_videos") != len(index.get("videos", [])):
        report["problems"].append("index total_videos does not match len(videos)")
    if index.get("total_videos") != len(directories):
        report["problems"].append("index total_videos does not match package directories")

    # duplicate detection: no two packages may describe the same video
    seen_titles: dict[str, str] = {}
    for entry in index.get("videos", []):
        title = (entry.get("title") or "").lower().strip()
        if title in seen_titles:
            report["problems"].append(
                f"duplicate title in index: '{entry.get('title')}' "
                f"({seen_titles[title]} and {entry.get('id')})")
        seen_titles[title] = entry.get("id")
        slug = entry.get("slug") or ""
        if slug in BANNED_FILENAMES:
            report["problems"].append(f"banned filename used as slug: {slug}")

    report["ok"] = not report["problems"]
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit a JSON report")
    args = parser.parse_args(argv)

    report = validate_all()
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for slug, problems in report["packages"].items():
            status = "OK  " if not problems else "FAIL"
            print(f"{status} videos/{slug}/")
            for problem in problems:
                print(f"       - {problem}")
        ungrouped = [p for p in report["problems"] if ":" not in p.split(" ")[0]]
        for problem in ungrouped:
            print(f"FAIL {problem}")
        for note in report["notes"]:
            print(f"note {note}")
        print()
        print("PASS — every video is a complete publishing package" if report["ok"]
              else f"FAIL — {len(report['problems'])} problem(s)")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
