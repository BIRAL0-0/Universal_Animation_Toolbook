#!/usr/bin/env python3
"""Tests for the title/thumbnail complementarity rule and the composer's geometry.

The rule under test: a thumbnail's overlay text must add information the title
does not already carry, in one to three words. Repeating the title wastes the
single most valuable click surface on the platform.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import thumbnail_copy  # noqa: E402


def record(title, hook):
    return {"title": title, "thumbnail_text": hook}


APPROVED = [
    ("The Two-Inch Bridge: What a 2-Inch Shortcut Really Costs", "NOBODY NOTICED"),
    ("Limiting Beliefs: Did You Agree to That Wall?", "IT WAS NEVER REAL"),
    ("Discipline vs Obsession: The 9 PM vs 2 AM Problem", "FIVE HOURS DIFFERENCE"),
    ("3 AM Anxiety: Why Checking the Clock Makes It Worse", "DON'T LOOK"),
    ("Phone Distraction: The 2-Second Reach That Ends Focus", "TWO STEPS"),
    ("Notifications Cost You 23 Minutes (Every Single Time)", "ELEVEN BEFORE NOON"),
    ("Procrastination: Why 1 Plank Beats a Whole Bridge", "NEAR EDGE"),
]

# The exact copy this rule was written to catch — every one restates its title.
REJECTED = [
    ("Discipline vs Obsession: The 9 PM vs 2 AM Problem", "DISCIPLINE OBSESSION"),
    ("3 AM Anxiety: Why Checking the Clock Makes It Worse", "NEVER CHECK AT 3 AM"),
    ("Procrastination: Why 1 Plank Beats a Whole Bridge", "THE FIRST PLANK"),
    ("Cutting Corners: What a 2-Inch Shortcut Really Costs", "2 INCHES IS NOTHING"),
    ("Phone Distraction: The 2-Second Reach That Ends Focus", "JUST 2 SECONDS"),
    ("Limiting Beliefs: Did You Agree to That Wall?", "THE WALL YOU AGREED WITH"),
    ("Notifications Cost You 23 Minutes (Every Single Time)", "EVERY BUZZ COSTS 23 MINUTES"),
]


@pytest.mark.parametrize("title,hook", APPROVED)
def test_approved_hooks_complement_their_title(title, hook):
    result = thumbnail_copy.audit(record(title, hook))
    assert result["ok"], result["notes"]
    assert result["words"] <= 3


@pytest.mark.parametrize("title,hook", REJECTED)
def test_rejected_hooks_restate_their_title(title, hook):
    assert not thumbnail_copy.audit(record(title, hook))["ok"]


def test_missing_declaration_fails_rather_than_passing_silently():
    result = thumbnail_copy.audit({"title": "Something Entirely Descriptive"})
    assert not result["ok"]
    assert "no thumbnail_text" in result["notes"][0]


def test_four_words_is_too_many():
    result = thumbnail_copy.audit(record("Procrastination: Why 1 Plank Beats a Whole Bridge",
                                         "FIVE HOURS ONE PLANK"))
    assert not result["ok"]
    assert any("unreadable at phone size" in note for note in result["notes"])


def test_stopwords_do_not_inflate_the_word_count():
    # three words on screen, but only "never" and "real" carry meaning
    assert thumbnail_copy.audit(record("Limiting Beliefs: Did You Agree to That Wall?",
                                       "IT WAS NEVER REAL"))["words"] == 2


def test_sharing_one_word_with_a_long_title_is_allowed():
    # 28.6% of the studied sample mixed new and shared wording; that is a pass
    result = thumbnail_copy.audit(record("Procrastination: Why 1 Plank Beats a Whole Bridge",
                                         "ONE PLANK LEFT"))
    assert result["words"] == 3
    assert result["overlap"] < thumbnail_copy.MAX_OVERLAP


def test_every_package_in_the_repo_complies():
    """The rule is enforced on the real repository, not just on fixtures."""
    import json

    packages = list((ROOT / "videos").glob("*/record.json"))
    assert packages, "no video packages found"
    for path in packages:
        result = thumbnail_copy.audit(json.loads(path.read_text()))
        assert result["ok"], f"{path.parent.name}: {result['notes']}"


def test_cli_exits_zero_on_this_repo(capsys):
    assert thumbnail_copy.main([]) == 0
    assert "PASS" in capsys.readouterr().out
