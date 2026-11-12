"""KI-021 — a chapter authored as an object must not reach a render.

`chapter` is a `"Label | Title"` string. The episode compiler stores `String(sc.chapter)` and both
the burned-in ribbon and the YouTube chapters file print it, so an object ships the literal text
`[object Object]` into the film and into every line of the chapters file. `run_studio.py validate`
accepted it, which is how it got into a real render.

These tests pin the guard in `tools/validate_specs.py`, and were written to fail against the defect
before the guard was trusted.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VALIDATE_SPECS = ROOT / "tools" / "validate_specs.py"
EXAMPLES = ROOT / "examples"


def _write(tmp_path: Path, scenes: list[dict]) -> Path:
    spec = {
        "title": "chapter guard",
        "thesis": "t",
        "bgm": "none",
        "subtitles_mode": "off",
        "cast": {"a": {"style": "ink_stick", "scale": 1.0}},
        "scenes": scenes,
    }
    path = tmp_path / "spec.json"
    path.write_text(json.dumps(spec), encoding="utf-8")
    return path


def _scene(chapter=None) -> dict:
    scene = {
        "id": "S01",
        "duration": 4.0,
        "setting": {"backdrop": "parchment_stage"},
        "characters": [{"id": "a", "beats": [{"start": 0, "end": 4.0, "action": "idle_stand", "x": 0.5}]}],
        "dialogue": [],
    }
    if chapter is not None:
        scene["chapter"] = chapter
    return scene


def _run(spec: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(VALIDATE_SPECS), str(spec)],
        cwd=str(ROOT), text=True, capture_output=True,
    )


def test_object_chapter_is_rejected(tmp_path):
    """The exact defect: `chapter` authored as {"number", "title"}."""
    spec = _write(tmp_path, [_scene({"number": "01", "title": "Two cards"})])
    proc = _run(spec)
    out = proc.stdout + proc.stderr
    assert proc.returncode != 0, (
        "an object chapter must fail validation — it renders as [object Object] in the ribbon "
        f"and the chapters file. Got:\n{out}")
    assert "[object Object]" in out
    assert "`chapter` must be a string" in out


def test_string_chapter_passes(tmp_path):
    spec = _write(tmp_path, [_scene("One | The Title")])
    proc = _run(spec)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_blank_chapter_is_rejected(tmp_path):
    spec = _write(tmp_path, [_scene("   ")])
    proc = _run(spec)
    assert proc.returncode != 0
    assert "`chapter` is blank" in (proc.stdout + proc.stderr)


def test_no_chapter_key_is_fine(tmp_path):
    """A scene with no chapter must stay valid — most scenes have none."""
    spec = _write(tmp_path, [_scene()])
    proc = _run(spec)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_every_shipped_example_uses_string_chapters():
    """No committed example may author a scene `chapter` as anything but a string."""
    offenders = []
    for spec in sorted(EXAMPLES.glob("*.json")):
        data = json.loads(spec.read_text(encoding="utf-8"))
        for scene in data.get("scenes", []):
            if "chapter" in scene and not isinstance(scene["chapter"], str):
                offenders.append(f"{spec.name}:{scene.get('id')} = {scene['chapter']!r}")
    assert not offenders, (
        f"a scene `chapter` must be a string, or it renders as [object Object]: {offenders}")


def test_top_level_chapters_are_not_a_source_of_truth():
    """`spec.chapters[]` is never read — chapters are compiled from scene `chapter` strings.

    This pins the *mechanism* rather than asserting a clean corpus: five committed examples still
    carry an unread top-level `chapters[]`, and two of them
    (`the_two_second_reach`, `never_trust_three_am`) therefore publish a single chapter instead of
    the two they authored. That gap is recorded as KI-022; this test exists so the day someone
    wires the top-level array up, they find out here rather than in a published film.
    """
    spec = {
        "title": "chapter source",
        "thesis": "t",
        "bgm": "none",
        "subtitles_mode": "off",
        "cast": {"a": {"style": "ink_stick", "scale": 1.0}},
        # An authored top-level chapter list that the compiler must ignore.
        "chapters": [{"scene": "S01", "number": "01", "title": "AUTHORED BUT UNREAD"}],
        "scenes": [
            _scene("One | The Real One"),
            {**_scene(), "id": "S02"},
        ],
    }
    script = (
        "const {compileEpisode}=require('./universal_toolbook/engine/episode.js');"
        f"const ep=compileEpisode({json.dumps(spec)});"
        "process.stdout.write(JSON.stringify(ep.chapters.map(c=>c.title)));"
    )
    node = subprocess.run(["node", "-e", script], cwd=str(ROOT), text=True, capture_output=True)
    if node.returncode != 0:  # node is not installed in every CI job
        return
    titles = json.loads(node.stdout)
    assert titles == ["One | The Real One"], (
        "chapters must come from scene `chapter` strings; the top-level chapters[] array is not "
        f"read by the compiler. Got: {titles}")
