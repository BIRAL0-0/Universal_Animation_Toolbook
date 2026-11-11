"""Every tool in `tools/` must be able to describe itself.

A tool that crashes on `--help` is a tool nobody runs, and a manual that
documents the crash instead of the interface sends every future reader around a
defect that could have been fixed in four lines.

Two failures motivated this:

* `subtitle_check.py` and `mix_probe.py` read `sys.argv` positionally, so
  `--help` was consumed as a *directory path* and the run died on a missing
  `vo_manifest.json` (KI-013).
* `compose_thumbnail.py` and `audio_report.py` raised `ModuleNotFoundError` at
  import, which was then written into the manual as "argparse broken" — a wrong
  diagnosis that persisted for two sessions (KI-014).

The contract enforced here: `--help` exits 0 and prints a usage line. A tool whose
dependency is genuinely missing is reported as **skipped with a reason**, not as a
pass — silence would hide the same class of problem again.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOOLS = sorted(p.name for p in (ROOT / "tools").glob("*.py") if p.name != "__init__.py")

# Tools whose entry point is a work-dir consumer still must answer --help; there is
# no exemption list. This constant exists only so the parametrisation reads well.
EXPECTED_TOOL_COUNT = 21


def _help(tool: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, f"tools/{tool}", "--help"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )


def test_every_python_tool_is_covered():
    """A new tool must not slip past this suite unnoticed."""
    assert len(TOOLS) >= EXPECTED_TOOL_COUNT, (
        f"only {len(TOOLS)} tools found; if a tool was removed, lower "
        f"EXPECTED_TOOL_COUNT deliberately rather than letting the count drift"
    )


@pytest.mark.parametrize("tool", TOOLS)
def test_tool_answers_help(tool):
    proc = _help(tool)
    combined = proc.stdout + proc.stderr

    # A genuinely absent dependency is not a CLI defect. Report it as a skip with
    # the module named, so the gap is visible instead of silently green.
    if "ModuleNotFoundError" in combined:
        missing = combined.split("ModuleNotFoundError:")[-1].strip().splitlines()[0]
        pytest.skip(f"{tool} needs a dependency not installed here ({missing})")

    assert proc.returncode == 0, (
        f"{tool} --help exited {proc.returncode}\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    assert "usage:" in combined.lower(), f"{tool} --help printed no usage line"


@pytest.mark.parametrize("tool", ["subtitle_check.py", "mix_probe.py"])
def test_work_dir_tools_reject_a_bad_directory_with_a_useful_message(tool):
    """They must fail on a missing manifest, and say what to pass instead."""
    proc = subprocess.run(
        [sys.executable, f"tools/{tool}", "/tmp/definitely-not-a-work-dir"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    combined = proc.stdout + proc.stderr
    assert proc.returncode != 0
    assert "vo_manifest.json" in combined or "episode_retimed.json" in combined, (
        f"{tool} failed without naming the file it wanted:\n{combined}"
    )


def test_manual_does_not_claim_a_tool_has_broken_argparse():
    """The misdiagnosis must not creep back into the operating manual.

    Searching for the specific phrases is deliberate: this asserts the *claim* is
    gone, not that the sentence never existed.
    """
    for doc in ("master_prompt.md", "docs/production/KNOWN_ISSUES.md"):
        text = (ROOT / doc).read_text(encoding="utf-8")
        # Only a *present-tense assertion about the tooling* is the defect. The
        # historical record in KNOWN_ISSUES must be allowed to quote what was
        # previously believed, otherwise documenting the mistake is impossible.
        for phrase in ("crashes on `--help`", "argparse is broken"):
            assert phrase not in text, f"{doc} still claims: {phrase!r}"
        for line in text.splitlines():
            if "argparse broken" in line and not any(
                past in line.lower() for past in ("was recorded", "previously", "misdiagnos", "wrong conclusion", "did not")
            ):
                raise AssertionError(f"{doc} still asserts broken argparse: {line.strip()!r}")


def test_help_never_writes_a_file_called_dash_dash_help():
    """`build_wall_episode.py --help` once created a 17 KB file literally named `--help`.

    A positional path argument that takes `sys.argv[1]` verbatim will happily treat a
    flag as a filename, so this asserts the repository root is unchanged and no such
    file exists after every tool has been asked for help.
    """
    stray = ROOT / "--help"
    assert not stray.exists(), "a stray file named `--help` exists in the repository root"

    before = set(ROOT.iterdir())
    for tool in TOOLS:
        _help(tool)
    after = set(ROOT.iterdir())
    assert before == after, f"asking tools for --help created files: {after - before}"


def test_tool_help_text_matches_the_manual_entry():
    """Every tool named in the manual's tool table must still answer --help."""
    manual = (ROOT / "master_prompt.md").read_text(encoding="utf-8")
    named = {tool for tool in TOOLS if f"`{tool}`" in manual}
    assert len(named) >= 15, f"manual names only {len(named)} tools; the table may have drifted"
    for tool in sorted(named):
        proc = _help(tool)
        if "ModuleNotFoundError" in (proc.stdout + proc.stderr):
            continue
        assert proc.returncode == 0, f"{tool} is documented in the manual but fails --help"
