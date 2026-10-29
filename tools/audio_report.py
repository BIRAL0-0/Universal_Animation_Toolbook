#!/usr/bin/env python3
"""Measure the real master mix: peak, loudness, narration-vs-bed separation, silence gaps, clipping.

    python3 tools/audio_report.py <master_audio.wav> <vo_manifest.json>

Everything is computed from the PCM itself (no ffmpeg filters, because `volumedetect` prints
nothing in this sandbox). Blocks are 50 ms; speech windows come from the voice manifest.
"""
from __future__ import annotations

import argparse
import json
import math
import wave

import numpy as np

BLOCK_S = 0.05
SILENCE_DB = -45.0


def dbfs(x: float) -> float:
    return 20.0 * math.log10(max(float(x), 1e-9))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("wav")
    ap.add_argument("manifest")
    args = ap.parse_args()

    with wave.open(args.wav, "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        ch = w.getnchannels()
        raw = np.frombuffer(w.readframes(n), dtype="<i2")
    st = raw.reshape(-1, ch).astype(np.float64) / 32768.0
    mono = st.mean(axis=1)

    man = json.load(open(args.manifest))
    # NOTE: vo_manifest `speech_intervals` are ABSOLUTE master-timeline seconds -- the mixer feeds
    # them straight to the duck bus. Do not add scene_start again (that was a bug once).
    speech = []
    for seg in man["segments"]:
        for a, b in seg.get("speech_intervals") or []:
            speech.append((float(a), float(b)))

    nb = int(BLOCK_S * sr)
    blocks = mono[: (len(mono) // nb) * nb].reshape(-1, nb)
    rms = np.sqrt((blocks**2).mean(axis=1))
    db = 20.0 * np.log10(np.maximum(rms, 1e-9))
    mask = np.zeros(len(db), dtype=bool)
    for s, e in speech:
        mask[int(s / BLOCK_S) : int(e / BLOCK_S)] = True

    full_scale = int((np.abs(mono) >= 0.9995).sum())
    quiet = db < SILENCE_DB
    runs, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            runs.append((round(i * BLOCK_S, 2), round((j - i) * BLOCK_S, 2)))
            i = j
        else:
            i += 1
    runs.sort(key=lambda r: -r[1])

    out = {
        "sample_rate": sr,
        "channels": ch,
        "duration_sec": round(len(mono) / sr, 2),
        "true_peak_dbfs": round(dbfs(np.abs(mono).max()), 2),
        "program_rms_dbfs": round(dbfs(math.sqrt(float((mono**2).mean()))), 2),
        "clipping_samples_at_full_scale": full_scale,
        "dc_offset": round(float(mono.mean()), 6),
        "speech_windows": len(speech),
        "speech_total_sec": round(sum(e - s for s, e in speech), 2),
        "median_rms_during_speech_dbfs": round(float(np.median(db[mask])), 2) if mask.any() else None,
        "median_rms_outside_speech_dbfs": round(float(np.median(db[~mask])), 2) if (~mask).any() else None,
        "narration_over_bed_db": (
            round(float(np.median(db[mask]) - np.median(db[~mask])), 2) if mask.any() and (~mask).any() else None
        ),
        "longest_quiet_runs_sec": runs[:4],
        "blocks_below_-45dbfs": int(quiet.sum()),
        "fade_tail_quiet_sec": round(float(len(db) * BLOCK_S - (np.where(~quiet)[0][-1] + 1) * BLOCK_S), 2) if (~quiet).any() else None,
    }
    print(json.dumps(out, indent=2))
    bad = []
    if full_scale:
        bad.append("clipping: samples at full scale")
    if out["true_peak_dbfs"] > -1.0:
        bad.append("true peak above -1 dBFS")
    if out["fade_tail_quiet_sec"] is not None and out["fade_tail_quiet_sec"] < 0.5:
        bad.append("no quiet tail on the fade to black")
    if out["longest_quiet_runs_sec"] and out["longest_quiet_runs_sec"][0][1] > 3.0:
        bad.append("dead air longer than 3 s")
    # Narration-vs-music separation is measured from stems by tools/mix_probe.py, not here:
    # in the full mix the bed legitimately swells into every pause, so a gap-vs-speech ratio of the
    # *mix* says nothing about the balance.
    print("VERDICT:", "PASS" if not bad else "FAIL " + "; ".join(bad))
    return 0 if not bad else 2


if __name__ == "__main__":
    raise SystemExit(main())
