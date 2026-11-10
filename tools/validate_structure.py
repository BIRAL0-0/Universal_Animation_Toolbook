#!/usr/bin/env python3
"""Gate for the one-authoritative-location repository layout.

Checks (all run on the tracked tree, not on whatever happens to be in the working directory):

  1. Required files and directories exist.
  2. No tracked runtime/cache/build artifacts (only runtime/README.md may be tracked).
  3. No generated media in source directories; durable deliverables and project masters are
     explicitly allow-listed by location.
  4. Exactly one master video-production prompt exists, and duplicated instruction copies are
     short redirects rather than second rule sets.
  5. Every skill named in AGENTS.md's activation map exists, with the required frontmatter and
     a substantive body; no decorative empty skill.
  6. Every historical project has the required source/QA structure.
  7. New canonical docs do not quote superseded paths (historical archives are exempt).
  8. Required CI commands reference existing entry points.

Usage: python3 tools/validate_structure.py [--json]
"""
from __future__ import annotations

import re

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_FILES = (
    "README.md", "AGENTS.md", "CHANGELOG.md", "CONTRIBUTING.md", "LICENSE",
    "docs/architecture/SYSTEM_OVERVIEW.md", "docs/architecture/ENGINE_MODULES.md",
    "docs/architecture/DEPENDENCY_MAP.md", "docs/architecture/RENDERING_PIPELINE.md",
    "docs/architecture/AUDIO_TTS_PIPELINE.md", "docs/architecture/DECISIONS.md",
    "docs/architecture/BASELINE_INVENTORY.md",
    "docs/architecture/MIGRATION_REPORT.md", "docs/architecture/FINAL_TREE.md",
    "docs/development/VALIDATION_REPORT.md",
    "docs/getting-started/INSTALL.md", "docs/getting-started/FIRST_VIDEO.md",
    "docs/development/CODE_ORGANIZATION.md", "docs/development/TESTING.md",
    "docs/development/ENVIRONMENT_REPORT.md", "docs/development/ROADMAP.md",
    "docs/production/INDEX.md", "docs/production/COMPLETE_WORKFLOW.md",
    "docs/production/prompts/VOICEOVER_POLISH_PROMPT.md",
    "docs/troubleshooting/INDEX.md", "docs/decisions/README.md",
    "docs/decisions/ADR-0001-remotion-evaluation.md",
    "docs/decisions/ADR-0002-engine-layout.md",
    "docs/decisions/ADR-0003-repository-layout.md",
    "skills/README.md", "skills/animation-production/SKILL.md",
    "skills/character-design-and-rigging/SKILL.md",
    "skills/stickman-animation/SKILL.md",
    "skills/physical-interactions-and-props/SKILL.md",
    "skills/animation-principles/SKILL.md",
    "skills/cinematic-composition/SKILL.md",
    "skills/environment-and-asset-continuity/SKILL.md",
    "skills/subtitles-and-typography/SKILL.md",
    "skills/animation-scriptwriting/SKILL.md",
    "skills/youtube-storytelling-and-hooks/SKILL.md",
    "skills/sound-design/SKILL.md",
    "skills/animation-quality-assurance/SKILL.md",
    "skills/scriptwriting/SKILL.md",
    "skills/voiceover-audio/SKILL.md", "skills/youtube-research/SKILL.md",
    "skills/production-quality/SKILL.md",
    "templates/MASTER_VIDEO_PRODUCTION_PROMPT.md",
    "universal_toolbook/run_studio.py", "universal_toolbook/config/studio_config.json",
    "universal_toolbook/tts/config/voices.json",
    "universal_toolbook/templates/episode_minimal.json",
    "universal_toolbook/README.md", "universal_toolbook/process/README.md",
    "tests/README.md", "tests/integration/test_studio_pipeline.py",
    "tests/regression/run_all_tests.js", "tools/README.md",
    "tools/validate_structure.py", "tools/check_docs.py", "tools/check_workflows.py",
    "tools/validate_specs.py", "scripts/new_project.py",
    "scripts/verify_fresh_checkout.py", "scripts/README.md",
    ".github/workflows/verify.yml", "videos/index.json",
    "runtime/README.md",
)
REQUIRED_DIRS = (
    "universal_toolbook/engine", "universal_toolbook/tts", "universal_toolbook/assets",
    "universal_toolbook/process", "skills", "docs/architecture", "docs/getting-started",
    "docs/development", "docs/production", "docs/troubleshooting", "docs/decisions",
    "videos", "examples", "templates", "tests/unit", "tests/integration",
    "tests/regression", "tests/production", "tests/fixtures", "tools", "scripts",
    "runtime",
)
SKILLS = (
    "youtube-research", "youtube-storytelling-and-hooks", "scriptwriting",
    "animation-scriptwriting", "character-design-and-rigging", "stickman-animation",
    "physical-interactions-and-props", "animation-principles", "cinematic-composition",
    "environment-and-asset-continuity", "subtitles-and-typography", "sound-design",
    "animation-quality-assurance", "animation-production", "voiceover-audio",
    "production-quality",
)
# Historical projects predate the template's directory names; accept equivalent evidence.
PROJECT_REQUIRED_GROUPS = (
    ("PROMPT.md",), ("SCRIPT_ORIGINAL.md",), ("SCRIPT_POLISHED.md",),
    ("SCRIPT_CHANGELOG.md",), ("STORYBOARD.md", "storyboard/"),
    ("CHARACTERS.md", "characters/"), ("SCENE_PLAN.md", "SCENE_PLAN.json"),
    ("ASSET_MANIFEST.json",), ("PRODUCTION_LOG.md",), ("QA_REPORT.md",),
    ("episode.json",),
)
MEDIA_EXT = {".mp4", ".mov", ".mkv", ".wav", ".mp3", ".ogg", ".flac", ".webm", ".png",
             ".jpg", ".jpeg", ".gif", ".webp", ".npz", ".onnx"}
SOURCE_MEDIA_ALLOW = (
    "universal_toolbook/assets/",             # bundled fonts/BGM/licences are kit assets
    "videos/",                                # lean durable completed video outputs
    "deliverables/",                          # legacy durable benchmark/release evidence
    "projects/",                              # independent per-video source/evidence
)
TRACKED_BAD = (
    ".venv/", "node_modules/", "__pycache__/", ".pytest_cache/",
    "runtime/cache/", "runtime/work/", "runtime/renders/", "runtime/previews/",
    "runtime/logs/", "output/", "work/", "cache/", ".work_",
)
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PROTECTED_PROMPT_HASH = "aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea"
LEGACY_PATHS = (
    "docs/production-workflow/", "outputs/", "downloads/",
    "universal_toolbook/MASTER_PROMPT.md", "universal_toolbook/00_START_HERE.md",
    "universal_toolbook/process/SESSION_PROMPT.md",
    "universal_toolbook/process/REPO_MAP.md", "tests/run_all_tests.js",
    "tests/test_studio_pipeline.py",
)
HISTORICAL_DOC_PREFIXES = (
    "docs/architecture/BASELINE_INVENTORY.md", "docs/architecture/MIGRATION_REPORT.md",
    "docs/architecture/FINAL_TREE.md", "docs/development/VALIDATION_REPORT.md",
    "docs/production/WORKFLOW_CHANGELOG.md", "projects/", "deliverables/", "CHANGELOG.md",
)
REPORT_DOCS = (
    "docs/architecture/MIGRATION_REPORT.md", "docs/architecture/FINAL_TREE.md",
    "docs/development/VALIDATION_REPORT.md", "CHANGELOG.md",
)
UNRESOLVED_PLACEHOLDER = re.compile(r"\{\{[A-Z_]+\}\}")


def tracked_paths() -> list[str]:
    """Tracked paths plus untracked non-ignored files (for a pre-commit local run)."""
    out = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT, text=True,
    )
    return sorted({line for line in out.splitlines()
                   if line and (ROOT / line).exists()})


def problems() -> list[str]:
    p: list[str] = []
    tracked = tracked_paths()
    tracked_set = set(tracked)

    for rel in REQUIRED_FILES:
        if not (ROOT / rel).is_file():
            p.append(f"missing required file: {rel}")
    for rel in REQUIRED_DIRS:
        if not (ROOT / rel).is_dir():
            p.append(f"missing required directory: {rel}")

    for rel in REPORT_DOCS:
        f = ROOT / rel
        if f.is_file() and UNRESOLVED_PLACEHOLDER.search(f.read_text(encoding="utf-8")):
            p.append(f"unresolved report placeholder: {rel}")

    for rel in tracked:
        if rel.startswith("runtime/") and rel != "runtime/README.md":
            p.append(f"tracked runtime artifact: {rel}")
        if any(rel.startswith(pre) or pre in rel for pre in TRACKED_BAD):
            p.append(f"tracked generated/cache path: {rel}")
        if rel.endswith((".pyc", ".pyo")) or ".work_" in rel:
            p.append(f"tracked generated file: {rel}")
        if Path(rel).suffix.lower() in MEDIA_EXT and not rel.startswith(SOURCE_MEDIA_ALLOW):
            p.append(f"generated media outside deliverables/projects/kit assets: {rel}")

    # One authoritative master prompt; redirects must stay short.
    masters = [r for r in tracked if "MASTER_VIDEO_PRODUCTION_PROMPT" in r or
               r.endswith("MASTER_PROMPT.md")]
    if masters != ["templates/MASTER_VIDEO_PRODUCTION_PROMPT.md"]:
        p.append(f"expected one master prompt, found: {masters}")
    for rel in ("START_HERE.md", "AGENT_OPERATING_RULES.md"):
        f = ROOT / rel
        if not f.is_file():
            p.append(f"missing redirect: {rel}")
        elif len(f.read_text(encoding="utf-8").splitlines()) > 40:
            p.append(f"redirect has become a competing instruction file: {rel}")

    # Protected voiceover polish prompt.
    import hashlib
    polish = ROOT / "docs/production/prompts/VOICEOVER_POLISH_PROMPT.md"
    if polish.is_file():
        digest = hashlib.sha256(polish.read_bytes()).hexdigest()
        if digest != PROTECTED_PROMPT_HASH:
            p.append(f"protected polish prompt changed: {digest}")

    # Skills must exist, be non-decorative and referenced from AGENTS.md.
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8") if (ROOT / "AGENTS.md").is_file() else ""
    for name in SKILLS:
        f = ROOT / "skills" / name / "SKILL.md"
        if not f.is_file():
            p.append(f"missing skill: skills/{name}/SKILL.md")
            continue
        body = f.read_text(encoding="utf-8")
        if not body.startswith("---\n") or "name:" not in body[:400] or \
           "description:" not in body[:600]:
            p.append(f"skill missing usable frontmatter: skills/{name}/SKILL.md")
        if len(body.splitlines()) < 25:
            p.append(f"decorative/empty skill: skills/{name}/SKILL.md")
        if f"skills/{name}/SKILL.md" not in agents:
            p.append(f"AGENTS.md activation map does not reference skills/{name}/SKILL.md")

    # Durable completed videos are publishing packages:
    #   videos/<slug>/<slug>.mp4 + script.md + thumbnail.jpg + record.json
    video_dirs = sorted({rel.split("/")[1] for rel in tracked
                         if rel.startswith("videos/") and rel.count("/") >= 2})
    if not video_dirs:
        p.append("videos/ contains no completed video archives")
    for vslug in video_dirs:
        if not SLUG_RE.match(vslug):
            p.append(f"video archive directory is not a descriptive slug: videos/{vslug}/")
        for req in (f"{vslug}.mp4", "script.md", "thumbnail.jpg", "record.json"):
            if f"videos/{vslug}/{req}" not in tracked_set:
                p.append(f"video archive {vslug} missing required file: {req}")
        for banned in ("final.mp4", "output.mp4", "video1.mp4", "movie.mp4"):
            if f"videos/{vslug}/{banned}" in tracked_set:
                p.append(f"video archive {vslug} uses generic filename: {banned}")

    # Project structure: source/QA files, not just a media dump.
    project_dirs = sorted({rel.split("/")[1] for rel in tracked
                           if rel.startswith("projects/") and rel.count("/") >= 2})
    for slug in project_dirs:
        base = f"projects/{slug}/"
        for alternatives in PROJECT_REQUIRED_GROUPS:
            if not any(r.startswith(base) and any(
                    needle in r or (needle.endswith("/") and r.startswith(base + needle))
                    for needle in alternatives) for r in tracked):
                p.append(f"project {slug} missing required evidence: {alternatives[0]}")

    # Canonical docs must not recommend superseded paths; historical records may quote them.
    for rel in tracked:
        if not rel.endswith(".md") or rel.startswith(HISTORICAL_DOC_PREFIXES):
            continue
        text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        for legacy in LEGACY_PATHS:
            if legacy in text:
                p.append(f"canonical doc quotes superseded path {legacy}: {rel}")

    # CI must use current entry points.
    ci = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
    for rel in ("tests/regression/run_all_tests.js", "tests/integration/test_studio_pipeline.py",
                "tools/validate_structure.py", "runtime/"):
        if rel not in ci:
            p.append(f"CI missing current gate/path: {rel}")
    for stale in ("tests/run_all_tests.js", "tests/test_studio_pipeline.py", "mkdir -p work"):
        if re.search(r"(?<![/\w])" + re.escape(stale), ci):
            p.append(f"CI still uses stale path: {stale}")

    # No runtime dependency from the self-contained kit to repo-level dev tools.
    kit_py = [r for r in tracked if r.startswith("universal_toolbook/") and r.endswith(".py")]
    tools_import = re.compile(
        r"^\s*(?:from\s+(tools(?:\.[\w.]+)?)\s+import|import\s+(tools(?:\.[\w.]+)?))",
        re.M,
    )
    for rel in kit_py:
        body = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        for match in tools_import.finditer(body):
            module = match.group(1) or match.group(2)
            # universal_toolbook/ is inserted at sys.path[0] by run_studio.py/setup_tts.py,
            # so `tools.script_helper` is the kit's own helper, not repo-level tools/.
            local = ROOT / "universal_toolbook" / (module.replace(".", "/") + ".py")
            if module == "tools" and (ROOT / "universal_toolbook" / "tools").is_dir():
                continue
            if not local.is_file():
                p.append(f"kit depends on repo-level tools package: {rel} imports {module}")
    return p


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    found = problems()
    if args.json:
        print(json.dumps({"valid": not found, "problems": found}, indent=2))
    elif found:
        print(f"STRUCTURE CHECK FAILED: {len(found)} problem(s)")
        for item in found:
            print("  " + item)
    else:
        print(f"STRUCTURE CHECK OK: {len(REQUIRED_FILES)} required files, "
              f"{len(REQUIRED_DIRS)} required dirs, {len(SKILLS)} skills")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
