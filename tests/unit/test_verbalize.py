"""Spoken-form verbalization: the subtitle/audio register split.

The defect these tests lock down: a film had ONE string per dialogue line, so
VOICEOVER_POLISH_PROMPT rules 5-7 had to be hand-applied into the text the viewer reads.
A board reading ``254 days`` therefore sat under a subtitle reading "two hundred and fifty
four days". Subtitles must show what was written; only the audio is verbalized.

Two properties matter most and are asserted hardest:

* **idempotence** -- running the verbalizer over already-correct speech changes nothing.
  Every shipped film already says its numbers correctly, so this is what guarantees the
  change cannot alter a single existing render.
* **alignment** -- a displayed token maps onto an exact span of spoken words, so the
  subtitle glow stays frame-accurate even though ``254`` became five words.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
VERBALIZE = ROOT / "universal_toolbook" / "tts" / "verbalize.py"
EXAMPLES = ROOT / "examples"


def _load():
    """Load verbalize.py by path.

    The ``tts`` package ``__init__`` imports numpy for the audio backends, and the unit
    suite runs in a lean environment without it. The module is deliberately pure-text, so
    loading it directly is also the honest test of that claim.
    """
    import sys

    name = "_utb_verbalize_under_test"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, VERBALIZE)
    module = importlib.util.module_from_spec(spec)
    # dataclasses resolves annotations through sys.modules, so register before exec.
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def vz():
    return _load()


# --------------------------------------------------------------------- rules 5-7

# Each case is straight out of VOICEOVER_POLISH_PROMPT rules 5-7.
RULE_CASES = {
    # rule 5: numbers and symbols written as spoken
    "9 PM": "nine in the evening",
    "3 AM": "three in the morning",
    "40-90 seconds": "forty to ninety seconds",
    "1.5x": "one and a half times",
    "20%": "twenty percent",
    "254 days": "two hundred and fifty four days",
    "21 days": "twenty one days",
    "18 days to 254 days": "eighteen days to two hundred and fifty four days",
    "$5": "five dollars",
    "1st place": "first place",
    "2,500 people": "two thousand five hundred people",
    # rule 5: years and dates
    "In 1927 the bridge opened.": "In nineteen twenty seven the bridge opened.",
    "7 Nov 2076": "the seventh of November twenty seventy six",
    "7/nov/2076": "the seventh of November twenty seventy six",
    "7-Nov-2076": "the seventh of November twenty seventy six",
    # rule 7: technical names
    "H.264": "H two sixty four",
    # rule 6/7: the documented pronunciation dictionary is applied too
    "TTS and AI and GPU": "text to speech and A I and G P U",
}


@pytest.mark.parametrize("written,speech", sorted(RULE_CASES.items()))
def test_rule_case(vz, written, speech):
    assert vz.verbalize(written).spoken == speech


def test_cardinal_british_style(vz):
    assert vz.spell_number(254) == "two hundred and fifty four"
    assert vz.spell_number(2500) == "two thousand five hundred"
    assert vz.spell_number(21) == "twenty one"
    assert vz.spell_number(0) == "zero"


def test_year_vs_count_is_contextual(vz):
    """`1927` is a year after "in", but a plain count in front of a noun."""
    assert vz.verbalize("In 1927 the bridge opened.").spoken.startswith("In nineteen twenty seven")
    assert vz.verbalize("1927 people came").spoken.startswith("one thousand nine hundred and twenty seven")


def test_ordinals(vz):
    assert vz.spell_ordinal(1) == "first"
    assert vz.spell_ordinal(2) == "second"
    assert vz.spell_ordinal(3) == "third"
    assert vz.spell_ordinal(12) == "twelfth"
    assert vz.spell_ordinal(21) == "twenty first"


# --------------------------------------------------------------------- the contract


def test_display_text_is_never_modified(vz):
    """This is the whole point: the written form survives verbatim for the subtitle."""
    text = "It takes 18 days to 254 days, not 21."
    result = vz.verbalize(text)
    assert result.text == text
    assert result.spoken != text
    assert "254" in result.text
    assert "two hundred and fifty four" in result.spoken


def test_alignment_covers_every_spoken_word_exactly_once(vz):
    result = vz.verbalize("It takes 18 days to 254 days, not 21.")
    covered = []
    for tok in result.tokens:
        covered.extend(range(tok.word_start, tok.word_end))
    # Every spoken word is claimed by exactly one display token, in order.
    assert covered == list(range(len(result.words)))
    assert len(result.words) == len(result.spoken.split())


def test_alignment_maps_numeral_to_its_spoken_span(vz):
    """`254` must own all five of its spoken words, so its highlight lasts their whole span."""
    result = vz.verbalize("It takes 18 days to 254 days, not 21.")
    tok_254 = next(t for t in result.tokens if t.raw == "254")
    assert result.words[tok_254.word_start : tok_254.word_end] == [
        "two", "hundred", "and", "fifty", "four",
    ]


def test_punctuation_only_token_voices_nothing(vz):
    result = vz.verbalize("wait — what?")
    dash = next(t for t in result.tokens if t.raw == "—")
    assert dash.word_end == dash.word_start


def test_already_spoken_text_is_untouched():
    """Idempotence, stated directly: verbalizing speech is a no-op."""
    vz = _load()
    for text in (
        "It takes twenty one days.",
        "The seventh of November twenty seventy six.",
        "forty to ninety seconds",
        "one and a half times",
    ):
        assert vz.verbalize(text).spoken == text


def _shipped_lines():
    for path in sorted(EXAMPLES.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for scene in data.get("scenes") or []:
            for line in scene.get("dialogue") or []:
                text = str(line.get("text") or "")
                if text.strip():
                    yield path.name, scene.get("id"), text


def test_verbalizing_is_idempotent():
    """Applying the rules to their own output is a no-op.

    This is the property that keeps the module safe to run on a script that has already
    been written in spoken form, and it is why the engine can run it unconditionally.
    """
    vz = _load()
    checked = 0
    for name, sid, text in _shipped_lines():
        once = vz.verbalize(text).spoken
        twice = vz.verbalize(once).spoken
        checked += 1
        assert twice == once, f"{name}:{sid} not idempotent: {once!r} -> {twice!r}"
    assert checked > 100, f"expected a real corpus, only found {checked} lines"


def test_no_shipped_line_speaks_a_digit():
    """Rule 5: "never leave a token a reader pronounces but a listener would not".

    A digit reaching the engine is exactly what backends spell inconsistently, so the
    spoken register must be digit-free for every line in the shipped corpus.
    """
    vz = _load()
    offenders = []
    for name, sid, text in _shipped_lines():
        spoken = vz.verbalize(text).spoken
        if any(ch.isdigit() for ch in spoken):
            offenders.append(f"{name}:{sid}: {spoken!r}")
    assert not offenders, "spoken text still contains digits:\n" + "\n".join(offenders)


def test_reproducer_subtitle_keeps_the_written_form():
    """The original defect, end to end.

    `the_two_free_stamps` S05 shows 18 / 66 / 254 on a board and used to say all three
    spelled out in the subtitle -- the same facts twice, in two registers, in one frame.
    The line now carries the written numerals for the subtitle while the audio still
    says "eighteen ... two hundred and fifty four".
    """
    vz = _load()
    data = json.loads((EXAMPLES / "the_two_free_stamps_episode.json").read_text(encoding="utf-8"))
    scene = next(s for s in data["scenes"] if s["id"] == "S05")
    line = next(
        l for l in scene["dialogue"]
        if "Time to feeling automatic" in str(l.get("text"))
    )
    text = line["text"]
    # What the viewer reads: the numerals the board also shows.
    assert "18 days" in text and "254" in text
    assert "eighteen" not in text.lower()
    # What the engine says: the spoken form, unchanged from before the fix.
    assert vz.verbalize(text).spoken == (
        "Time to feeling automatic ran from eighteen days to two hundred and fifty four."
    )


# --------------------------------------------------------------------- script defects


def test_unvoiceable_symbols_are_reported(vz):
    """Rule 5 says never leave a token a listener would not hear."""
    assert vz.unvoiceable_tokens("Growth 20% → 40%") == ["%", "→"]
    assert vz.unvoiceable_tokens("plain words only") == []
