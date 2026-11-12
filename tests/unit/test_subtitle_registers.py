"""The Python->JS contract of the display/spoken split.

`voice_engine.py` decides what the engine says and emits a display->spoken alignment;
`episode.js` turns that into burned-in subtitle tokens. These two halves were written
separately, so the contract between them is worth testing at the seam rather than trusting
each side in isolation.

Skipped when node is unavailable (the subtitle builder is JavaScript).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
ENGINE_DIR = ROOT / "universal_toolbook" / "engine"
EXAMPLES = ROOT / "examples"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="subtitle builder is JavaScript; needs node"
)


def _load_engine():
    """Import voice_engine without the tts package (which needs numpy)."""
    sys.path.insert(0, str(ROOT / "universal_toolbook"))
    import engine.voice_engine as ve  # noqa: PLC0415

    return ve


def _fake_word_timings(words, start=0.0, total=3.0):
    """Evenly spaced word timings -- stands in for a TTS backend's word boundaries."""
    step = total / max(1, len(words))
    return [
        {"word": w, "start": round(start + i * step, 3), "end": round(start + (i + 0.9) * step, 3)}
        for i, w in enumerate(words)
    ]


def _compile(spec):
    """Run the real episode compiler and return its JSON."""
    js = (
        "const fs=require('fs');"
        "const {compileEpisode}=require('./episode');"
        "const spec=JSON.parse(fs.readFileSync(0,'utf8'));"
        "console.log(JSON.stringify(compileEpisode(spec,{width:1920,height:1080,subtitlesMode:'cinema'})));"
    )
    out = subprocess.run(
        ["node", "-e", js],
        cwd=str(ENGINE_DIR),
        input=json.dumps(spec),
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(out.stdout)


def _scene_spec(display_text, duration=3.2):
    """A one-scene episode whose line has been through the engine's split."""
    ve = _load_engine()
    spoken, align = ve._line_speech(display_text, {})
    words = _fake_word_timings(spoken.split())
    end = words[-1]["end"] if words else 0.0
    return {
        "scenes": [
            {
                "id": "S01",
                "duration": duration,
                "dialogue": [{"speaker": "narrator", "text": display_text}],
                "line_timings": [
                    {
                        "speaker": "narrator",
                        "text": display_text,
                        "spoken_text": spoken,
                        "start": 0,
                        "end": end,
                        "words": words,
                        "align": align,
                    }
                ],
                "word_timings": words,
            }
        ]
    }


def _subtitle_tokens(compiled):
    tokens = []
    for scene in compiled["scenes"]:
        for sub in scene.get("subtitles") or []:
            tokens.extend(sub.get("tokens") or [])
    return tokens


def _subtitle_text(compiled):
    parts = []
    for scene in compiled["scenes"]:
        for sub in scene.get("subtitles") or []:
            parts.extend(t.get("raw", "") for t in sub.get("tokens") or [] if not t.get("isSpeakerLabel"))
    return " ".join(parts)


def test_subtitle_shows_the_written_form_not_the_spoken_one():
    """The defect, at the seam: board says 254, subtitle must also say 254."""
    compiled = _compile(_scene_spec("It takes 18 days to 254 days."))
    text = _subtitle_text(compiled)
    assert "254" in text
    assert "18" in text
    assert "two hundred" not in text.lower()
    assert "eighteen" not in text.lower()


def test_every_displayed_token_gets_a_timing():
    """An aligned line must leave no token untimed, or its glow would be blank."""
    compiled = _compile(_scene_spec("It takes 18 days to 254 days, not 21."))
    tokens = [t for t in _subtitle_tokens(compiled) if not t.get("isSpeakerLabel")]
    assert tokens
    for tok in tokens:
        assert tok.get("tStart") is not None, f"token {tok.get('raw')!r} has no start time"
        assert tok.get("tEnd") is not None, f"token {tok.get('raw')!r} has no end time"
        assert float(tok["tEnd"]) > float(tok["tStart"])


def test_numeral_highlight_spans_all_of_its_spoken_words():
    """`254` is voiced as five words, so its highlight must last those five words."""
    compiled = _compile(_scene_spec("It takes 18 days to 254 days."))
    tokens = [t for t in _subtitle_tokens(compiled) if not t.get("isSpeakerLabel")]
    tok = next(t for t in tokens if t.get("raw", "").rstrip(".,") == "254")
    span = float(tok["tEnd"]) - float(tok["tStart"])
    prev = next(t for t in tokens if t.get("raw", "") == "to")
    prev_span = float(prev["tEnd"]) - float(prev["tStart"])
    # "two hundred and fifty four" takes materially longer to say than "to".
    assert span > prev_span * 2


def test_unverbalized_line_is_unchanged():
    """A line already in spoken form takes the original path and keeps exact timings."""
    compiled = _compile(_scene_spec("The rule was never tested."))
    text = _subtitle_text(compiled)
    assert "The rule was never tested." in text or "rule was never tested" in text
    tokens = [t for t in _subtitle_tokens(compiled) if not t.get("isSpeakerLabel")]
    assert all(t.get("tStart") is not None for t in tokens)


def test_reproducer_scene_compiles_with_numerals_on_screen():
    """The real shipped spec: `the_two_free_stamps` S05 keeps its written numerals."""
    data = json.loads((EXAMPLES / "the_two_free_stamps_episode.json").read_text(encoding="utf-8"))
    scene = next(s for s in data["scenes"] if s["id"] == "S05")
    line = next(l for l in scene["dialogue"] if "Time to feeling automatic" in l["text"])
    compiled = _compile(_scene_spec(line["text"]))
    text = _subtitle_text(compiled)
    assert "254" in text
    assert "eighteen" not in text.lower()
    assert "two hundred" not in text.lower()
