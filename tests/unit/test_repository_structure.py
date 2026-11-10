"""Repository-shape regression tests.

These protect the one-authoritative-location architecture: a change that moves a skill, adds a
second master prompt, commits a render, or breaks a project archive must fail here before it
reaches CI. Subjective visual/audio QA is intentionally NOT claimed by this module.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "tools" / "validate_structure.py"
POLISH = ROOT / "docs" / "production" / "prompts" / "VOICEOVER_POLISH_PROMPT.md"
POLISH_SHA256 = "aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea"
SKILLS = (
    "youtube-research", "scriptwriting", "stickman-animation", "animation-production",
    "voiceover-audio", "production-quality",
)


def _load_validator():
    spec = importlib.util.spec_from_file_location("validate_structure", VALIDATOR)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _tracked() -> list[str]:
    paths = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT, text=True,
    ).splitlines()
    # A moved file can be a deleted index entry plus an untracked destination until staged.
    return [p for p in paths if p and (ROOT / p).exists()]


def test_structure_validator_and_docs_checker_pass():
    for script in ("tools/validate_structure.py", "tools/check_docs.py",
                   "tools/check_workflows.py"):
        proc = subprocess.run([sys.executable, script], cwd=ROOT,
                              capture_output=True, text=True)
        assert proc.returncode == 0, f"{script} failed:\n{proc.stdout}\n{proc.stderr}"


def test_final_reports_have_no_unresolved_placeholders():
    """A shipping report may not contain a leftover double-brace token."""
    for rel in ("docs/architecture/MIGRATION_REPORT.md", "docs/architecture/FINAL_TREE.md",
                "docs/development/VALIDATION_REPORT.md", "CHANGELOG.md"):
        body = (ROOT / rel).read_text(encoding="utf-8")
        assert not re.search(r"\{\{[A-Z_]+\}\}", body), rel


def test_skill_activation_map_is_operational():
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for name in SKILLS:
        rel = f"skills/{name}/SKILL.md"
        skill = ROOT / rel
        assert skill.is_file(), rel
        assert rel in agents, f"AGENTS.md does not activate {rel}"
        body = skill.read_text(encoding="utf-8")
        assert body.startswith("---\n"), f"{rel} missing frontmatter"
        assert f"name: {name}" in body[:300]
        assert "description:" in body[:600]
        assert len(body.splitlines()) >= 25, f"{rel} is decorative"


def test_one_master_prompt_and_immutable_polish_prompt():
    masters = [p for p in _tracked() if "MASTER_VIDEO_PRODUCTION_PROMPT" in p or
               p.endswith("MASTER_PROMPT.md")]
    assert masters == ["templates/MASTER_VIDEO_PRODUCTION_PROMPT.md"], masters
    assert hashlib.sha256(POLISH.read_bytes()).hexdigest() == POLISH_SHA256
    assert POLISH.stat().st_size == 5256
    for redirect in ("START_HERE.md", "AGENT_OPERATING_RULES.md"):
        assert len((ROOT / redirect).read_text(encoding="utf-8").splitlines()) < 40


def test_no_tracked_runtime_or_cache_artifacts():
    mod = _load_validator()
    runtime = [p for p in _tracked() if p.startswith("runtime/")]
    assert runtime == ["runtime/README.md"], runtime
    for rel in _tracked():
        assert not any(rel.startswith(pre) or pre in rel for pre in mod.TRACKED_BAD), rel
        assert not rel.endswith((".pyc", ".pyo"))
        assert ".work_" not in rel


def test_no_generated_media_in_source_directories():
    mod = _load_validator()
    for rel in _tracked():
        if Path(rel).suffix.lower() in mod.MEDIA_EXT:
            assert rel.startswith(mod.SOURCE_MEDIA_ALLOW), rel


def test_historical_project_archives_remain_complete():
    mod = _load_validator()
    tracked = _tracked()
    slugs = sorted({rel.split("/")[1] for rel in tracked
                    if rel.startswith("projects/") and rel.count("/") >= 2})
    assert len(slugs) >= 2, slugs
    for slug in slugs:
        base = f"projects/{slug}/"
        for alternatives in mod.PROJECT_REQUIRED_GROUPS:
            assert any(r.startswith(base) and any(n in r for n in alternatives)
                       for r in tracked), f"{slug}: {alternatives[0]}"


def test_ci_uses_current_entry_points():
    ci = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
    for rel in ("tests/regression/run_all_tests.js",
                "tests/integration/test_studio_pipeline.py",
                "tools/validate_structure.py", "runtime/"):
        assert rel in ci, rel
    assert "mkdir -p work" not in ci
    assert "node tests/run_all_tests.js" not in ci
    assert "python tests/test_studio_pipeline.py" not in ci


def test_new_project_generator_is_independent_and_prompt_first(tmp_path):
    script = ROOT / "scripts" / "new_project.py"
    projects = tmp_path / "projects"
    projects.mkdir()
    proc = subprocess.run(
        [sys.executable, str(script), "video-003-sample", "--title", "A Sample Film",
         "--projects-dir", str(projects)],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    result = json.loads(proc.stdout)
    assert result["prompt_saved_first"] is True
    project = projects / "video-003-sample"
    for name in result["files"]:
        assert (project / name).is_file(), name
    assert "{{TITLE}}" not in (project / "PROMPT.md").read_text(encoding="utf-8")
    assert (project / "PROMPT.md").read_text(encoding="utf-8").startswith("#")
    for folder in ("assets", "audio", "renders"):
        assert (project / folder).is_dir()
    # A second invocation must never overwrite the first project.
    again = subprocess.run(
        [sys.executable, str(script), "video-003-sample", "--title", "A Different Film",
         "--projects-dir", str(projects)],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert again.returncode == 2
    assert "refusing to overwrite" in again.stderr
    assert "A Sample Film" in (project / "PROMPT.md").read_text(encoding="utf-8")


def test_kit_is_copyable_and_validates_standalone(tmp_path):
    """The kit may not depend on repo-level tools/, docs/, skills/ or projects/."""
    kit_copy = tmp_path / "kit"
    shutil.copytree(ROOT / "universal_toolbook", kit_copy,
                    ignore=shutil.ignore_patterns("__pycache__", "node_modules", "*.pyc"))
    proc = subprocess.run(
        [sys.executable, "run_studio.py", "validate", "templates/episode_minimal.json"],
        cwd=kit_copy, capture_output=True, text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "warning" not in proc.stdout.lower() or "warnings\": []" in proc.stdout.lower()
    assert (kit_copy / "engine" / "video_renderer.js").is_file()
    assert (kit_copy / "assets" / "Poppins-Regular.ttf").is_file()
    assert (kit_copy / "config" / "studio_config.json").is_file()


def test_master_prompt_documents_multiline_board_geometry():
    """The reusable brief must carry every measured board-geometry value."""
    text = (ROOT / "templates" / "MASTER_VIDEO_PRODUCTION_PROMPT.md").read_text(encoding="utf-8")
    for value in ("h>=250", "y~74", "42-pixel", "portrait_w:460", "portrait_x:0.5",
                  "final-master"):
        assert value in text, value


def test_docs_checker_ignores_evidence_taxonomy_and_ffprobe_language_tags():
    """Copied production logs must not be read as broken links."""
    text = (ROOT / "tools" / "check_docs.py").read_text(encoding="utf-8")
    for token in ("[M]/[O]/[P]", "[V]/[I]/[A]", "und"):
        assert token in text, token


def test_docs_checker_treats_session_branch_names_as_git_refs():
    """A new session's branch must not require another hardcoded IGNORE_EXACT entry."""
    spec = importlib.util.spec_from_file_location("check_docs_for_test", ROOT / "tools" / "check_docs.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Any session hex is accepted, not just the branch that happened to ship this fix.
    assert mod.is_git_ref("`arena/0000abcd-universal-animation-toolbook`") is True
    assert mod.is_claim("`arena/deadbeef-universal-animation-toolbook`") is False
    # A real path with the same slashes must still be a verifiable claim.
    assert mod.is_claim("`tools/check_docs.py`") is True
    assert mod.is_claim("`deliverables/video-003-first-plank/final.mp4`") is True


def test_portrait_crop_prunes_clipped_signpost_labels():
    """A moving 9:16 crop must not paint unreadable fragments of world-prop labels (KI-012)."""
    renderer = (ROOT / "universal_toolbook" / "engine" / "video_renderer.js").read_text(encoding="utf-8")
    assert "function pruneClippedSignpostLabels" in renderer
    assert "viewport.width < BASE_W" in renderer
    regression = (ROOT / "tests" / "regression" / "run_all_tests.js").read_text(encoding="utf-8")
    assert "pruneClippedSignpostLabels" in regression
    assert "clipped_signpost_label_pruning_verified" in regression
    prompt = (ROOT / "templates" / "MASTER_VIDEO_PRODUCTION_PROMPT.md").read_text(encoding="utf-8")
    assert "KI-012" in prompt


def test_produce_video_invalidates_stale_render_caches():
    """A spec edit must not be silently ignored by --resume chunk/reuse state."""
    text = (ROOT / "tools" / "produce_video.py").read_text(encoding="utf-8")
    assert "def invalidate_stale_work_dirs" in text
    assert ".work_cache_state" in text
    assert "hashlib.sha256" in text
