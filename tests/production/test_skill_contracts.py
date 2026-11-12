"""Contracts for the skills system.

Two things broke here, and both were invisible because nothing checked them:

1. Four skills — including `animation-production`, the primary orchestrator, and
   `voiceover-audio` — did not carry the nine sections every other skill carries,
   and no skill had an explicit **Inputs** section at all. A skill an agent cannot
   rely on the shape of is a skill that gets skimmed.

2. `animation-scriptwriting` published word budgets that were arithmetically
   wrong: it said 150 words was long-form, but at its own stated 2.55 words/sec
   rate, 150 words is 58.8 seconds — portrait. Following it planned landscape
   staging into a portrait render.

3. `animation-production` invariant 8 still demanded `videos/video-XXX/final.mp4`,
   the exact filename `validate_publishing.py` rejects.

These tests pin all three.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SKILLS = sorted((ROOT / "skills").glob("*/SKILL.md"))

REQUIRED = (
    "purpose",
    "when to use",
    "inputs",
    "rules",
    "common mistakes",
    "quality checklist",
    "implementation references",
    "examples",
)
SYNONYMS = {
    "when to use": ("when to use", "when to activate", "trigger conditions"),
    "common mistakes": ("common mistake", "common failure", "failure mode"),
    "implementation references": ("implementation reference", "concrete engine recipe", "reference"),
}


def _headings(path: Path) -> str:
    return " | ".join(
        line.lstrip("# ").strip().lower()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.startswith("#")
    )


@pytest.mark.parametrize("skill", SKILLS, ids=lambda p: p.parent.name)
def test_every_skill_carries_the_required_sections(skill):
    joined = _headings(skill)
    missing = [
        name for name in REQUIRED
        if not any(word in joined for word in SYNONYMS.get(name, (name,)))
    ]
    assert not missing, f"{skill.parent.name} is missing: {missing}"


@pytest.mark.parametrize("skill", SKILLS, ids=lambda p: p.parent.name)
def test_every_skill_states_what_it_needs_as_input(skill):
    """A skill that never says what it needs cannot be started."""
    body = skill.read_text(encoding="utf-8")
    section = re.search(r"^## Inputs\s*$(.*?)(?=^## |\Z)", body, re.MULTILINE | re.DOTALL)
    assert section, f"{skill.parent.name} has no Inputs section"
    assert len(section.group(1).strip()) > 60, f"{skill.parent.name} has an empty Inputs section"


@pytest.mark.parametrize("skill", SKILLS, ids=lambda p: p.parent.name)
def test_every_skill_has_a_checklist(skill):
    assert "- [ ]" in skill.read_text(encoding="utf-8"), f"{skill.parent.name} has no checklist items"


def test_no_skill_prescribes_the_forbidden_master_filename():
    """`final.mp4` is a hard failure in validate_publishing; no skill may ask for it."""
    offenders = [
        skill.parent.name
        for skill in SKILLS
        if "video-XXX/final.mp4" in skill.read_text(encoding="utf-8")
    ]
    assert offenders == [], f"skills still prescribe videos/video-XXX/final.mp4: {offenders}"


def test_scriptwriting_word_budgets_agree_with_the_stated_speaking_rate():
    """The budgets the skill publishes must actually fall on the right side of 60 s.

    This is the check that would have caught the 150-words-is-landscape error.
    """
    body = (ROOT / "skills" / "animation-scriptwriting" / "SKILL.md").read_text(encoding="utf-8")
    rate_match = re.search(r"2\.55", body)
    assert rate_match, "the planning speaking rate is no longer stated"

    portrait = re.search(r"portrait is safe up to\s*\*\*~(\d+) words", body, re.IGNORECASE | re.DOTALL)
    landscape = re.search(r"landscape starts at\s*\*\*~(\d+) words", body, re.IGNORECASE | re.DOTALL)
    assert portrait and landscape, "word budgets are no longer published"

    rate = 2.55
    portrait_words = int(portrait.group(1))
    landscape_words = int(landscape.group(1))

    # The portrait budget must be under 60 s AND leave real headroom: the render is
    # speech-locked, and pauses push the real runtime past the raw word estimate.
    portrait_seconds = portrait_words / rate
    assert portrait_seconds < 55.0, (
        f"the portrait budget ({portrait_words} words = {portrait_seconds:.1f}s before pauses) is not "
        "far enough below 60 s to survive punctuation pauses"
    )

    # The landscape budget is a *minimum* for landscape planning, so it must not sit
    # more than a pause-budget below the boundary. The old published figure of 150
    # words is 58.8 s — under 60 — which is exactly the error this test exists to
    # catch: it told the writer to plan landscape staging for a portrait render.
    landscape_seconds = landscape_words / rate
    assert landscape_seconds >= 60.0 - 6.0, (
        f"the landscape budget ({landscape_words} words = {landscape_seconds:.1f}s) sits too far "
        "below the 60 s boundary; it would plan landscape staging for a portrait render"
    )
    assert landscape_seconds - portrait_seconds >= 5.0, (
        "the portrait and landscape budgets are too close to separate the two cases"
    )

    assert portrait_words < landscape_words


def test_no_skill_contradicts_the_format_boundary():
    """Every mention of the boundary inside skills must use the same exclusive/inclusive rule."""
    bad = []
    for skill in SKILLS:
        text = skill.read_text(encoding="utf-8")
        # a boundary written the wrong way round would read as ">60 is portrait"
        if re.search(r">\s*60[^\n]{0,40}9:16", text):
            bad.append(skill.parent.name)
    assert bad == [], f"skills describe the format boundary inconsistently: {bad}"


def test_skills_index_lists_every_skill():
    index = (ROOT / "skills" / "README.md").read_text(encoding="utf-8")
    missing = [s.parent.name for s in SKILLS if f"]({s.parent.name}/SKILL.md)" not in index]
    assert missing == [], f"skills/README.md does not link: {missing}"
