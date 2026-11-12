#!/usr/bin/env python3
"""
Creative Commons & NCS-Style BGM Selector & Seamless Loop Renderer.

Automatically matches background music to the script's vocabulary, genre, and
emotional arc using the bundled Creative Commons (`CC0` / `CC BY`) library in
`assets/bgm/`, or loads any user-supplied NCS / Creative Commons audio file.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

from .voice_engine import get_ffmpeg_exe

SAMPLE_RATE = 44100
BGM_DIR = Path(__file__).resolve().parent.parent / "assets" / "bgm"
CATALOG_PATH = BGM_DIR / "BGM_CATALOG.json"

MOOD_TO_TRACK = {
    "focus": "electronic_drive",
    "calm": "chill_focus",
    "tension": "suspense_tension",
    "triumph": "triumph_horizon",
    "energetic": "upbeat_ncs_synth",
    "reflective": "reflective_piano",
    "modern": "retro_pulse",
}


def load_bgm_catalog() -> List[Dict[str, Any]]:
    if not CATALOG_PATH.exists():
        return []
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return list(data.get("tracks", []))


def score_script_for_bgm(text: str, scenes: List[Dict[str, Any]], catalog: List[Dict[str, Any]]) -> Dict[str, Any]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    token_counts: Dict[str, int] = {}
    for tok in tokens:
        token_counts[tok] = token_counts.get(tok, 0) + 1

    scene_moods: Dict[str, int] = {}
    for sc in scenes:
        m = str(sc.get("mood", "focus")).lower()
        scene_moods[m] = scene_moods.get(m, 0) + 1

    best_track = catalog[0]
    best_score = -1.0
    for tr in catalog:
        score = 0.0
        for kw in tr.get("keywords", []):
            # Prefix/stem friendly match
            for tok, cnt in token_counts.items():
                if tok == kw or (len(kw) >= 4 and tok.startswith(kw)):
                    score += cnt * 2.5
        for md in tr.get("moods", []):
            score += scene_moods.get(md, 0) * 3.0
        if score > best_score:
            best_score = score
            best_track = tr

    return best_track


def _decode_audio_to_stereo_float(audio_path: Path) -> np.ndarray:
    ffmpeg = get_ffmpeg_exe()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
        cmd = [
            ffmpeg,
            "-y",
            "-i", str(audio_path),
            "-ac", "2",
            "-ar", str(SAMPLE_RATE),
            "-sample_fmt", "s16",
            tmp.name,
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        with wave.open(tmp.name, "rb") as wf:
            raw = wf.readframes(wf.getnframes())
    pcm = np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768.0
    return pcm


def loop_track_seamless(clip: np.ndarray, target_samples: int, crossfade_sec: float = 3.0) -> np.ndarray:
    """Loop a stereo float32 track to `target_samples` with equal-power overlap crossfades."""
    if clip.shape[0] == 0:
        return np.zeros((target_samples, 2), dtype=np.float32)
    if clip.shape[0] >= target_samples:
        out = clip[:target_samples].copy()
    else:
        xf = min(int(crossfade_sec * SAMPLE_RATE), clip.shape[0] // 4)
        step = clip.shape[0] - xf
        reps = math.ceil(target_samples / max(1, step)) + 1
        total_buf = xf + reps * step
        buf = np.zeros((total_buf, 2), dtype=np.float32)

        fade_in = np.sin(np.linspace(0.0, math.pi * 0.5, xf, dtype=np.float32))[:, None]
        fade_out = np.cos(np.linspace(0.0, math.pi * 0.5, xf, dtype=np.float32))[:, None]

        pos = 0
        for i in range(reps):
            seg = clip.copy()
            if i > 0 and xf > 0:
                buf[pos : pos + xf] = buf[pos : pos + xf] * fade_out + seg[:xf] * fade_in
                end_p = pos + seg.shape[0]
                buf[pos + xf : end_p] = seg[xf:]
            else:
                buf[pos : pos + seg.shape[0]] = seg
            pos += step
            if pos >= target_samples:
                break
        out = buf[:target_samples].copy()

    # Master smooth fade-in (1.2s) and fade-out (2.5s)
    fi = min(int(1.2 * SAMPLE_RATE), target_samples // 4)
    fo = min(int(2.5 * SAMPLE_RATE), target_samples // 4)
    if fi > 0:
        out[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)[:, None]
    if fo > 0:
        out[-fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)[:, None]
    return out


def render_bgm_bed(
    total_samples: int,
    compiled_episode: Dict[str, Any],
    bgm_choice: str = "auto",
    base_gain: float = 0.28,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Build the stereo BGM bed for `compiled_episode`.
    Supports:
      - `"auto"`: automatically selects best-matching bundled CC/NCS-style track from script & moods
      - `"dynamic"`: shifts & crossfades bundled CC tracks across scene/act mood changes
      - `<track_id>`: specific catalog ID (`electronic_drive`, `upbeat_ncs_synth`, `chill_focus`, etc.)
      - `<filepath>`: any custom `.mp3`/`.wav`/`.ogg`/`.opus` NCS or Creative Commons file
    """
    catalog = load_bgm_catalog()
    by_id = {t["id"]: t for t in catalog}

    # Check if custom file path supplied
    cand_path = Path(bgm_choice)
    if bgm_choice not in ("auto", "dynamic", "procedural", "none") and cand_path.exists():
        clip = _decode_audio_to_stereo_float(cand_path)
        rms = float(np.sqrt(np.mean(clip * clip))) if clip.size else 0.0
        if rms > 1e-5:
            clip *= (0.12 / rms)
        bed = loop_track_seamless(clip, total_samples) * base_gain
        return bed, {
            "mode": "custom_file",
            "tracks_used": [{"id": cand_path.stem, "title": cand_path.name, "license": "User-supplied BGM"}],
            "credits_text": f"Music: {cand_path.name} (User-supplied track)",
        }

    if not catalog:
        return np.zeros((total_samples, 2), dtype=np.float32), {
            "mode": "empty",
            "tracks_used": [],
            "credits_text": "",
        }

    scenes = compiled_episode.get("scenes", [])
    script_corpus = " ".join(
        [str(compiled_episode.get("title", "")), str(compiled_episode.get("thesis", ""))]
        + [str(s.get("narration", "")) for s in scenes]
    )

    if bgm_choice == "dynamic" and len(scenes) >= 2:
        # Group consecutive scenes into mood/track spans & crossfade smoothly
        bed = np.zeros((total_samples, 2), dtype=np.float32)
        spans: List[Dict[str, Any]] = []
        for sc in scenes:
            tid = sc.get("bgmTrack") or MOOD_TO_TRACK.get(str(sc.get("mood", "focus")), "electronic_drive")
            if tid == "none":
                continue
            if tid not in by_id:
                tid = "reflective_piano" if " reflective_piano" in by_id else "electronic_drive"
            s0 = max(0, int(float(sc.get("startSec", 0.0)) * SAMPLE_RATE))
            s1 = min(total_samples, int(float(sc.get("endSec", 0.0)) * SAMPLE_RATE))
            gain = float(sc.get("bgmGain", 1.0))
            offset_sec = float(sc.get("bgmOffset", 0.0))
            fade_out = bool(sc.get("bgmFadeOut", False))
            if spans and spans[-1]["tid"] == tid and not spans[-1]["fade_out"] and not fade_out:
                spans[-1]["s1"] = s1
            else:
                spans.append({"s0": s0, "s1": s1, "tid": tid, "gain": gain, "offset": offset_sec, "fade_out": fade_out})
        if spans and not spans[-1]["fade_out"]:
            spans[-1]["s1"] = total_samples

        decoded_cache: Dict[str, np.ndarray] = {}
        used_ids: List[str] = []
        xf = int(2.6 * SAMPLE_RATE)

        for idx, sp in enumerate(spans):
            tid = sp["tid"]
            s0, s1 = sp["s0"], sp["s1"]
            if tid not in decoded_cache:
                decoded_cache[tid] = _decode_audio_to_stereo_float(BGM_DIR / by_id[tid]["file"])
            if tid not in used_ids:
                used_ids.append(tid)
            a0 = max(0, s0 - (xf // 2 if idx > 0 else 0))
            a1 = min(total_samples, s1 + (xf // 2 if (idx < len(spans) - 1 and not sp["fade_out"]) else 0))
            seg_len = a1 - a0
            if seg_len <= 0:
                continue
            src_clip = decoded_cache[tid]
            off_samp = int(sp["offset"] * SAMPLE_RATE) % max(1, src_clip.shape[0])
            shifted_clip = np.roll(src_clip, -off_samp, axis=0) if off_samp > 0 else src_clip
            seg = loop_track_seamless(shifted_clip, seg_len)
            env = np.ones(seg_len, dtype=np.float32) * float(sp["gain"])
            if idx > 0 and xf > 0 and seg_len > xf:
                env[:xf] *= np.sin(np.linspace(0.0, math.pi * 0.5, xf, dtype=np.float32))
            if sp["fade_out"]:
                fade_len = min(seg_len, max(xf, int(seg_len * 0.55)))
                env[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=np.float32) ** 1.6
            elif idx < len(spans) - 1 and xf > 0 and seg_len > xf:
                env[-xf:] *= np.cos(np.linspace(0.0, math.pi * 0.5, xf, dtype=np.float32))
            bed[a0:a1] += seg * env[:, None] * base_gain

        used_meta = [by_id[i] for i in used_ids]
        credits = "\n".join(
            f"Music: \"{m['title']}\" by {m['artist']} ({m['license']}) — {m['source_url']}"
            for m in used_meta
        )
        return bed, {"mode": "dynamic_cc", "tracks_used": used_meta, "credits_text": credits}

    # Single cohesive track mode (`bgm_choice == "auto"` or explicit catalog ID)
    chosen = by_id.get(bgm_choice) or score_script_for_bgm(script_corpus, scenes, catalog)
    clip = _decode_audio_to_stereo_float(BGM_DIR / chosen["file"])
    bed = loop_track_seamless(clip, total_samples) * base_gain
    credit_line = (
        f"Music: \"{chosen['title']}\" by {chosen['artist']} ({chosen['license']}) — {chosen['source_url']}"
    )
    return bed, {
        "mode": "catalog_cc",
        "selected_id": chosen["id"],
        "tracks_used": [chosen],
        "credits_text": credit_line,
    }
