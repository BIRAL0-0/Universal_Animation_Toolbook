"""Contracts for `tools/creative_gate.py`.

The gate is the only thing in the repository that checks the packaging *decisions* — that
candidates were produced, that one was chosen from them, that title/thumbnail/hook agree, and
that claims are labelled. These tests pin the behaviour that makes it useful:

* it passes on a record where the creative work was really done,
* it fails when the block is missing entirely (the state every video was in before this gate),
* it fails on the specific dishonest shortcuts the gate exists to catch — a single candidate
  passed off as a choice, a hook that is never spoken, a prediction used as a fact, and a script
  critique where nothing was criticised.

Every fixture here is synthetic and built in a temp directory; the shipped `videos/` packages are
audited by running the tool itself in CI.
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "tools" / "creative_gate.py"

DURATION = 90.0


def _dialogue():
    lines = [
        "A farmer planted a bamboo seed and watered it every single morning.",
        "Nothing appeared above the soil, and nothing appeared the next year either.",
        "The neighbours planted faster seed and their gardens grew tall around him.",
        "He kept watering, because the roots were growing the wrong way to see.",
        "In the fifth year the bamboo came up all at once, taller than the roof.",
        "The thing that looked like failure was the thing doing the work.",
    ]
    return [{"text": line} for line in lines]


def _record(**overrides) -> dict:
    """A minimal honest record: three candidates, one chosen, hooks actually spoken."""
    record = {
        "title": "The Seed That Looked Like Nothing",
        "slug": "the-seed-that-looked-like-nothing",
        "duration": DURATION,
        "scenes": [{"dialogue": _dialogue()}],
        "primary_keyword": "bamboo seed",
        "secondary_keywords": ["bamboo parable", "slow progress"],
        "title_alternates": ["Why The Fastest Garden Lost", "Five Years of Watering Nothing"],
        "hashtags": ["#perseverance", "#patience", "#motivation"],
        "category": "Education",
        "creative": {
            "hook_candidates": [
                {
                    "text": "A farmer planted a bamboo seed and watered it every single morning.",
                    "selected": True,
                    "why": "It starts inside the action, not before it.",
                    "seconds_into_video": 0.0,
                },
                {
                    "text": "Nothing appeared above the soil, and nothing appeared the next year either.",
                    "selected": False,
                    "seconds_into_video": 0.0,
                },
                {
                    "text": "The thing that looked like failure was the thing doing the work.",
                    "selected": False,
                    "seconds_into_video": 60.0,
                },
            ],
            "retention_map": [
                {"at_sec": 0.0, "kind": "hook", "purpose": "plant a seed that visibly does nothing"},
                {"at_sec": 30.0, "kind": "escalation", "purpose": "neighbours' gardens growing past him"},
                {"at_sec": 60.0, "kind": "reveal", "purpose": "roots were growing underground"},
                {"at_sec": 85.0, "kind": "payoff", "purpose": "bamboo arrives all at once"},
            ],
            "title_candidates": [
                {"text": "The Seed That Looked Like Nothing", "approach": "curiosity_gap", "selected": True},
                {"text": "Why The Fastest Garden Lost", "approach": "contradiction", "selected": False},
                {"text": "Five Years of Watering Nothing", "approach": "outcome_number", "selected": False},
                {"text": "Would You Keep Watering If Nothing Grew?", "approach": "question", "selected": False},
            ],
            "thumbnail_concepts": [
                {"focal_subject": "a bare patch of soil, one watering can", "emotion": "doubt", "selected": True},
                {"focal_subject": "a farmer's hand holding a single seed", "emotion": "resolve", "selected": False},
                {"focal_subject": "a neighbours' tall garden behind a low fence", "emotion": "envy", "selected": False},
            ],
            "alignment": {
                "title_promise": "something that looks like failure is not failure",
                "thumbnail_promise": "the bare soil is the subject, not the harvest",
                "hook_promise": "we start watering and nothing happens",
                "verdict": "aligned",
            },
            "claims": [
                {"text": "Bamboo can take years to surface above the soil.", "label": "O", "used_as": "fact"},
                {"text": "This framing will retain viewers.", "label": "P", "used_as": "prediction"},
            ],
            "script_critique": {
                "scores": {
                    "opening_hook": 4,
                    "clarity": 5,
                    "originality": 3,
                    "story_progression": 4,
                    "retention_potential": 4,
                    "emotional_impact": 4,
                    "visual_potential": 4,
                    "payoff": 5,
                    "accuracy": 4,
                    "pacing": 4,
                },
                "weakest": "originality",
                "revision": "Cut a scene that repeated the neighbours' garden beat.",
            },
        },
    }
    record.update(overrides)
    return record


def _write(tmp_path: Path, record: dict, slug: str | None = None) -> Path:
    slug = slug or record["slug"]
    pkg = tmp_path / slug
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "record.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return pkg


def _audit(record: dict) -> dict:
    sys.path.insert(0, str(ROOT / "tools"))
    import creative_gate  # noqa: PLC0415 — deliberate late import so the path insert wins

    return creative_gate.audit(record, record["slug"])


def test_honest_record_passes():
    result = _audit(_record())
    assert result["problems"] == [], result["problems"]


def test_record_without_creative_block_fails():
    """The pre-gate state of all eight shipped videos must not pass."""
    record = _record()
    del record["creative"]
    result = _audit(record)
    assert result["problems"]
    assert any("creative" in f.lower() for f in result["problems"])


def test_single_hook_candidate_fails():
    record = _record()
    hooks = record["creative"]["hook_candidates"]
    record["creative"]["hook_candidates"] = [hooks[0]]
    result = _audit(record)
    assert any("hook" in f.lower() for f in result["problems"]), result["problems"]


def test_hook_that_is_never_spoken_fails():
    """A hook written for the record but not in the film is a fabricated promise."""
    record = _record()
    record["creative"]["hook_candidates"][0]["text"] = (
        "Nobody tells you this one secret about bamboo that experts refuse to admit."
    )
    result = _audit(record)
    assert any("spoken" in f.lower() or "overlap" in f.lower() for f in result["problems"]), result["problems"]


def test_generic_opener_fails():
    record = _record()
    record["creative"]["hook_candidates"][0]["text"] = "In this video we are going to talk about bamboo."
    result = _audit(record)
    assert any("generic" in f.lower() for f in result["problems"]), result["problems"]


def test_prediction_used_as_fact_fails():
    record = _record()
    record["creative"]["claims"].append(
        {"text": "This thumbnail will get a 12% click-through rate.", "label": "P", "used_as": "fact"}
    )
    result = _audit(record)
    assert any("fact" in f.lower() for f in result["problems"]), result["problems"]


def test_flat_perfect_critique_fails():
    """Ten identical scores is a sheet that was never critiqued."""
    record = _record()
    critique = record["creative"]["script_critique"]
    critique["scores"] = {k: 5 for k in critique["scores"]}
    result = _audit(record)
    assert result["problems"], "a flat critique sheet must not pass"


def test_named_weakest_must_be_the_lowest_score():
    """You cannot name a weakness and then score it above the others."""
    record = _record()
    critique = record["creative"]["script_critique"]
    critique["weakest"] = "clarity"
    critique["scores"]["clarity"] = 5
    result = _audit(record)
    assert any("weakest" in f.lower() for f in result["problems"]), result["problems"]


def test_misaligned_verdict_fails():
    record = _record()
    record["creative"]["alignment"]["verdict"] = "unsure"
    result = _audit(record)
    assert any("align" in f.lower() for f in result["problems"]), result["problems"]


def test_selected_title_must_match_record_title():
    record = _record()
    record["title"] = "A Completely Different Title"
    result = _audit(record)
    assert any("title" in f.lower() for f in result["problems"]), result["problems"]


def test_identical_thumbnail_concepts_fail():
    """Three concepts of the same shot is one concept with two copies."""
    record = _record()
    concepts = record["creative"]["thumbnail_concepts"]
    concepts[1]["focal_subject"] = concepts[0]["focal_subject"]
    concepts[2]["focal_subject"] = concepts[0]["focal_subject"]
    result = _audit(record)
    assert any("thumbnail" in f.lower() or "concept" in f.lower() or "focal" in f.lower()
               for f in result["problems"]), result["problems"]


def test_retention_map_without_payoff_fails():
    record = _record()
    record["creative"]["retention_map"] = [
        {"at_sec": 0.0, "kind": "hook", "purpose": "start"},
        {"at_sec": 30.0, "kind": "escalation", "purpose": "middle"},
    ]
    result = _audit(record)
    assert any("retention" in f.lower() or "payoff" in f.lower() for f in result["problems"]), result["problems"]


def test_audit_does_not_mutate_the_record():
    record = _record()
    before = copy.deepcopy(record)
    _audit(record)
    assert record == before


def test_cli_exits_zero_on_the_shipped_packages():
    """The repository's own videos must satisfy the gate — no fixture, the real thing."""
    proc = subprocess.run(
        [sys.executable, str(GATE)], cwd=ROOT, capture_output=True, text=True
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "PASS" in proc.stdout
    # The gate must keep saying out loud that it cannot judge quality.
    assert "cannot judge" in proc.stdout


@pytest.mark.parametrize("slug", ["the-bamboo-seed", "the-first-plank", "discipline-vs-obsession"])
def test_shipped_packages_can_be_audited_individually(slug):
    proc = subprocess.run(
        [sys.executable, str(GATE), "--check", slug], cwd=ROOT, capture_output=True, text=True
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert slug in proc.stdout


def test_titles_from_too_few_strategies_fail():
    """Four wordings of one idea is not a strategy comparison."""
    record = _record()
    titles = record["creative"]["title_candidates"]
    for candidate in titles:
        candidate["approach"] = "curiosity_gap"
    result = _audit(record)
    assert any("distinct approach" in p for p in result["problems"]), result["problems"]


def test_unknown_approach_label_fails():
    record = _record()
    record["creative"]["title_candidates"][1]["approach"] = "vibes"
    result = _audit(record)
    assert any("unknown approach" in p for p in result["problems"]), result["problems"]


@pytest.mark.parametrize("field", [
    "primary_keyword", "secondary_keywords", "title_alternates", "hashtags", "category",
])
def test_missing_seo_field_fails(field):
    record = _record()
    del record[field]
    result = _audit(record)
    assert any(field in p for p in result["problems"]), result["problems"]


def test_hashtags_without_hash_fail():
    record = _record()
    record["hashtags"] = ["perseverance", "#patience", "#motivation"]
    result = _audit(record)
    assert any("leading '#'" in p for p in result["problems"]), result["problems"]


def test_alternate_titles_must_differ_from_the_title_in_use():
    record = _record()
    record["title_alternates"] = [record["title"], "Something Else"]
    result = _audit(record)
    assert any("repeats the title" in p for p in result["problems"]), result["problems"]


def test_too_many_secondary_keywords_fail():
    record = _record()
    record["secondary_keywords"] = ["a", "b", "c", "d"]
    result = _audit(record)
    assert any("secondary_keywords" in p for p in result["problems"]), result["problems"]
