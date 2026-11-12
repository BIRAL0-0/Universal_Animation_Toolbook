#!/usr/bin/env python3
"""Create a new, independent video project from the authoritative templates.

Usage::

    python3 scripts/new_project.py video-003-topic --title "Your title" \
        --format "9:16" --runtime "60 s"

The generator refuses to overwrite an existing project, saves the customised master prompt
**first**, writes every artifact required by
``templates/VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md``, and derives ``SCENE_PLAN.json`` from the
copied ``episode.json`` so the two cannot drift. It does not invent research, a script, a render or
a QA result: those are production stages owned by the skills.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "templates" / "MASTER_VIDEO_PRODUCTION_PROMPT.md"
MINIMAL_SPEC = ROOT / "universal_toolbook" / "templates" / "episode_minimal.json"
SCENE_PLAN_TOOL = ROOT / "tools" / "make_scene_plan.py"

REQUIRED = (
    "PROMPT.md", "RESEARCH.md", "TOPIC_SELECTION.md", "SCRIPT_ORIGINAL.md",
    "SCRIPT_POLISHED.md", "SCRIPT_CHANGELOG.md", "STORYBOARD.md", "CHARACTERS.md",
    "SCENE_PLAN.json", "VOICEOVER.md", "ASSET_MANIFEST.json", "PRODUCTION_LOG.md",
    "QA_REPORT.md", "episode.json",
)
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


def _write(path: Path, text: str) -> None:
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


_PROJECT_TITLE = "{{TITLE}}"


def _placeholder(name: str, body: str, title: str | None = None) -> str:
    heading = title or _PROJECT_TITLE
    return f"# {name} — {heading}\n\n> Status: PENDING. Fill this during the matching production stage.\n\n{body}\n"


def _scene_plan(spec: dict) -> dict:
    module_spec = importlib.util.spec_from_file_location("make_scene_plan", SCENE_PLAN_TOOL)
    if module_spec is None or module_spec.loader is None:
        raise RuntimeError(f"cannot load {SCENE_PLAN_TOOL}")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module.plan_from_spec(spec)


def _parse_runtime_seconds(runtime: str) -> float | None:
    s = str(runtime or "").strip().lower()
    if not s or s == "to be decided":
        return None
    colon = re.search(r"(\d+):(\d+(?:\.\d+)?)", s)
    if colon:
        return int(colon.group(1)) * 60.0 + float(colon.group(2))
    m_min = re.search(r"(\d+(?:\.\d+)?)\s*(?:min|minute|minutes|m)\b", s)
    if m_min:
        return float(m_min.group(1)) * 60.0
    m_sec = re.search(r"(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?\b", s)
    if m_sec:
        return float(m_sec.group(1))
    return None


def create(slug: str, title: str, fmt: str, runtime: str, projects_dir: Path) -> dict:
    global _PROJECT_TITLE
    _PROJECT_TITLE = title
    if not SLUG_RE.fullmatch(slug):
        raise ValueError("slug must match ^[a-z0-9][a-z0-9._-]*$")
    for required in (MASTER, MINIMAL_SPEC, SCENE_PLAN_TOOL):
        if not required.is_file():
            raise FileNotFoundError(f"missing template/tool: {required}")

    parsed_sec = _parse_runtime_seconds(runtime)
    if fmt == "auto" and parsed_sec is not None:
        fmt = "9:16 1080x1920" if parsed_sec < 60.0 else "16:9 1920x1080"
    elif fmt == "auto":
        fmt = "16:9 1920x1080"

    dest = projects_dir / slug
    if dest.exists():
        raise FileExistsError(f"project already exists, refusing to overwrite: {dest}")
    dest.mkdir(parents=True)
    for sub in ("assets", "audio", "renders"):
        folder = dest / sub
        folder.mkdir()
        _write(folder / ".gitkeep", "")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # 1. The video-specific prompt is saved BEFORE anything else is produced.
    prompt = MASTER.read_text(encoding="utf-8")
    prompt = (prompt.replace("{{SLUG}}", slug)
                    .replace("{{TITLE}}", title)
                    .replace("{{TARGET_RUNTIME}}", runtime)
                    .replace("{{ASPECT_AND_RESOLUTION}}", fmt))
    _write(dest / "PROMPT.md", prompt)

    _write(dest / "RESEARCH.md", _placeholder(
        "RESEARCH",
        "Sections: sources with access dates · evidence table with [M]/[O]/[P] labels · "
        "confidence column · facts cleared for narration · rejected claims.\n\n"
        "See `skills/youtube-research/SKILL.md` and `docs/production/IDEA_RESEARCH.md`."))
    _write(dest / "TOPIC_SELECTION.md", _placeholder(
        "TOPIC SELECTION",
        "Chosen topic, rejected alternatives, 10-criterion score and rationale. "
        "See `docs/production/VIRAL_POTENTIAL_EVALUATION.md`."))
    _write(dest / "SCRIPT_ORIGINAL.md", _placeholder(
        "SCRIPT ORIGINAL", "Paste the exact user-supplied script or the first complete draft."))
    _write(dest / "SCRIPT_POLISHED.md", _placeholder(
        "SCRIPT POLISHED",
        "TTS-ready narration. Polish with `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` "
        "byte-for-byte; copy the approved text verbatim into `episode.json`."))
    _write(dest / "SCRIPT_CHANGELOG.md", _placeholder(
        "SCRIPT CHANGELOG", "For each change: line touched · before → after · justifying rule."))
    _write(dest / "STORYBOARD.md", _placeholder(
        "STORYBOARD",
        "| # | Scene | Environment | Objective | Characters | Key actions | Board / prop | "
        "Narration segment | SFX | Transition |\n"
        "|---|---|---|---|---|---|---|---|---|---|\n"
        "| S01 | | | | | | | | | | |"))
    _write(dest / "CHARACTERS.md", _placeholder(
        "CHARACTERS",
        "Mirror `episode.json` → `cast` exactly. Maximum two characters per scene."))
    _write(dest / "VOICEOVER.md", _placeholder(
        "VOICEOVER",
        "Default: Kokoro `am_michael`; preferred secondary `af_bella`. Record the engine, "
        "voice, rate, pitch and the `voice_backend` actually reported by the render."))
    _write(dest / "PRODUCTION_LOG.md",
           f"# PRODUCTION LOG — {slug}\n\n"
           f"- {stamp} · project created from `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`.\n"
           "- PROMPT.md saved before production. Remaining stages are PENDING.\n"
           "- Record every deviation from the saved prompt here, with a reason.\n")
    _write(dest / "QA_REPORT.md",
           f"# QA REPORT — {slug}\n\nStatus: **PENDING** (no render has been produced).\n\n"
           "Gates to record with evidence: validate `warnings: []` · inspected stills · draft · "
           "master `voiced: true` · full decode · container measurements · ≥6 inspected frames · "
           "audio peak/RMS · mute legibility · repository checks. See "
           "`skills/production-quality/SKILL.md`. Never mark a gate passed without a produced file.\n")

    manifest = {
        "project": slug,
        "title": title,
        "status": "pending",
        "assets": [],
        "music": [],
        "licence_note": "Record licence and attribution for every audio asset used; see universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md.",
    }
    _write(dest / "ASSET_MANIFEST.json", json.dumps(manifest, indent=2))

    spec = json.loads(MINIMAL_SPEC.read_text(encoding="utf-8"))
    spec.pop("channel_name", None)  # house rule: new project specs omit the key entirely
    spec["title"] = title
    spec["thesis"] = "{{THESIS}}"
    _write(dest / "episode.json", json.dumps(spec, indent=2))
    _write(dest / "SCENE_PLAN.json", json.dumps(_scene_plan(spec), indent=2))

    missing = [name for name in REQUIRED if not (dest / name).is_file()]
    if missing:
        raise RuntimeError(f"project generation incomplete: {missing}")
    return {"project": str(dest.relative_to(ROOT) if dest.is_relative_to(ROOT) else dest),
            "slug": slug, "title": title, "format": fmt, "runtime": runtime,
            "files": list(REQUIRED), "prompt_saved_first": True, "created": stamp}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug", help="new folder name, e.g. video-003-topic")
    ap.add_argument("--title", required=True)
    ap.add_argument("--format", default="16:9 1920x1080")
    ap.add_argument("--runtime", default="to be decided")
    ap.add_argument("--projects-dir", type=Path, default=ROOT / "projects",
                    help="override for tests; production default is <repo>/projects")
    args = ap.parse_args()
    try:
        result = create(args.slug, args.title, args.format, args.runtime,
                        args.projects_dir.resolve())
    except (ValueError, FileExistsError, FileNotFoundError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
