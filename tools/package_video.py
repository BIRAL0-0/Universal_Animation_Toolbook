#!/usr/bin/env python3
"""Assemble the YouTube publishing package for a finished master.

Turns a verified master into the five permanent artifacts required by
[`universal_toolbook/process/09_LEAN_REPOSITORY_POLICY.md`](../universal_toolbook/process/09_LEAN_REPOSITORY_POLICY.md):

    videos/<slug>/
    ├── <slug>.mp4      master, renamed from the project's final.mp4
    ├── script.md       from the project's approved SCRIPT_POLISHED.md (title, scenes, narration)
    ├── thumbnail.jpg   designed thumbnail (required input — never a frame grab)
    └── record.json     title, description, pinned comment, technical metadata
    + the compact entry in videos/index.json

Usage::

    python3 tools/package_video.py projects/<project>/final.mp4 \\
        --slug the-cost-of-doing-nothing \\
        --project projects/<project> \\
        --thumbnail runtime/thumbs/final-001.jpg \\
        --title "The Cost of Doing Nothing" \\
        --description-file runtime/work/<slug>/description.txt \\
        --pinned-comment-file runtime/work/<slug>/pinned.txt \\
        --topic "..." --summary "..." --key-angle "..." \\
        --tags productivity,attention,focus \\
        --format auto

``--format auto`` applies the house policy (`< 60 s → portrait 9:16`, `>= 60 s → landscape 16:9`)
unless the master's pixels already prove a deliberate approved exception, in which case the real
dimensions win and the deviation is recorded in ``record.json``. The tool never overwrites an
existing package without ``--force``, and it always finishes by running
``tools/validate_publishing.py`` so a broken package cannot be reported as delivered.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
VIDEOS = REPO_ROOT / "videos"

PORTRAIT = ("portrait", "9:16", "1080x1920")
LANDSCAPE = ("landscape", "16:9", "1920x1080")


def probe(path: Path) -> dict:
    try:
        import imageio_ffmpeg  # type: ignore

        meta = next(imageio_ffmpeg.read_frames(str(path)))
        return {"width": int(meta["size"][0]), "height": int(meta["size"][1]),
                "duration": float(meta["duration"])}
    except Exception:
        pass
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise SystemExit("cannot probe the master: install imageio-ffmpeg or ffprobe")
    out = subprocess.run(
        [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height:format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    return {"width": int(data["streams"][0]["width"]),
            "height": int(data["streams"][0]["height"]),
            "duration": float(data["format"]["duration"])}


def slugify(title: str) -> str:
    text = title.lower().replace("—", " ").replace("–", " ").replace("&", " and ")
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    text = re.sub(r"\s+", "-", text.strip())
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return re.sub(r"^(the|a|an)-", "", text) if len(text) > 24 else text


def script_from_markdown(markdown: str, title: str, meta: dict) -> str:
    header = [f"# {title}\n", "| Field | Value |\n|---|---|"]
    header += [f"| {key} | {value} |" for key, value in meta.items()]
    body = re.sub(r"^#[^\n]*\n", "", markdown, count=1)  # drop the old H1
    return "\n".join(header) + "\n" + body.lstrip()


def fingerprint(package: Path, slug: str) -> str:
    digest = hashlib.sha256()
    for name in (f"{slug}.mp4", "script.md", "thumbnail.jpg"):
        with (package / name).open("rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
    return "sha256:" + digest.hexdigest()[:32]


def load_index() -> dict:
    path = VIDEOS / "index.json"
    if not path.exists():
        return {"catalog_version": "2.0.0", "last_updated": "", "total_videos": 0, "videos": []}
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("master", type=Path, help="verified master MP4 (e.g. projects/<p>/final.mp4)")
    ap.add_argument("--slug", default=None, help="publishing slug (default: from --title)")
    ap.add_argument("--project", type=Path, default=None,
                    help="project folder holding SCRIPT_POLISHED.md and episode.json")
    ap.add_argument("--thumbnail", type=Path, required=True,
                    help="designed thumbnail (see tools/make_thumbnail.py)")
    ap.add_argument("--script", type=Path, default=None,
                    help="approved script markdown (default: <project>/SCRIPT_POLISHED.md)")
    ap.add_argument("--title", required=True)
    ap.add_argument("--description-file", type=Path, required=True)
    ap.add_argument("--pinned-comment-file", type=Path, required=True)
    ap.add_argument("--topic", required=True)
    ap.add_argument("--summary", required=True)
    ap.add_argument("--key-angle", required=True)
    ap.add_argument("--tags", default="", help="comma-separated")
    ap.add_argument("--id", default=None, help="video id (default: next free video-NNN)")
    ap.add_argument("--format", choices=["auto", "portrait", "landscape"], default="auto")
    ap.add_argument("--production-version", default="3.0.0")
    ap.add_argument("--allow-duplicate", default=None,
                    help="id/slug/title of an existing video this one is a requested remake of")
    ap.add_argument("--force", action="store_true", help="replace an existing package")
    ap.add_argument("--no-validate", action="store_true")
    args = ap.parse_args(argv)

    master = args.master if args.master.is_absolute() else (REPO_ROOT / args.master)
    if not master.exists():
        raise SystemExit(f"master not found: {master}")
    slug = args.slug or slugify(args.title)
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", slug):
        raise SystemExit(f"slug '{slug}' is not lowercase-hyphenated")

    for label, path in (("thumbnail", args.thumbnail),
                        ("description", args.description_file),
                        ("pinned comment", args.pinned_comment_file)):
        candidate = path if path.is_absolute() else REPO_ROOT / path
        if not candidate.exists():
            raise SystemExit(f"{label} file not found: {candidate}")

    # ---- duplicate gate: never index a second video about the same premise
    sys.path.insert(0, str(REPO_ROOT / "universal_toolbook" / "config"))
    from duplicate_detection import check_duplicate  # noqa: E402

    is_dup, overlap, reason = check_duplicate({
        "title": args.title,
        "topic": args.topic,
        "summary": args.summary,
        "key_angle": args.key_angle,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
    }, repo_root=str(REPO_ROOT), allow_remake=args.allow_duplicate)
    if is_dup:
        raise SystemExit(
            f"duplicate of {overlap.get('id')} ('{overlap.get('title')}'): {reason}\n"
            "Publish a genuinely different premise, or pass --allow-duplicate <id> if the user "
            "explicitly asked for a sequel/remake.")

    package = VIDEOS / slug
    if package.exists() and not args.force:
        raise SystemExit(f"videos/{slug}/ already exists — pass --force to replace it")

    media = probe(master)
    fmt = PORTRAIT if media["height"] > media["width"] else LANDSCAPE
    policy_fmt = PORTRAIT if media["duration"] < 60.0 else LANDSCAPE
    exception = None
    if args.format != "auto" and args.format != fmt[0]:
        raise SystemExit(f"master pixels are {media['width']}x{media['height']} "
                         f"({fmt[0]}) but --format {args.format} was requested")
    if fmt != policy_fmt:
        exception = (f"{media['duration']:.2f}s under the auto policy implies {policy_fmt[0]} "
                     f"{policy_fmt[1]}; this master is {fmt[0]} {fmt[1]} and was approved as such")

    # ---- script.md
    script_src = args.script or ((args.project or Path()) / "SCRIPT_POLISHED.md")
    script_src = script_src if script_src.is_absolute() else REPO_ROOT / script_src
    if not script_src.exists():
        raise SystemExit(f"approved script not found: {script_src}\n"
                         "pass --script <path to the final approved script markdown>")
    header = {
        "Slug": f"`{slug}`",
        "Format": f"**{fmt[0]}** — {fmt[1]}",
        "Resolution": f"{media['width']}x{media['height']}",
        "Duration": f"{media['duration']:.2f} s",
        "Production version": args.production_version,
        "Packaged": dt.date.today().isoformat(),
    }
    script_md = script_from_markdown(script_src.read_text(encoding="utf-8"), args.title, header)

    description = (args.description_file if args.description_file.is_absolute()
                   else REPO_ROOT / args.description_file).read_text(encoding="utf-8").strip()
    pinned = (args.pinned_comment_file if args.pinned_comment_file.is_absolute()
              else REPO_ROOT / args.pinned_comment_file).read_text(encoding="utf-8").strip()
    tags = [tag.strip() for tag in args.tags.split(",") if tag.strip()]

    package.mkdir(parents=True, exist_ok=True)
    shutil.copy2(master, package / f"{slug}.mp4")
    (package / "script.md").write_text(script_md, encoding="utf-8")
    shutil.copy2(args.thumbnail if args.thumbnail.is_absolute() else REPO_ROOT / args.thumbnail,
                 package / "thumbnail.jpg")

    index = load_index()
    video_id = args.id or f"video-{len(index.get('videos', [])) + 1:03d}"
    record = {
        "id": video_id,
        "slug": slug,
        "title": args.title,
        "filename": f"{slug}.mp4",
        "script": "script.md",
        "thumbnail": "thumbnail.jpg",
        "youtube_description": description,
        "pinned_comment": pinned,
        "format": fmt[0],
        "aspect_ratio": fmt[1],
        "resolution": f"{media['width']}x{media['height']}",
        "duration_seconds": round(media["duration"], 3),
        "created_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "topic": args.topic,
        "summary": args.summary,
        "key_angle": args.key_angle,
        "tags": tags,
        "production_version": args.production_version,
        "status": "completed",
        "directory": f"videos/{slug}",
        "video_path": f"videos/{slug}/{slug}.mp4",
        "format_policy_exception": exception,
    }
    fingerprint_value = fingerprint(package, slug)
    record["content_fingerprint"] = fingerprint_value
    # legacy aliases so older tooling keeps working
    record["duration_sec"] = record["duration_seconds"]
    record["final_video"] = record["filename"]
    record["script_summary"] = args.summary
    (package / "record.json").write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n",
                                         encoding="utf-8")

    index["videos"] = [v for v in index.get("videos", []) if v.get("slug") != slug]
    index["videos"].append({
        "id": video_id,
        "title": args.title,
        "slug": slug,
        "topic": args.topic,
        "summary": args.summary,
        "key_angle": args.key_angle,
        "duration": record["duration_seconds"],
        "format": fmt[0],
        "aspect_ratio": fmt[1],
        "resolution": record["resolution"],
        "produced_at": dt.date.today().isoformat(),
        "directory": f"videos/{slug}",
        "content_fingerprint": fingerprint_value,
        "duration_sec": record["duration_seconds"],
        "status": "completed",
        "created_at": dt.date.today().isoformat(),
        "final_video": record["filename"],
        "script_summary": args.summary,
        "tags": tags,
        "production_version": args.production_version,
    })
    index["videos"].sort(key=lambda entry: entry["id"])
    index["total_videos"] = len(index["videos"])
    index["last_updated"] = dt.date.today().isoformat()
    (VIDEOS / "index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"packaged videos/{slug}/ ({record['resolution']}, {record['duration_seconds']}s, "
          f"{fmt[0]})")
    if exception:
        print(f"note: {exception}")

    if not args.no_validate:
        result = subprocess.run([sys.executable, str(REPO_ROOT / "tools" /
                                                   "validate_publishing.py")],
                                cwd=REPO_ROOT)
        if result.returncode != 0:
            raise SystemExit("publishing validation FAILED — the package is not complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
