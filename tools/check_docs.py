#!/usr/bin/env python3
"""Verify that every repository path and command quoted in the docs actually exists.

A fresh session follows the docs literally. If a doc says "read `process/01_INTAKE.md`" and
that file is not at that path, the session improvises -- which is exactly the failure this
repository exists to prevent. So doc paths are treated as executable claims.

Rules (deliberately narrow, to avoid flagging prose):

  1. A code span is a *path claim* when it contains "/" and is not an npm package ("@" prefix),
     a function call, a URL, or an obvious placeholder (<, >, *, {, }, …).
  2. A command target right after python3/node is a claim when it ends in .py/.js.
  3. Relative markdown links are claims.
  4. A claim resolves only from the repo root or from the doc's own folder. Every quoted path
     must be unambiguous for a reader sitting at the repository root.
  5. A claim may carry a symbol suffix -- `tests/production/test_x.py::test_y` -- which claims
     both that the file exists and that the symbol is defined in it. The suffix is verified.
  6. Historical records (the baseline inventory and past project archives) may quote paths
     from before the 2026-11-09 reorganization. LEGACY_ALIASES maps those paths to their
     canonical targets so old evidence stays readable without editing a finished project.
     New documentation must use canonical paths; tools/validate_structure.py enforces that.
  7. Runtime artifacts under runtime/ (and the legacy output/, work/, cache/, .work_* roots)
     are generated, not committed, so a reference to them is never a broken path.
  8. Arena session branch names are Git refs, not paths. The session hex changes each time, so
     they are matched by shape instead of a hardcoded allowlist entry.

Usage:
    python3 tools/check_docs.py [--verbose]
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "universal_toolbook"

# Produced at run time, or deliberately absent from git.
ALLOW_MISSING = {
    "work/episode.json", "work/stills", "work/deliverables", "work/_local_backup",
    "output/final_film_1080p.mp4", "output/final_1080p.mp4", "output/film.mp4",
    "output/my_film.mp4", "output/player.html", "output/index.html",
    "output/the_two_inch_bridge_1080p.mp4", "output/final_film_1080p_chapters.txt",
    "output/stills", "output/.work_<name>", "output/.work_final_film_1080p",
    "outputs/storyboard.svg", "outputs/<film>", "outputs/film_storyboard.svg",
    "deliverables/storyboard.svg", "deliverables/<film>", "deliverables/film_storyboard.svg",
    "assets/voices", "assets/voices/", "node_modules", ".venv", ".venv/",
    "output/.work_<name>/", "path/to/piper_voices", "/path/to/piper_voices",
    "~/.cache/piper_voices", "universal_toolbook/node_modules/",
    # Historical broken hand-off symlinks, recorded only in the baseline inventory.
    "downloads/the_wall_you_agreed_with_1080x1920.mp4",
    "downloads/the_wall_you_agreed_with_1080x1920.zip",
    "projects/video-003-topic/PROMPT.md",  # worked example in the first-video guide
    "und",  # ffprobe prints Stream #0:1[0x2](und) in copied production logs
}

# Directories a render or an install creates. A path inside them cannot exist in a fresh clone.
RUNTIME_PREFIXES = (
    "runtime/",
    "output/",
    "work/",
    ".work_",          # resumable chunk caches + intermediate mixes (git-ignored, per-film)
    "node_modules/",
    "universal_toolbook/node_modules/",
    ".venv/",
    "assets/voices/",
    "universal_toolbook/assets/voices/",
    "~/.cache/",
    "cache/",           # legacy TTS weight root; new setup uses runtime/cache/
    "renders/", "previews/", "logs/",  # shorthands for runtime/ subdirectories
    "outputs/storyboard",
    "deliverables/storyboard",
)

# Old path -> canonical path. Ordered: specific paths before directory prefixes.
# This is a compatibility map for *historical* docs, not permission to write new stale links.
LEGACY_ALIASES = (
    ("outputs/README.md", "deliverables/RESULTS.md"),
    ("outputs/the_wall_you_agreed_with_1080x1920.zip",
     "deliverables/releases/the_wall_you_agreed_with_1080x1920.zip"),
    ("outputs/discipline_vs_obsession_release.zip",
     "deliverables/releases/discipline_vs_obsession_release.zip"),
    ("outputs/", "deliverables/"),
    ("downloads/index.html", "deliverables/the_wall_you_agreed_with/index.html"),
    ("downloads/the_wall_you_agreed_with_1080x1920.zip",
     "deliverables/releases/the_wall_you_agreed_with_1080x1920.zip"),
    ("downloads/", "deliverables/the_wall_you_agreed_with/"),
    ("docs/production-workflow/CONFIGURATION_AND_SETUP.md",
     "docs/getting-started/INSTALL.md"),
    ("docs/production-workflow/ENVIRONMENT_REPORT.md",
     "docs/development/ENVIRONMENT_REPORT.md"),
    ("docs/production-workflow/FUTURE_DEVELOPMENT.md",
     "docs/development/ROADMAP.md"),
    ("projects/video-001-twenty-three-minutes/video-001_RELEASE.zip",
     "deliverables/releases/video-001_RELEASE.zip"),
    ("docs/production-workflow/", "docs/production/"),
    ("universal_toolbook/process/SESSION_PROMPT.md", "AGENTS.md"),
    ("universal_toolbook/process/REPO_MAP.md", "docs/architecture/SYSTEM_OVERVIEW.md"),
    ("universal_toolbook/MASTER_PROMPT.md", "templates/MASTER_VIDEO_PRODUCTION_PROMPT.md"),
    ("universal_toolbook/00_START_HERE.md", "universal_toolbook/README.md"),
    ("00_START_HERE.md", "universal_toolbook/README.md"),
    ("AGENT_OPERATING_RULES.md", "AGENTS.md"),
    ("START_HERE.md", "README.md"),
    ("tests/run_all_tests.js", "tests/regression/run_all_tests.js"),
    ("tests/test_studio_pipeline.py", "tests/integration/test_studio_pipeline.py"),
    ("output/", "runtime/renders/"),
    ("work/", "runtime/work/"),
    ("cache/tts/", "runtime/cache/tts/"),
    ("cache/", "runtime/cache/"),
)

PLACEHOLDER = ("<", ">", "{", "}", "*", "…", "...", "/path/to", "your_", "my_", "$")

# Bare directory names in architecture tables are structural shorthand, not path claims.
# Full file paths remain claims and must resolve from the repository root.
STRUCTURAL_SHORTHAND = {
    "renders/", "previews/", "logs/", "cache/", "work/", "output/", "engine/", "assets/",
    "config/", "tts/", "audio/", "process/", "templates/", "tools/", "scripts/", "docs/",
    "skills/", "projects/", "deliverables/", "runtime/", "examples/", "tests/", "unit/",
    "integration/", "regression/", "production/", "fixtures/", "references/",
    # Hypothetical subdirectories rejected by ADR-0002 (quoted only to explain the decision):
    "rendering/", "animation/", "composition/", "voiceover/", "synchronization/",
    "orchestration/", "__pycache__/", ".pytest_cache/",
}

IGNORE_EXACT = STRUCTURAL_SHORTHAND | {
    "focus_x/y", "y/n", "and/or", "24/7", "TCP/IP", "S01.wav", "S07.wav",
    # API endpoints and GitHub owner/repo identifiers are external, not paths:
    "api.github.com/repos/remotion-dev/skills",
    "remotion-dev/remotion", "remotion-dev/skills",
    "007-Akira/Project-Rocky",  # Piper voice mirror used by fetch_piper_voices.py --github
    "remsky/Kokoro-FastAPI",  # source of the pinned v1.0 voice .pt files (setup_tts.py step 4)
}

# Evidence-taxonomy labels and ffprobe's undefined-language tag are prose/tool output, not paths.
IGNORE_EXACT |= {
    "[M]/[O]/[P]", "[V]/[I]/[A]", "[M]", "[O]", "[P]", "[V]", "[I]", "[A]", "und",
}

# Documents that describe the kit from the outside may quote kit-relative paths such as
# `engine/episode.js`. Those resolve to universal_toolbook/engine/episode.js and nowhere else.
# Root README.md is deliberately excluded: the unit test pins rule 4 there.
KIT_CONTEXT_PREFIXES = (
    "skills/", "docs/", "templates/", "universal_toolbook/", "runtime/",
    "AGENTS.md", "CHANGELOG.md", "CONTRIBUTING.md", "START_HERE.md",
)
KIT_RELATIVE_PREFIXES = (
    "engine/", "tts/", "config/", "assets/", "process/", "templates/", "tools/",
)

# Arena working branches are Git refs of the form arena/<session-hex>-universal-animation-toolbook.
# The hex id changes every session, so match the shape rather than hardcoding one branch: a new
# session's delivery notes must not turn into a broken-path claim.
ARENA_BRANCH_RE = re.compile(r"arena/[0-9a-f]{8}-universal-animation-toolbook")


def is_git_ref(token: str) -> bool:
    return bool(ARENA_BRANCH_RE.fullmatch(token.strip().strip("`").rstrip(".,;:")))


CMD_RE = re.compile(r"(?:python3|node)\s+([^\s`'\"|&;)]+)")
FENCE_RE = re.compile(r"```[a-zA-Z]*\n(.*?)```", re.S)
FENCE_CMD_RE = re.compile(r"(?:python3|node)\s+([\w./-]+\.(?:py|js|json|md))")
CP_RE = re.compile(r"\bcp\s+(?:-\w+\s+)*([\w./-]+)\s+([\w./-]+)")
NPM_PREFIX_RE = re.compile(r"--prefix\s+([\w./-]+)")
CODE_RE = re.compile(r"`([^`\n]+)`")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")


def tracked_docs() -> list[Path]:
    # --cached --others --exclude-standard = tracked files PLUS untracked, non-ignored ones.
    # A brand-new doc is skipped by a plain `git ls-files`, which is how a broken path in a
    # freshly written NOTES.md passed locally and then failed the CI docs job.
    try:
        out = subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
            cwd=ROOT,
            text=True,
        )
        files = [ROOT / ln for ln in out.splitlines() if ln.strip()]
    except Exception:
        files = list(ROOT.rglob("*.md"))
    return [f for f in files if f.is_file() and ".git/" not in str(f)]


def is_claim(token: str) -> bool:
    t = token.strip().strip("`").rstrip(".,;:")
    if not t or t in IGNORE_EXACT or is_git_ref(t):
        return False
    if t.startswith(("http://", "https://", "mailto:", "#", "@", "/")):
        return False  # URLs, anchors, packages and absolute machine paths
    if ".." in t or ".json." in t:
        return False  # ranges (process/01..08) and JSON field paths (file.json.fps)
    if any(p in t for p in PLACEHOLDER):
        return False
    if "(" in t or ")" in t or "'" in t or '"' in t:
        return False
    if " " in t:
        return False
    if re.fullmatch(r"[\d./%+-]+", t):
        return False
    return "/" in t


def is_runtime(token: str) -> bool:
    t = token.strip().rstrip(".,;:")
    if t.rstrip("/") in {"output", "work", "node_modules", ".venv", "assets/voices", "runtime",
                         "cache"}:
        return True
    if t.startswith(RUNTIME_PREFIXES):
        return True
    # a resumable chunk cache at any depth (renders/.work_<stem>/, <project>/.work_<stem>/)
    return any(part.startswith(".work_") for part in t.split("/"))


def _canonical(rel: str) -> str:
    """Map a repo-root-relative historical path to its current canonical path."""
    for old, new in LEGACY_ALIASES:
        if rel == old.rstrip("/"):
            return new.rstrip("/")
        if rel.startswith(old):
            return new + rel[len(old):]
    return rel


def _candidate_paths(token: str, doc: Path) -> list[Path]:
    """Existing paths a claim may refer to, including legacy aliases and kit context."""
    t = token.strip().rstrip(".,;:")
    out: list[Path] = []
    for candidate in (ROOT / t, doc.parent / t):
        if candidate.exists():
            out.append(candidate)
        try:
            rel = candidate.resolve().relative_to(ROOT).as_posix()
        except ValueError:
            continue
        canon = ROOT / _canonical(rel)
        if canon.exists():
            out.append(canon)
    try:
        rel_doc = doc.relative_to(ROOT).as_posix()
    except ValueError:
        rel_doc = ""
    if (rel_doc in KIT_CONTEXT_PREFIXES or
            any(rel_doc.startswith(prefix) for prefix in KIT_CONTEXT_PREFIXES)) and \
            t.startswith(KIT_RELATIVE_PREFIXES):
        kit_candidate = ROOT / "universal_toolbook" / t
        if kit_candidate.exists():
            out.append(kit_candidate)
    return out


def resolve(token: str, doc: Path) -> bool:
    t = token.strip().rstrip(".,;:")
    if t in ALLOW_MISSING:
        return True
    if not (ROOT / t).exists() and not (doc.parent / t).exists() and is_runtime(t):
        # A runtime path may not exist in a fresh clone; report it separately in verbose mode.
        return False
    return bool(_candidate_paths(t, doc))


def symbol_claim_problem(token: str, path_part: str, symbol: str, doc: Path) -> str | None:
    """Rule 5: a `file::symbol` claim asserts the symbol is defined in that file."""
    host = next((p for p in _candidate_paths(path_part, doc) if p.is_file()), None)
    if host is None:
        return f"symbol not found in file -> {token}"
    body = host.read_text(encoding="utf-8", errors="replace")
    if symbol not in body:
        return f"symbol not found in file -> {token}"
    return None


def link_resolves(target_path: str, doc: Path) -> bool:
    if target_path in ALLOW_MISSING:
        return True
    if is_runtime(target_path):
        return True
    return bool(_candidate_paths(target_path, doc))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    problems: list[str] = []
    runtime: list[str] = []
    claims = 0
    docs = tracked_docs()

    for doc in docs:
        rel = doc.relative_to(ROOT)
        text = doc.read_text(encoding="utf-8", errors="replace")

        # 1 + 2: code spans, and command targets
        for m in CODE_RE.finditer(text):
            span = m.group(1)
            cm = CMD_RE.search(span)
            if cm:
                target = cm.group(1)
                if target.endswith((".py", ".js")):
                    claims += 1
                    if not resolve(target, doc) and not is_runtime(target):
                        problems.append(f"{rel}: command target not found -> {target}")
                continue
            for token in span.split():
                if not is_claim(token):
                    continue
                claims += 1
                path_part, sep, symbol = token.partition("::")
                if not resolve(path_part, doc):
                    if not sep and is_runtime(path_part):
                        runtime.append(f"{rel}: {token}")
                    else:
                        problems.append(f"{rel}: path not found -> {token}")
                elif sep:
                    prob = symbol_claim_problem(token, path_part, symbol, doc)
                    if prob:
                        problems.append(f"{rel}: {prob}")

        # 2b: commands inside fenced blocks (the reading lists and copy-paste blocks)
        for fence in FENCE_RE.finditer(text):
            body = fence.group(1)
            for cm in FENCE_CMD_RE.finditer(body):
                target = cm.group(1)
                claims += 1
                if not resolve(target, doc) and not is_runtime(target):
                    problems.append(f"{rel}: fenced command not found -> {target}")
            for cm in CP_RE.finditer(body):
                src = cm.group(1)
                claims += 1
                if not resolve(src, doc) and not is_runtime(src):
                    problems.append(f"{rel}: fenced cp source not found -> {src}")
            for cm in NPM_PREFIX_RE.finditer(body):
                target = cm.group(1)
                if target in ALLOW_MISSING:
                    continue
                claims += 1
                if not resolve(target, doc) and not is_runtime(target):
                    problems.append(f"{rel}: npm --prefix not found -> {target}")

        # 3: relative markdown links (legacy aliases allowed for historical records)
        for m in LINK_RE.finditer(text):
            target = m.group(1)
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            target_path = target.split("#")[0]
            if not target_path:
                continue
            if target_path in ALLOW_MISSING or target_path in IGNORE_EXACT or is_git_ref(target_path):
                continue
            claims += 1
            if not link_resolves(target_path, doc):
                problems.append(f"{rel}: markdown link not found -> {target}")

    seen, unique = set(), []
    for p in problems:
        if p not in seen:
            seen.add(p)
            unique.append(p)

    if unique:
        print(f"DOCS CHECK FAILED: {len(unique)} unresolved reference(s)")
        for p in unique:
            print("  " + p)
        return 1

    print(f"DOCS CHECK OK: {claims} path references resolved across {len(docs)} markdown files")
    if runtime:
        print(f"  ({len(runtime)} reference(s) point at render/install output, absent from a fresh clone)")
    if args.verbose:
        for d in docs:
            print("  " + str(d.relative_to(ROOT)))
        for r in runtime:
            print("  runtime: " + r)
    return 0


if __name__ == "__main__":
    sys.exit(main())
