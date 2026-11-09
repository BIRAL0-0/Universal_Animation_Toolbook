"""Regression test for the CI "docs paths resolve" job (tools/check_docs.py).

The docs job failed on PR #16 because freshly written docs quoted paths that do not resolve
from the repo root (`engine/audio_mixer.py` instead of `universal_toolbook/engine/audio_mixer.py`,
scheme-less URLs, ffprobe excerpts whose `[0x1](und)` read as markdown links). Every finding was
fixed in the docs themselves; this test keeps them fixed and pins the checker's rule 5
(`file::symbol` claims are verified, not ignored).
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKER = REPO_ROOT / "tools" / "check_docs.py"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_docs", CHECKER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_repo_docs_resolve_end_to_end():
    """Exactly what CI runs; must exit 0 on a clean checkout."""
    r = subprocess.run([sys.executable, str(CHECKER)], cwd=REPO_ROOT,
                       capture_output=True, text=True)
    assert r.returncode == 0, f"check_docs failed:\n{r.stdout}\n{r.stderr}"


def test_symbol_claims_are_verified_not_ignored():
    mod = _load_checker()
    doc = REPO_ROOT / "docs" / "production" / "KNOWN_ISSUES.md"
    good = "tests/production/test_repo_hygiene.py::test_no_channel_name_anywhere"
    assert mod.symbol_claim_problem(good, *good.split("::"), doc) is None
    bad = "tests/production/test_repo_hygiene.py::test_renamed_away"
    assert mod.symbol_claim_problem(bad, *bad.split("::"), doc) is not None
    missing = "tests/production/no_such_file.py::test_x"
    assert mod.symbol_claim_problem(missing, *missing.split("::"), doc) is not None


def test_claim_rules_unchanged_for_plain_paths():
    mod = _load_checker()
    assert mod.is_claim("universal_toolbook/engine/audio_mixer.py")
    assert not mod.is_claim("https://example.com/x/y")     # URLs are not path claims
    assert not mod.is_claim("projects/<slug>/assets/")     # placeholders are not claims
    assert mod.is_claim("kb/s"), "unit-ish spans are claims; docs must keep them out of code spans"
    assert mod.resolve("universal_toolbook/engine/audio_mixer.py", REPO_ROOT / "README.md")
    assert not mod.resolve("engine/audio_mixer.py", REPO_ROOT / "README.md"), \
        "kit-relative fallback must stay absent (rule 4)"


def test_work_caches_are_runtime_not_broken_paths():
    """A fresh CI clone has no .work_* caches; docs may cite measured WAVs inside them."""
    mod = _load_checker()
    assert mod.is_runtime(".work_final/master_audio.wav")
    assert mod.is_runtime("renders/.work_draft_9x16/")
    assert not mod.is_runtime("projects/video-001-twenty-three-minutes/final.mp4")


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    bad = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            bad += 1
            print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - bad}/{len(fns)} passed")
    sys.exit(1 if bad else 0)
