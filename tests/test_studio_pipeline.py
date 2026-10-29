#!/usr/bin/env python3
"""End-to-end Python, Voice Sync, Board/Camera Timing & BGM pipeline tests for Universal Animation Toolbook."""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "universal_toolbook"
sys.path.insert(0, str(ROOT))

from engine.bgm_library import load_bgm_catalog, render_bgm_bed, score_script_for_bgm
from engine.voice_engine import (
    align_scene_board_to_speech,
    align_scene_cameras_to_speech,
    compact_internal_silences_with_words,
)
from tools.script_helper import segment_user_script, verify_script_fidelity

sys.path.insert(0, str(ROOT.parent))
from universal_toolbook.run_studio import _voice_diagnosis  # noqa: E402


def main() -> int:
    # 1. Verify all 7 bundled Creative Commons / NCS-style BGM tracks exist & load
    catalog = load_bgm_catalog()
    assert len(catalog) == 7, f"Expected 7 bundled CC/NCS BGM tracks, got {len(catalog)}"
    for item in catalog:
        fpath = ROOT / "assets" / "bgm" / item["file"]
        assert fpath.exists() and fpath.stat().st_size > 500_000, f"Missing BGM {fpath}"

    # 2. Verify script-mood BGM matcher responds accurately to script vocabulary
    tech_pick = score_script_for_bgm("algorithm data system code engineer strategy", [], catalog)
    assert tech_pick["id"] == "electronic_drive"

    suspense_pick = score_script_for_bgm("mystery crime danger crisis collapse secret risk", [], catalog)
    assert suspense_pick["id"] == "suspense_tension"

    ncs_pick = score_script_for_bgm("fast energy challenge launch momentum sport action win", [], catalog)
    assert ncs_pick["id"] == "upbeat_ncs_synth"

    # 3. Verify seamless loop crossfade rendering for >3.5 minute duration
    fake_ep = {"title": "Test", "thesis": "Data", "scenes": [{"mood": "focus", "narration": "system code"}]}
    bed, meta = render_bgm_bed(44100 * 210, fake_ep, bgm_choice="auto")
    assert bed.shape == (44100 * 210, 2)
    assert meta["selected_id"] == "electronic_drive"

    # 4. Verify script_helper preserves 100% of exact user script wording with neutral roles
    custom_script = (
        "[Chapter: Opening Premise]\n"
        "Every complex system begins with a simple rule. When builders test ideas in the real world, "
        "data reveals what assumptions hide.\n\n"
        "Consistency compounds quietly until the outcome becomes undeniable."
    )
    parsed = segment_user_script(custom_script, title="Universal Test", target_words_per_scene=22)
    fidelity = verify_script_fidelity(custom_script, parsed)
    assert fidelity["exact_word_match"] is True, f"Script mismatch: {fidelity}"

    # 5. Verify V3 internal TTS silence compactor trims mid-sentence dead air & shifts WordBoundary timestamps
    sr = 44100
    with tempfile.TemporaryDirectory() as td:
        wav_path = Path(td) / "test_pause.wav"
        # 0.40s tone + 0.85s internal silence + 0.40s tone = 1.65s total
        tone = [4000 if (i % 40) < 20 else -4000 for i in range(int(0.40 * sr))]
        sil = [0] * int(0.85 * sr)
        pcm = tone + sil + tone
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(struct.pack(f"<{len(pcm)}h", *pcm))
        words_in = [
            {"word": "First", "start": 0.05, "end": 0.38},
            {"word": "Second", "start": 1.25, "end": 1.60},
        ]
        new_dur, words_out = compact_internal_silences_with_words(wav_path, words_in)
        assert new_dur < 1.10, f"Expected internal 0.85s silence to compact below 1.10s, got {new_dur}"
        assert abs(words_out[0]["start"] - 0.05) < 0.01
        assert words_out[1]["start"] < 0.72, f"Expected second word timestamp to shift earlier, got {words_out[1]}"

    # 6. Verify V3 speech-locked board & camera `cue_on` / `hide_on` (never misfires on earlier stopwords!)
    mock_words = [
        {"word": "No", "start": 0.40, "end": 0.65},
        {"word": "one", "start": 0.68, "end": 0.90},
        {"word": "saw", "start": 0.95, "end": 1.20},
        {"word": "the", "start": 1.25, "end": 1.40},
        {"word": "cost", "start": 1.45, "end": 1.85},
        {"word": "until", "start": 4.20, "end": 4.50},
        {"word": "no", "start": 4.55, "end": 4.75},
        {"word": "excuses", "start": 4.80, "end": 5.35},
        {"word": "turned", "start": 7.80, "end": 8.15},
        {"word": "into", "start": 8.20, "end": 8.45},
        {"word": "burnout", "start": 8.50, "end": 9.10},
    ]
    mock_scene = {
        "board": {
            "type": "stat_cards",
            "cue_on": "no excuses",
            "hide_on": "burnout",
        },
        "camera_shots": [
            {"start": 0.0, "end": 3.0, "zoom_from": 1.0, "zoom_to": 1.05},
            {"cue_on": "no excuses", "zoom_from": 1.18, "zoom_to": 1.24},
            {"cue_on": "turned into burnout", "zoom_from": 1.08, "zoom_to": 1.02},
        ],
    }
    align_scene_board_to_speech(mock_scene, mock_words, 16.0)
    align_scene_cameras_to_speech(mock_scene, mock_words, 16.0)

    rev_at = mock_scene["board"]["reveal_at"]
    hide_at = mock_scene["board"]["hide_at"]
    assert 4.45 <= rev_at <= 4.60, f"Board must NOT trigger prematurely on 'No' at 0.40s; got {rev_at}"
    assert 9.50 <= hide_at <= 9.80, f"Board must hide cleanly right after 'burnout' at 9.10s; got {hide_at}"
    assert abs(mock_scene["camera_shots"][1]["start"] - 4.49) < 0.10
    assert abs(mock_scene["camera_shots"][2]["start"] - 7.74) < 0.10

    # 3. A voice run that synthesizes nothing must explain itself instead of failing silently:
    #    the renderer turns this diagnosis into `status: COMPLETE_SILENT` + exit code 3.
    missing_edge = _voice_diagnosis({"edge_tts": False})
    assert missing_edge, "voice diagnosis must never be empty when no backend produced speech"
    assert any("pip install" in line for line in missing_edge), missing_edge
    assert any("edge-tts is not installed" in line for line in missing_edge), missing_edge
    with_edge = _voice_diagnosis({"edge_tts": True})
    assert any("no internet" in line for line in with_edge), with_edge
    assert any("piper-tts" in line for line in with_edge), with_edge

    print(
        json.dumps(
            {
                "py_tests": "PASSED",
                "voice_failure_diagnosis": "PASSED",
                "bgm_tracks_verified": len(catalog),
                "script_mood_matching": "PASSED",
                "silence_compactor_verified": True,
                "speech_locked_board_and_camera_verified": True,
                "exact_word_match": True,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
