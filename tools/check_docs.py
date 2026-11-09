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
  4. A claim resolves only from the repo root or from the doc's own folder. There is no
     kit-relative fallback on purpose: every quoted path must be unambiguous for a reader
     sitting at the repository root.
  5. A claim may carry a symbol suffix -- `tests/production/test_x.py::test_y` -- which claims
     both that the file exists and that the symbol is defined in it. The suffix is verified,
     not ignored: a doc pointing at a renamed test fails the check.

Runtime artifacts (files a render produces) are listed in ALLOW_MISSING. Anything under a
runtime directory -- `output/`, `work/`, `node_modules/`, `.venv/`, or a per-film resumable
chunk cache (`.work_*`) at any depth -- is created by the pipeline
and is deliberately absent from a fresh clone, so a reference to it is not a broken path. That
distinction is why this check passes in a checkout with a render in it and must also pass in a
bare clone: `git clone <repo> /tmp/x && python3 tools/check_docs.py` is the real test.

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
    "assets/voices", "assets/voices/", "node_modules", ".venv", ".venv/",
    "output/.work_<name>/", "path/to/piper_voices", "/path/to/piper_voices",
    "~/.cache/piper_voices", "universal_toolbook/node_modules/",
}

# Directories a render or an install creates. A path inside them cannot exist in a fresh clone.
RUNTIME_PREFIXES = (
    "output/",
    "work/",
    ".work_",          # resumable chunk caches + intermediate mixes (git-ignored, per-film)
    "node_modules/",
    "universal_toolbook/node_modules/",
    ".venv/",
    "assets/voices/",
    "universal_toolbook/assets/voices/",
    "~/.cache/",
    # TTS model weights (downloaded by setup_tts.py, git-ignored)
    "cache/",
    "outputs/storyboard",
)

PLACEHOLDER = ("<", ">", "{", "}", "*", "…", "...", "/path/to", "your_", "my_", "$")

IGNORE_EXACT = {
    "focus_x/y", "y/n", "and/or", "24/7", "TCP/IP", "S01.wav", "S07.wav",
    # GitHub owner/repo identifiers (external mirrors, not repository paths):
    "007-Akira/Project-Rocky",  # Piper voice mirror used by fetch_piper_voices.py --github
    "remsky/Kokoro-FastAPI",  # source of the pinned v1.0 voice .pt files (setup_tts.py step 4)
}

CMD_RE = re.compile(r"(?:python3|node)\s+([^\s`'\"|&;)]+)")
FENCE_RE = re.compile(r"```[a-zA-Z]*\n(.*?)```", re.S)
# commands inside fenced blocks: python3/node <file>, cp <src> <dst>, mkdir, npm --prefix
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
    if not t or t in IGNORE_EXACT:
        return False
    if t.startswith(("http://", "https://", "mailto:", "#", "@")):
        return False
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
    if t.rstrip("/") in {"output", "work", "node_modules", ".venv", "assets/voices"}:
        return True
    if t.startswith(RUNTIME_PREFIXES):
        return True
    # a resumable chunk cache at any depth (renders/.work_<stem>/, <project>/.work_<stem>/)
    return any(part.startswith(".work_") for part in t.split("/"))


def resolve(token: str, doc: Path) -> bool:
    t = token.strip().rstrip(".,;:")
    if t in ALLOW_MISSING:
        return True
    # Deliberately no kit-relative fallback: a path quoted in a doc must resolve from the
    # repo root, or from the doc's own folder (markdown-link semantics). Anything else is
    # ambiguous for a reader and is reported.
    candidates = [ROOT / t, doc.parent / t]
    return any(c.exists() for c in candidates)


def symbol_claim_problem(token: str, path_part: str, symbol: str, doc: Path) -> str | None:
    """Rule 5: a `file::symbol` claim asserts the symbol is defined in that file."""
    host = next((c for c in (ROOT / path_part, doc.parent / path_part) if c.is_file()), None)
    if host is None:
        return f"symbol not found in file -> {token}"
    body = host.read_text(encoding="utf-8", errors="replace")
    if symbol not in body:
        return f"symbol not found in file -> {token}"
    return None


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
                    # Rule 5: `file::symbol` also claims the symbol lives in that file.
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

        # 3: relative markdown links
        for m in LINK_RE.finditer(text):
            target = m.group(1)
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            target_path = target.split("#")[0]
            if not target_path:
                continue
            claims += 1
            if not (doc.parent / target_path).exists() and not (ROOT / target_path).exists():
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
