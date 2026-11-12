"""Repository hygiene regression tests for the autonomous production system.

These guard the *permanent* rules that a single video must not be allowed to erode:

1. **No channel name anywhere.** The client's instruction (2026-11-09) is that no
   channel name may appear in the repository. The engine keeps ``channel_name`` as an
   optional watermark field, but its value must always be the empty string, and new
   project specs must omit it entirely. Any non-empty value is a regression.
2. **The voiceover polishing prompt is byte-for-byte immutable.** It is the
   repository's authoritative script-editing standard; a silent rewrite would
   quietly weaken every future script.
3. **Every video project keeps its full archive.** A project folder missing its
   prompt, research, scripts or QA report is a project that cannot be reproduced.
4. **The master production template exists** and still carries the sections a new
   video must inherit.

Run with pytest from the repository root, or directly::

    .venv/bin/python tests/production/test_repo_hygiene.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

#: sha256 of docs/production/prompts/VOICEOVER_POLISH_PROMPT.md, recorded when the
#: rule was codified. If the standard is ever *deliberately* revised, update this constant AND
#: record the revision in CHANGELOG.md — never silently.
POLISH_PROMPT_SHA256 = "d6aa621f2147aecf756bc61dcb9355e1ab656dad2fb698fb85b29dac1c8006ef"
POLISH_PROMPT_BYTES = 7643

POLISH_PROMPT_PATH = REPO_ROOT / "docs" / "production" / "prompts" / "VOICEOVER_POLISH_PROMPT.md"

#: Files every project under projects/ must contain to be considered reproducible.
REQUIRED_PROJECT_FILES = [
    "PROMPT.md",
    "RESEARCH.md",
    "TOPIC_SELECTION.md",
    "SCRIPT_ORIGINAL.md",
    "SCRIPT_POLISHED.md",
    "SCRIPT_CHANGELOG.md",
    "STORYBOARD.md",
    "CHARACTERS.md",
    "SCENE_PLAN.json",
    "VOICEOVER.md",
    "ASSET_MANIFEST.json",
    "PRODUCTION_LOG.md",
    "QA_REPORT.md",
    "episode.json",
]

SKIP_DIRS = {
    ".git", ".venv", "venv", "node_modules", ".cache", "cache", "__pycache__",
    ".next", "dist", "build", ".mypy_cache", ".pytest_cache", ".ruff_cache",
}


def _iter_json_files():
    for p in REPO_ROOT.rglob("*.json"):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        yield p


# ---------------------------------------------------------------- 1. channel name
def test_no_channel_name_anywhere():
    """No non-empty channel_name value may exist in any JSON file in the repo."""
    offenders = []
    for path in _iter_json_files():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        found = _find_channel_names(data)
        if found:
            offenders.append(f"{path.relative_to(REPO_ROOT)}: {found!r}")
    assert not offenders, (
        "A channel name must never be stored in the repository. "
        f"Found non-empty channel_name value(s): {offenders}"
    )


def _find_channel_names(node, trail=""):
    """Recursively collect non-empty channel_name values."""
    hits = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "channel_name" and isinstance(v, str) and v.strip():
                hits.append(v.strip())
            else:
                hits.extend(_find_channel_names(v, f"{trail}.{k}"))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            hits.extend(_find_channel_names(v, f"{trail}[{i}]"))
    return hits


def test_project_specs_omit_channel_name_key():
    """New project episode specs must omit the key entirely (not just blank it)."""
    projects = REPO_ROOT / "projects"
    if not projects.exists():
        return
    for spec in projects.rglob("episode.json"):
        data = json.loads(spec.read_text(encoding="utf-8"))
        assert "channel_name" not in data, (
            f"{spec.relative_to(REPO_ROOT)} must not carry a channel_name key at all; "
            "the watermark field is left to the engine default (empty)."
        )


# ---------------------------------------------------------------- 2. polish prompt
def test_voiceover_polish_prompt_is_byte_for_byte_intact():
    assert POLISH_PROMPT_PATH.exists(), f"missing {POLISH_PROMPT_PATH}"
    raw = POLISH_PROMPT_PATH.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == POLISH_PROMPT_SHA256, (
        "The voiceover polishing prompt changed. It is a process standard and must be "
        "preserved byte-for-byte. If the revision is deliberate, record it in "
        "CHANGELOG.md and update POLISH_PROMPT_SHA256 "
        f"here. got={digest}"
    )
    assert len(raw) == POLISH_PROMPT_BYTES, "polish prompt byte length changed"


# ---------------------------------------------------------------- 3. project archive
def test_every_project_has_a_complete_archive():
    projects = REPO_ROOT / "projects"
    if not projects.exists():
        return
    dirs = sorted(d for d in projects.iterdir() if d.is_dir())
    assert dirs, "projects/ exists but contains no video projects"
    for d in dirs:
        missing = [name for name in REQUIRED_PROJECT_FILES if not (d / name).exists()]
        assert not missing, (
            f"project {d.name} is not reproducible — missing: {missing}. "
            "See templates/MASTER_VIDEO_PRODUCTION_PROMPT.md for the required archive."
        )


# ---------------------------------------------------------------- 4. master template
def test_master_template_exists_with_required_sections():
    path = REPO_ROOT / "templates" / "MASTER_VIDEO_PRODUCTION_PROMPT.md"
    assert path.exists(), "templates/MASTER_VIDEO_PRODUCTION_PROMPT.md is missing"
    text = path.read_text(encoding="utf-8")
    for needle in (
        "projects/",
        "PROMPT.md",
        "RESEARCH.md",
        "SCRIPT_POLISHED.md",
        "VOICEOVER_POLISH_PROMPT.md",
        "KNOWN_ISSUES.md",
        "LESSONS_LEARNED.md",
        "PIPELINE_CHANGELOG.md",
        "AGENTS.md",
        "skills/animation-production/SKILL.md",
    ):
        assert needle in text, f"master template no longer references {needle}"


def test_automatic_video_creation_rule_is_wired_into_agent_instructions():
    """A bare 'create a video' request must auto-invoke the workflow from the single rule file."""
    path = REPO_ROOT / "AGENTS.md"
    assert path.exists(), "AGENTS.md is missing"
    text = path.read_text(encoding="utf-8")
    for needle in ("Create a new video", "Automatic video creation mode", "projects/",
                   "skills/animation-production/SKILL.md", "am_michael"):
        assert needle in text, f"AGENTS.md no longer mentions {needle}"
    start = REPO_ROOT / "START_HERE.md"
    assert start.exists()
    assert "AGENTS.md" in start.read_text(encoding="utf-8"), (
        "START_HERE.md redirect must point at AGENTS.md so every session loads the rule"
    )
    legacy = REPO_ROOT / "AGENT_OPERATING_RULES.md"
    if legacy.exists():
        assert "AGENTS.md" in legacy.read_text(encoding="utf-8"), (
            "the legacy rules redirect must point at AGENTS.md"
        )
        assert len(legacy.read_text(encoding="utf-8").splitlines()) < 20, (
            "the legacy rules file must stay a short redirect, not a competing rule set"
        )


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failures = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            failures += 1
            print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failures}/{len(fns)} passed")
    sys.exit(1 if failures else 0)
