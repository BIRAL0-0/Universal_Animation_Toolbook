#!/usr/bin/env python3
"""Measure the master mix bands (narration vs. music bed vs. foley) without rendering any video.

`bgm_gain` is the only music lever a scene has, so it gets tuned with numbers instead of guesses:

  * narration level  -> the real soundtrack build with BGM disabled (voice + foley only)
  * music bed        -> `render_bgm_bed()` at the same base_gain the mixer uses, with the mixer's
                        own phrase duck (1 - 0.665 * smoothed speech mask) applied

    python3 tools/mix_probe.py [episode_spec] [work_dir]

`work_dir` must contain episode_retimed.json + vo_manifest.json from a previous render (any draft).
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "universal_toolbook"
sys.path.insert(0, str(STUDIO))

BLOCK_S = 0.05


def db(x):
    return 20.0 * np.log10(np.maximum(np.asarray(x, dtype=np.float64), 1e-9))


def main() -> int:
    spec_path = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "work/the_beacon_that_kept_time_episode.json")
    work_dir = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / "work/preview/.work_the_beacon_that_kept_time_draft").resolve()
    # node runs with cwd=universal_toolbook/, so every path handed to it must be absolute.

    retimed = (work_dir / "episode_retimed.json").resolve()
    manifest = json.loads((work_dir / "vo_manifest.json").read_text())
    segs = manifest["segments"]

    js = (
        "const fs=require('fs');"
        "const {compileEpisode}=require('./engine/episode');"
        "const spec=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));"
        "console.log(JSON.stringify(compileEpisode(spec,{width:1920,height:1080,subtitlesMode:'cinema'})));"
    )
    comp = json.loads(subprocess.check_output(["node", "-e", js, str(retimed)], cwd=str(STUDIO), text=True))

    from engine.audio_mixer import build_master_soundtrack, _read_mono_wav_float, SAMPLE_RATE

    out_dir = Path("/tmp/beacon_mix")
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- 1. voice + foley only (BGM disabled) -----------------------------------------------
    stats = build_master_soundtrack(comp, segs, out_dir / "vo_only.wav", bgm_override="none")
    with wave.open(str(out_dir / "vo_only.wav"), "rb") as w:
        sr = w.getframerate()
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
    mix = raw.reshape(-1, w.getnchannels()).astype(np.float64).mean(axis=1) / 32768.0

    # --- 2. voice alone (no foley) ---------------------------------------------------------
    total = int(comp["totalDuration"] * sr)
    vo = np.zeros(total, dtype=np.float64)
    speech_iv = []
    for s in segs:
        p = Path(s["wav"])
        if not p.exists():
            continue
        clip = _read_mono_wav_float(p)
        i0 = max(0, int(float(s.get("start_sec", 0.0)) * sr))
        i1 = min(total, i0 + clip.size)
        vo[i0:i1] += clip[: i1 - i0] * 0.95
        # absolute master-timeline seconds (see audio_mixer.build_master_soundtrack)
        for a, b in s.get("speech_intervals") or []:
            speech_iv.append((float(a), float(b)))
    # the mixer's own smoothing kernel for the duck / speech mask
    mask = np.zeros(total, dtype=np.float32)
    pad = int(0.22 * sr)
    for a, b in speech_iv:
        mask[max(0, int(a * sr) - pad) : min(total, int(b * sr) + pad)] = 1.0
    win = int(0.32 * sr)
    smooth = np.convolve(mask, np.ones(win, dtype=np.float32) / win, mode="same")

    def nb(x):  # per-block RMS in dBFS
        k = int(BLOCK_S * sr)
        x = x[: (len(x) // k) * k].reshape(-1, k)
        return db(np.sqrt((x**2).mean(axis=1)))

    m = np.zeros(len(nb(vo)), dtype=bool)
    for a, b in speech_iv:
        m[int(a / BLOCK_S) : int(b / BLOCK_S)] = True

    out = {
        "total_duration_sec": round(comp["totalDuration"], 2),
        "speech_sec": round(sum(b - a for a, b in speech_iv), 2),
        "speech_windows": len(speech_iv),
        "narration": {
            "median_rms_dbfs": round(float(np.median(nb(vo)[m])), 2),
            "p95_rms_dbfs": round(float(np.percentile(nb(vo)[m], 95)), 2),
            "peak_dbfs": round(float(db(np.abs(vo).max())), 2),
        },
        "mix_with_bgm": {
            "reported_peak_dbfs": stats.get("peak_dbfs"),
            "true_peak_dbfs": round(float(db(np.abs(mix).max())), 2),
            "program_rms_dbfs": round(float(db(math.sqrt(float((mix**2).mean())))), 2),
        },
    }

    # --- 3. the bed, ducked exactly like the mixer ducks it ---------------------------------
    from engine.bgm_library import render_bgm_bed

    bed, meta = render_bgm_bed(total, comp, bgm_choice="dynamic", base_gain=0.34)
    duck = 1.0 - 0.665 * np.clip(smooth, 0.0, 1.0)
    bed_mono = (bed.mean(axis=1) * duck).astype(np.float64)
    bd = nb(bed_mono)
    out["music_bed"] = {
        "tracks": [t["id"] for t in meta.get("tracks_used", [])],
        "median_rms_in_gaps_dbfs": round(float(np.median(bd[~m])), 2),
        "median_rms_under_speech_dbfs": round(float(np.median(bd[m])), 2),
        "peak_dbfs": round(float(db(np.abs(bed_mono).max())), 2),
    }
    out["separation"] = {
        "narration_over_bed_in_gaps_db": round(float(np.median(nb(vo)[m]) - np.median(bd[~m])), 2),
        "narration_over_bed_under_speech_db": round(float(np.median(nb(vo)[m]) - np.median(bd[m])), 2),
    }
    ok = (
        out["separation"]["narration_over_bed_under_speech_db"] >= 8.0
        and out["separation"]["narration_over_bed_in_gaps_db"] >= 4.0
        and out["mix_with_bgm"]["true_peak_dbfs"] <= -1.0
    )
    out["verdict"] = "PASS" if ok else "RECHECK"
    print(json.dumps(out, indent=2))
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
