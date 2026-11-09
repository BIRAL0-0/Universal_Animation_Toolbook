"""Regression test for KI-008: mixes rendered ~6 dB under the documented loudness band.

Measurement (2026-11-09, video-001 master): peak −1.72 dBFS (in band) but RMS −24.07 dBFS
against the documented healthy band of −16 … −19 dBFS (universal_toolbook/process/05_AUDIO.md).
Windowed analysis proved it was **not** dead air — 0% of 1-second windows were near-silent and the
median *active* window was −24.2 dBFS — so the whole mix was simply too quiet.

Root cause: ``engine/audio_mixer.py`` applied a peak *ceiling* (soft limiter) but no loudness
*target*, and the render report recorded peak only, so the gate could not see RMS at all. Prior
shipped films' reports carry ``rms_dbfs: null`` for exactly this reason.

Fix: a bounded make-up stage after the limiter drives RMS toward the −17.5 dBFS midpoint, limited
by (a) the RMS target, (b) the −1 dBFS peak ceiling and (c) a hard +6 dB cap; and the mixer now
returns ``rms_dbfs`` / ``rms_dbfs_before_makeup`` / ``loudness_makeup_gain_db`` so every report and
gate can see loudness.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MIXER = REPO_ROOT / "universal_toolbook" / "engine" / "audio_mixer.py"

PEAK_BAND = (-3.0, -1.0)
RMS_BAND = (-19.0, -16.0)


def test_mixer_reports_rms_not_just_peak():
    src = MIXER.read_text(encoding="utf-8")
    for key in ('"rms_dbfs"', '"rms_dbfs_before_makeup"', '"loudness_makeup_gain_db"'):
        assert key in src, f"mixer no longer reports {key}; the loudness gate is blind without it"


def test_makeup_stage_is_bounded_and_cannot_clip():
    src = MIXER.read_text(encoding="utf-8")
    assert "gain_for_peak" in src, "make-up gain must be bounded by the peak ceiling"
    assert "8.0 / 20.0" in src, "the hard +8 dB make-up cap is missing"
    assert "max(1.0, min(gain_for_rms, gain_for_peak" in src, \
        "make-up must never attenuate and must respect both bounds"


def test_transient_limiter_precedes_makeup():
    """KI-008 diagnosis: an RMS-envelope compressor cannot see 3 ms transients, so the fix needs a
    fast-attack peak limiter before make-up. Pin its parameters."""
    src = MIXER.read_text(encoding="utf-8")
    assert "0.003 * SAMPLE_RATE" in src, "3 ms limiter hop is missing"
    assert "ratio = 6.0" in src, "limiter ratio changed"
    assert src.index("thr = 10.0 ** (-10.0 / 20.0)") < src.index("target_dbfs = -17.5"), \
        "the limiter must run before make-up gain"


def test_shipped_masters_are_inside_both_loudness_bands():
    """The real gate: every measured master in projects/ must sit in the documented bands."""
    projects = REPO_ROOT / "projects"
    if not projects.exists():
        return
    seen = 0
    for qm in projects.rglob("qa_measurements.json"):
        m = json.loads(qm.read_text(encoding="utf-8"))["stages"].get("measure") or {}
        if not m.get("rate"):
            continue
        seen += 1
        peak, rms = m["peak_dbfs"], m["rms_dbfs"]
        assert PEAK_BAND[0] <= peak <= PEAK_BAND[1], \
            f"{qm.parent.name}: peak {peak} dBFS outside {PEAK_BAND}"
        assert RMS_BAND[0] <= rms <= RMS_BAND[1], \
            f"{qm.parent.name}: RMS {rms} dBFS outside {RMS_BAND} (KI-008)"
    assert seen, "no measured masters found; run tools/produce_video.py to produce measurements"


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
