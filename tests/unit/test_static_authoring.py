"""Contracts that keep a film from turning into a slideshow.

These exist because of a real failure. `the-first-plank` v3 shipped at 130 s and
read as a still: a figure stood with its arms at its sides, unchanged, for six
seconds at a time. Three separate rules had conspired to cause it:

1. `motion_library` gave a non-speaking character `speakBoost = 0.0`, freezing
   conversational body language. Only ~30% of dialogue lines are spoken by a
   character, so for 70% of the film every on-screen actor was frozen.
2. `idle_stand` — the pose almost every hold resolves to — animated only a
   ribcage breath. Character-region frame delta measured 0.500, against 9.753
   for `walk`: a 20x gap, invisible to the eye.
3. Nothing in the pipeline noticed. `creative_review` compared whole frames
   against an absolute threshold, so a typing board and a subtitle glow that
   changed every frame hid an otherwise motionless stage.

Each test below pins one of those lessons. They assert on behaviour that can be
measured from the source of truth, not on a rendered score.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "universal_toolbook" / "engine"
MOTION = ENGINE / "motion_library.js"
VALIDATOR = ROOT / "tools" / "validate_specs.py"

EXAMPLES = sorted((ROOT / "examples").glob("*.json"))
TEMPLATES = sorted((ROOT / "universal_toolbook" / "templates").glob("*.json"))
ALL_SPECS = EXAMPLES + TEMPLATES


def _import_validator():
    import importlib.util

    spec = importlib.util.spec_from_file_location("validate_specs", VALIDATOR)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_non_speaking_character_still_animates():
    """A listener is an actor, not a prop. speakBoost must never collapse to zero."""
    source = MOTION.read_text(encoding="utf-8")
    assert "const LISTEN_BOOST" in source, (
        "the listening-pose constant was removed; a silent character freezes again"
    )
    # The boost must be a positive number, so body language survives narration.
    line = next(l for l in source.splitlines() if "const LISTEN_BOOST" in l)
    value = float(line.split("=")[1].strip().rstrip(";"))
    assert value > 0.2, (
        f"LISTEN_BOOST is {value}; below ~0.2 the hold reads as a freeze-frame"
    )


def test_idle_pose_uses_shared_secondary_motion_layer():
    """KI-020 centralizes held-pose movement instead of double-driving idle."""
    source = MOTION.read_text(encoding="utf-8")
    assert "const SECONDARY_MOTION_ACTIONS = new Set([" in source
    assert "'idle_stand'" in source.split("const SECONDARY_MOTION_ACTIONS", 1)[1].split("]);", 1)[0]
    assert "return applySecondaryMotion(curState, cur, globalT" in source
    assert "secondaryMotionStrength(prev, ts)" in source
    marker = "// Default: idle_stand"
    assert marker in source
    idle = source.split(marker, 1)[1][:1800]
    assert "applySecondaryMotion" not in idle, "idle_stand must not duplicate the shared layer"
    assert "microGaze" in idle and "slowShift" in idle


def test_no_spec_holds_one_pose_for_a_whole_scene():
    """The authoring defect the validator now blocks.

    `discipline-vs-obsession` used to hold `celebrate_arms_up` for 64.8 seconds.
    No amount of camera work rescues that; the spec has to change.
    """
    module = _import_validator()
    offenders = []
    for spec in ALL_SPECS:
        offenders += module.motion_problems(spec)
    assert not offenders, (
        "specs hold a single pose for longer than the motion budget:\n  "
        + "\n  ".join(offenders)
    )


def test_motion_budget_is_tight_enough_to_matter():
    """A budget that allows 30 s holds would pass everything and catch nothing."""
    module = _import_validator()
    assert module.MAX_SINGLE_BEAT_SEC <= 8.0, (
        "MAX_SINGLE_BEAT_SEC is so loose the check cannot fire"
    )


@pytest.mark.parametrize("spec", ALL_SPECS, ids=lambda p: p.name)
def test_spec_beats_do_not_overlap_or_run_backwards(spec: Path):
    """Re-timing beats is only safe if the arithmetic stays a valid partition.

    The static-authoring fix rewrote beat boundaries in every example, so this
    guards that work: each character's beats must advance monotonically and
    stay inside its scene.
    """
    data = json.loads(spec.read_text(encoding="utf-8"))
    for scene in data.get("scenes", []):
        duration = float(scene.get("duration") or 0)
        for character in scene.get("characters", []):
            beats = character.get("beats") or []
            cursor = 0.0
            for beat in beats:
                start = float(beat.get("start") or 0)
                end = float(beat.get("end") or 0)
                ident = f"{spec.name}:{scene.get('id')}:{character.get('id')}"
                assert end > start, f"{ident} has a beat that ends before it starts"
                assert start >= cursor - 1e-6, f"{ident} has overlapping beats"
                assert end <= duration + 1e-6, (
                    f"{ident} has a beat running past the scene end"
                )
                cursor = end
