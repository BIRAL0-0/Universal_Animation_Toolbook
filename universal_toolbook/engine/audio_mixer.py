#!/usr/bin/env python3
"""
Broadcast-clean Stereo Cinema Audio Mixer for Universal Animation Toolbook.
Combines:
  1. Script-matched or multi-act crossfaded Creative Commons / NCS-style BGM
  2. Subtle environmental atmosphere (gentle window/street rain, night air, warm room tone)
  3. Stereo-panned world-contact footsteps & story-matched foley cues
  4. Multi-speaker neural narration & dialogue with phrase-accurate auto-ducking (-9.5 dB)
"""

from __future__ import annotations

import math
import subprocess
import wave
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

from .bgm_library import render_bgm_bed
from .voice_engine import get_ffmpeg_exe

SAMPLE_RATE = 44100

MOOD_CHORDS = {
    "calm": [(130.81, 196.00, 246.94, 329.63), (110.00, 164.81, 220.00, 261.63)],
    "focus": [(146.83, 220.00, 261.63, 329.63), (130.81, 196.00, 261.63, 329.63)],
    "tension": [(110.00, 164.81, 220.00, 246.94), (130.81, 196.00, 233.08, 311.13)],
    "triumph": [(130.81, 196.00, 261.63, 392.00), (174.61, 261.63, 349.23, 523.25)],
}


def _read_mono_wav_float(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def _synth_procedural_bed(total_samples: int, scenes: List[Dict[str, Any]]) -> np.ndarray:
    stereo = np.zeros((total_samples, 2), dtype=np.float32)
    bar_len = int(4.0 * SAMPLE_RATE)
    num_bars = math.ceil(total_samples / bar_len)

    def mood_at(sec: float) -> str:
        for sc in scenes:
            if float(sc.get("startSec", 0.0)) <= sec <= float(sc.get("endSec", 0.0)):
                return str(sc.get("mood", "focus"))
        return "focus"

    for b in range(num_bars):
        i0 = b * bar_len
        i1 = min(total_samples, i0 + bar_len)
        n = i1 - i0
        if n <= 0:
            break
        t_local = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        mood = mood_at((i0 + n * 0.5) / SAMPLE_RATE)
        prog = MOOD_CHORDS.get(mood, MOOD_CHORDS["focus"])
        chord = prog[b % len(prog)]

        env = np.ones(n, dtype=np.float32)
        fade = min(int(0.45 * SAMPLE_RATE), n // 3)
        if fade > 0:
            env[:fade] = np.linspace(0.0, 1.0, fade, dtype=np.float32)
            env[-fade:] = np.linspace(1.0, 0.0, fade, dtype=np.float32)

        pad_l = np.zeros(n, dtype=np.float32)
        pad_r = np.zeros(n, dtype=np.float32)
        for idx, freq in enumerate(chord):
            s1 = np.sin(2.0 * np.pi * freq * t_local)
            pad_l += s1 * (0.14 if idx % 2 == 0 else 0.09)
            pad_r += s1 * (0.09 if idx % 2 == 0 else 0.14)
        stereo[i0:i1, 0] += pad_l * env * 0.22
        stereo[i0:i1, 1] += pad_r * env * 0.22
    return stereo


def _render_environmental_ambience(total_samples: int, scenes: List[Dict[str, Any]]) -> np.ndarray:
    """Render soft, non-intrusive stereo rain / night wind / room ambience matched to each scene."""
    amb = np.zeros((total_samples, 2), dtype=np.float32)
    rng = np.random.default_rng(202610)
    # Pre-build a 6s seamless gentle rain loop (moving-average filtered stereo noise)
    loop_n = SAMPLE_RATE * 6
    raw_l = rng.normal(0.0, 1.0, loop_n + 32).astype(np.float32)
    raw_r = rng.normal(0.0, 1.0, loop_n + 32).astype(np.float32)
    kern = np.array([0.08, 0.15, 0.27, 0.27, 0.15, 0.08], dtype=np.float32)
    rain_l = np.convolve(raw_l, kern, mode="valid")[:loop_n]
    rain_r = np.convolve(raw_r, kern, mode="valid")[:loop_n]
    # Subtract ultra-smooth trend so it sounds like soft rain patter on glass/asphalt, not rumble
    rain_loop = np.stack([rain_l, rain_r], axis=1) * 0.030

    for sc in scenes:
        setting = sc.get("setting") or {}
        env_name = str(sc.get("environment") or "")
        weather = str(setting.get("weather") or "")
        is_rain = weather == "rain" or bool(setting.get("rain")) or "rain" in env_name
        if not is_rain:
            continue

        s0 = max(0, int(float(sc.get("startSec", 0.0)) * SAMPLE_RATE))
        s1 = min(total_samples, int(float(sc.get("endSec", 0.0)) * SAMPLE_RATE))
        seg_n = s1 - s0
        if seg_n <= 0:
            continue
        tiled = np.resize(rain_loop, (seg_n, 2)).copy()
        fade = min(int(0.8 * SAMPLE_RATE), seg_n // 3)
        if fade > 0:
            tiled[:fade] *= np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
            tiled[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)[:, None]
        # Outdoor rain slightly brighter than indoor window rain, scaled by rain_intensity
        indoor = setting.get("backdrop") in ("windows", "shelves")
        rain_int = float(setting.get("rain_intensity", 1.0))
        amb[s0:s1] += tiled * (0.62 if indoor else 0.95) * np.clip(rain_int, 0.35, 1.65)
    return amb


def _make_sfx_clip(sfx_type: str) -> np.ndarray:
    rng = np.random.default_rng(abs(hash(sfx_type)) % (2**31))
    if sfx_type in ("step", "step_run", "wet_step"):
        dur = 0.075 if sfx_type == "step_run" else 0.095
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        f0 = 135.0 if sfx_type == "step_run" else 108.0
        thud = np.sin(2.0 * np.pi * (f0 * np.exp(-18.0 * t)) * t) * np.exp(-36.0 * t)
        splash_scale = 0.42 if sfx_type == "wet_step" else 0.20
        tap = rng.normal(0.0, splash_scale, n).astype(np.float32) * np.exp(-58.0 * t)
        gain = 0.15 if sfx_type == "step_run" else 0.125
        return (thud * 0.78 + tap * 0.36) * gain

    if sfx_type == "clock_tick":
        n = int(0.045 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        click = np.sin(2.0 * np.pi * 1650.0 * t) * np.exp(-120.0 * t)
        wood = np.sin(2.0 * np.pi * 420.0 * t) * np.exp(-75.0 * t)
        return ((click * 0.65 + wood * 0.35) * 0.09).astype(np.float32)

    if sfx_type == "phone_buzz":
        n = int(0.46 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        gate = ((t < 0.18) | ((t > 0.25) & (t < 0.43))).astype(np.float32)
        hum = (np.sin(2.0 * np.pi * 142.0 * t) + 0.4 * np.sin(2.0 * np.pi * 284.0 * t)) * gate
        return (hum * 0.075).astype(np.float32)

    if sfx_type == "door_bell":
        n = int(0.85 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        b1 = np.sin(2.0 * np.pi * 659.25 * t) * np.exp(-4.2 * t)
        b2 = np.sin(2.0 * np.pi * 523.25 * np.maximum(0.0, t - 0.16)) * (t >= 0.16) * np.exp(-3.8 * np.maximum(0.0, t - 0.16))
        return ((b1 * 0.55 + b2 * 0.55) * 0.11).astype(np.float32)

    if sfx_type == "cup_set":
        n = int(0.14 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        clink = np.sin(2.0 * np.pi * 1180.0 * t) * np.exp(-48.0 * t)
        thump = np.sin(2.0 * np.pi * 195.0 * t) * np.exp(-35.0 * t)
        return ((clink * 0.45 + thump * 0.55) * 0.10).astype(np.float32)

    if sfx_type in ("paper_slide", "page_turn", "paper_rustle"):
        n = int(0.26 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        rustle = rng.normal(0.0, 0.35, n).astype(np.float32) * np.sin(np.pi * t / 0.26)
        kern = np.ones(5, dtype=np.float32) / 5.0
        return (np.convolve(rustle, kern, mode="same") * 0.08).astype(np.float32)

    if sfx_type in ("umbrella_open", "umbrella_shake"):
        dur = 0.28 if sfx_type == "umbrella_open" else 0.42
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        thump = np.sin(2.0 * np.pi * (95.0 + 40.0 * np.exp(-22.0 * t)) * t) * np.exp(-20.0 * t)
        flap = rng.normal(0.0, 0.38, n).astype(np.float32) * np.sin(np.pi * t / dur)
        if sfx_type == "umbrella_shake":
            flap *= 0.55 + 0.45 * np.abs(np.sin(t * 26.0))
        kern = np.ones(6, dtype=np.float32) / 6.0
        return ((thump * 0.45 + np.convolve(flap, kern, mode="same") * 0.65) * 0.12).astype(np.float32)

    if sfx_type == "thunder_rumble":
        dur = 2.6
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        noise = rng.normal(0.0, 1.0, n).astype(np.float32)
        # Heavy low-pass filter for distant rolling thunder
        kern = np.hanning(180).astype(np.float32)
        kern /= np.sum(kern)
        low = np.convolve(noise, kern, mode="same")
        env = np.sin(np.pi * np.minimum(1.0, t / dur)) ** 0.8 * (0.65 + 0.35 * np.sin(t * 5.2))
        sub = np.sin(2.0 * np.pi * 46.0 * t) * np.exp(-1.1 * t) * 0.35
        return ((low * 1.8 + sub) * env * 0.14).astype(np.float32)

    if sfx_type == "bus_pass":
        dur = 2.4
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        env = np.sin(np.pi * t / dur) ** 1.4
        doppler = 78.0 - 16.0 * ((t / dur) - 0.5)
        engine = (np.sin(2.0 * np.pi * doppler * t) + 0.5 * np.sin(2.0 * np.pi * doppler * 2.0 * t)) * 0.32
        tire_spray = np.convolve(rng.normal(0.0, 0.32, n).astype(np.float32), np.ones(8, dtype=np.float32) / 8.0, mode="same")
        return ((engine + tire_spray) * env * 0.13).astype(np.float32)

    if sfx_type == "wind_gust":
        dur = 1.45
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        whoosh = np.convolve(rng.normal(0.0, 0.55, n).astype(np.float32), np.hanning(36).astype(np.float32) / 18.0, mode="same")
        env = np.sin(np.pi * t / dur) ** 1.2
        return (whoosh * env * 0.13).astype(np.float32)

    if sfx_type == "phone_buzz":
        dur = 0.34
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        # Soft modern smartphone two-note chime + subtle tactile buzz
        tone = (
            np.sin(2.0 * np.pi * 784.0 * t) * np.exp(-14.0 * t)
            + np.sin(2.0 * np.pi * 1046.5 * np.maximum(0.0, t - 0.11)) * np.exp(-13.0 * np.maximum(0.0, t - 0.11)) * (t >= 0.11)
        )
        return (tone * 0.085).astype(np.float32)

    if sfx_type == "phone_ring":
        dur = 1.15
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        pulse = ((np.sin(2.0 * np.pi * 4.5 * t) > -0.2).astype(np.float32)) * np.sin(np.pi * t / dur)
        ring = (np.sin(2.0 * np.pi * 659.25 * t) + 0.6 * np.sin(2.0 * np.pi * 880.0 * t)) * pulse
        return (ring * 0.065).astype(np.float32)

    if sfx_type == "alarm_chime":
        dur = 0.72
        n = int(dur * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        chime = (
            np.sin(2.0 * np.pi * 523.25 * t) * np.exp(-5.0 * t)
            + 0.7 * np.sin(2.0 * np.pi * 659.25 * np.maximum(0.0, t - 0.18)) * np.exp(-5.0 * np.maximum(0.0, t - 0.18)) * (t >= 0.18)
            + 0.6 * np.sin(2.0 * np.pi * 783.99 * np.maximum(0.0, t - 0.36)) * np.exp(-5.0 * np.maximum(0.0, t - 0.36)) * (t >= 0.36)
        )
        return (chime * 0.085).astype(np.float32)

    if sfx_type == "final_piano_note":
        n = int(3.8 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        # Warm C4 + G4 + E5 gentle felt-piano chord with natural harmonic decay
        freqs = [(261.63, 0.45), (392.00, 0.28), (659.25, 0.22), (523.25, 0.18)]
        note = np.zeros(n, dtype=np.float32)
        attack = np.minimum(1.0, t / 0.018)
        for f, amp in freqs:
            harm = np.sin(2.0 * np.pi * f * t) + 0.22 * np.sin(2.0 * np.pi * (f * 2.0) * t) * np.exp(-2.6 * t)
            note += harm * amp * np.exp(-1.05 * t)
        return (note * attack * 0.18).astype(np.float32)

    # --- "The Wall You Agreed With" foley -------------------------------------------------
    if sfx_type == "body_thud":
        # Flat impact: a 92 Hz body drop plus a short wooden knock. Reads as "wall, not door".
        n = int(0.42 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        body = np.sin(2.0 * np.pi * (92.0 - 34.0 * t) * t) * np.exp(-9.5 * t)
        knock = rng.normal(0.0, 1.0, n).astype(np.float32) * np.exp(-42.0 * t) * 0.30
        knock = np.convolve(knock, np.ones(6, dtype=np.float32) / 6.0, mode="same")
        return ((body * 0.62 + knock) * 0.42).astype(np.float32)

    if sfx_type == "trombone_sad":
        # Four descending muted-trombone notes ("wah wah wah waaah"). Harmonics + vibrato,
        # no sample, so it stays inside the synthesized-foley convention of this mixer.
        n = int(1.85 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        out = np.zeros(n, dtype=np.float32)
        notes = [(233.08, 0.00, 0.34), (220.00, 0.38, 0.34), (207.65, 0.76, 0.34), (174.61, 1.14, 0.70)]
        for f0, t0, dur in notes:
            i0 = int(t0 * SAMPLE_RATE)
            m = min(n - i0, int(dur * SAMPLE_RATE))
            if m <= 0:
                continue
            tt = np.arange(m, dtype=np.float32) / SAMPLE_RATE
            vib = np.sin(2.0 * np.pi * 5.4 * tt) * (0.9 + 2.4 * (tt / dur))
            glide = 1.0 - 0.06 * (tt / dur) ** 2
            ph = 2.0 * np.pi * f0 * glide * tt + vib
            tone = (
                np.sin(ph) * 0.52
                + np.sin(2.0 * ph) * 0.26
                + np.sin(3.0 * ph) * 0.13
                + np.sin(4.0 * ph) * 0.06
            )
            env = np.minimum(1.0, tt / 0.045) * np.exp(-2.1 * tt / dur)
            env[-int(0.06 * SAMPLE_RATE):] *= np.linspace(1.0, 0.0, min(m, int(0.06 * SAMPLE_RATE)))
            out[i0 : i0 + m] += (tone * env * 0.30).astype(np.float32)
        return (out * 0.55).astype(np.float32)

    if sfx_type == "record_scratch":
        # A hand dragging a needle backwards: band-limited noise chopped by a fast gate.
        n = int(0.46 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        noise = rng.normal(0.0, 1.0, n).astype(np.float32)
        noise = np.convolve(noise, np.ones(4, dtype=np.float32) / 4.0, mode="same")
        gate = 0.5 + 0.5 * np.sin(2.0 * np.pi * (34.0 + 90.0 * t) * t)
        env = np.minimum(1.0, t / 0.012) * np.exp(-5.2 * t)
        scratch = noise * (0.35 + 0.65 * gate) * env
        return (scratch * 0.60).astype(np.float32)

    if sfx_type == "beat_drop":
        # Kick + sub + a bright transient. Marks the cut into the montage.
        n = int(1.30 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        kick = np.sin(2.0 * np.pi * (150.0 * np.exp(-9.0 * t) + 42.0) * t) * np.exp(-5.0 * t)
        sub = np.sin(2.0 * np.pi * 41.2 * t) * np.exp(-2.4 * t) * 0.45
        click = rng.normal(0.0, 1.0, n).astype(np.float32) * np.exp(-95.0 * t) * 0.22
        return ((kick * 0.62 + sub + click) * 0.40).astype(np.float32)

    if sfx_type == "chapter_chime":
        n = int(0.90 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        c1 = np.sin(2.0 * np.pi * 523.25 * t) * np.exp(-3.8 * t)
        c2 = np.sin(2.0 * np.pi * 783.99 * t) * np.exp(-4.4 * t)
        return ((c1 * 0.6 + c2 * 0.4) * 0.09).astype(np.float32)

    if sfx_type == "board_pop":
        n = int(0.24 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        return (np.sin(2.0 * np.pi * (420.0 + 180.0 * (t / 0.24)) * t) * np.exp(-14.0 * t) * 0.08).astype(np.float32)

    if sfx_type == "room_shift":
        n = int(0.38 * SAMPLE_RATE)
        t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
        return (np.sin(2.0 * np.pi * (165.0 + 65.0 * np.sin(t * 6.5)) * t) * np.sin(np.pi * t / 0.38) * 0.05).astype(np.float32)

    n = int(0.30 * SAMPLE_RATE)
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    return (np.sin(2.0 * np.pi * 587.33 * t) * np.exp(-9.0 * t) * 0.09).astype(np.float32)


def build_master_soundtrack(
    compiled_episode: Dict[str, Any],
    voice_segments: List[Dict[str, Any]],
    out_wav: Path,
    bgm_override: str | None = None,
) -> Dict[str, Any]:
    """Mix Creative Commons / NCS BGM, environmental ambience, stereo foley, and voiceover with phrase-accurate auto-ducking."""
    total_dur = float(compiled_episode.get("totalDuration", 10.0))
    total_samples = max(SAMPLE_RATE, int(math.ceil(total_dur * SAMPLE_RATE)))

    bgm_choice = bgm_override or str(compiled_episode.get("bgm") or "auto")
    if bgm_choice == "none":
        music = np.zeros((total_samples, 2), dtype=np.float32)
        bgm_meta: Dict[str, Any] = {"mode": "none", "tracks_used": [], "credits_text": ""}
    elif bgm_choice == "procedural":
        music = _synth_procedural_bed(total_samples, compiled_episode.get("scenes", []))
        bgm_meta = {"mode": "procedural", "tracks_used": [], "credits_text": "Music: Procedural Synth Score"}
    else:
        music, bgm_meta = render_bgm_bed(total_samples, compiled_episode, bgm_choice=bgm_choice, base_gain=0.34)
        if not bgm_meta.get("tracks_used"):
            music = _synth_procedural_bed(total_samples, compiled_episode.get("scenes", []))
            bgm_meta = {"mode": "procedural_fallback", "tracks_used": [], "credits_text": ""}

    amb_bus = _render_environmental_ambience(total_samples, compiled_episode.get("scenes", []))
    sfx_bus = np.zeros((total_samples, 2), dtype=np.float32)
    vo_bus = np.zeros(total_samples, dtype=np.float32)
    speech_mask = np.zeros(total_samples, dtype=np.float32)

    voiced_scenes = 0
    for seg in voice_segments:
        wav_file = seg.get("wav")
        if not wav_file or not Path(wav_file).exists():
            continue
        clip = _read_mono_wav_float(Path(wav_file))
        if clip.size == 0:
            continue
        voiced_scenes += 1
        i0 = max(0, int(float(seg.get("start_sec", 0.0)) * SAMPLE_RATE))
        i1 = min(total_samples, i0 + clip.size)
        if i1 > i0:
            vo_bus[i0:i1] += clip[: i1 - i0] * 0.95
            intervals = seg.get("speech_intervals")
            pad = int(0.22 * SAMPLE_RATE)
            if isinstance(intervals, list) and len(intervals) > 0:
                for iv in intervals:
                    m0 = max(0, int(float(iv[0]) * SAMPLE_RATE) - pad)
                    m1 = min(total_samples, int(float(iv[1]) * SAMPLE_RATE) + pad)
                    speech_mask[m0:m1] = 1.0
            else:
                m0 = max(0, i0 - pad)
                m1 = min(total_samples, i1 + pad)
                speech_mask[m0:m1] = 1.0

    # Smooth phrase-accurate sidechain auto-ducking (-9.5 dB when speaking, gentle swells in pauses!)
    if voiced_scenes > 0:
        win = int(0.32 * SAMPLE_RATE)
        kernel = np.ones(win, dtype=np.float32) / float(win)
        smooth_mask = np.convolve(speech_mask, kernel, mode="same")
        duck_gain = 1.0 - 0.665 * np.clip(smooth_mask, 0.0, 1.0)
        music *= duck_gain[:, None]
        amb_bus *= (1.0 - 0.35 * np.clip(smooth_mask, 0.0, 1.0))[:, None]

    events = compiled_episode.get("soundEvents", [])
    clip_cache: Dict[str, np.ndarray] = {}
    for ev in events:
        etype = str(ev.get("type", "chime"))
        if etype not in clip_cache:
            clip_cache[etype] = _make_sfx_clip(etype)
        clip = clip_cache[etype]
        t_sec = float(ev.get("t", 0.0))
        pan = float(np.clip(ev.get("pan", 0.0), -0.9, 0.9))
        angle = (pan + 1.0) * (math.pi * 0.25)
        gl = math.cos(angle)
        gr = math.sin(angle)

        i0 = max(0, int(t_sec * SAMPLE_RATE))
        i1 = min(total_samples, i0 + clip.size)
        if i1 > i0:
            seg_c = clip[: i1 - i0]
            sfx_bus[i0:i1, 0] += seg_c * gl
            sfx_bus[i0:i1, 1] += seg_c * gr

    mix = music + amb_bus + sfx_bus
    mix[:, 0] += vo_bus
    mix[:, 1] += vo_bus

    # Transparent soft-knee ceiling limiter (-0.9 dBFS)
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.89:
        mix = np.tanh(mix / peak * 1.12) * 0.89

    # Loudness normalisation toward the documented healthy band (process/05_AUDIO.md: peak
    # -3..-1 dBFS, RMS -16..-19 dBFS). Measured on video-001 (KI-008): the mix sat at -24 dBFS RMS
    # with a 22 dB crest factor, because brief transients (pings, plosives) pinned the peak while
    # the narration body stayed ~20 dB lower. A peak ceiling alone cannot fix that, and an
    # RMS-envelope compressor cannot either (a 50 ms RMS envelope never sees a 3 ms transient).
    # So: (1) a fast-attack peak limiter tames the transients, then (2) make-up gain lifts the
    # body into band. Make-up is bounded by the RMS target, by the -1 dBFS peak ceiling and by a
    # hard +8 dB cap, so this stage can never clip and cannot rescue a broken silent mix.
    mono_peak = np.max(np.abs(mix), axis=1) if mix.ndim == 2 else np.abs(mix)
    rms_before = float(np.sqrt(np.mean(mix.astype(np.float64) ** 2))) if mix.size else 0.0
    rms_dbfs_before = 20.0 * math.log10(max(1e-6, rms_before))
    makeup_gain_db = 0.0
    if rms_before > 1e-5:
        hop = max(1, int(0.003 * SAMPLE_RATE))                     # 3 ms: fast enough to see transients
        n_hops = len(mono_peak) // hop + 1
        env = np.empty(n_hops, dtype=np.float64)
        prev = 0.0
        release = math.exp(-1.0 / (0.120 * SAMPLE_RATE / hop))    # 120 ms release
        for i in range(n_hops):
            blk = mono_peak[i * hop:(i + 1) * hop]
            pk = float(blk.max()) if blk.size else prev
            prev = max(pk, prev * release)
            env[i] = prev
        thr = 10.0 ** (-10.0 / 20.0)                              # -10 dBFS threshold
        ratio = 6.0
        with np.errstate(divide="ignore", invalid="ignore"):
            g = np.where(env > thr, thr * (env / thr) ** (1.0 / ratio) / env, 1.0)
        g = np.clip(np.nan_to_num(g, nan=1.0, posinf=1.0), 0.05, 1.0)
        g_full = np.repeat(g, hop)[: len(mono_peak)]
        mix = mix * (g_full[:, None] if mix.ndim == 2 else g_full)

        target_dbfs = -17.5                                       # midpoint of the -16..-19 band
        rms_now = float(np.sqrt(np.mean(mix.astype(np.float64) ** 2)))
        gain_for_rms = 10.0 ** ((target_dbfs - 20.0 * math.log10(max(1e-6, rms_now))) / 20.0)
        peak_now = float(np.max(np.abs(mix))) if mix.size else 0.0
        gain_for_peak = (0.89 / peak_now) if peak_now > 1e-6 else 1.0
        gain = max(1.0, min(gain_for_rms, gain_for_peak, 10.0 ** (8.0 / 20.0)))
        if gain > 1.0:
            mix = mix * gain
            makeup_gain_db = round(20.0 * math.log10(gain), 2)
    rms_after = float(np.sqrt(np.mean(mix.astype(np.float64) ** 2))) if mix.size else 0.0
    rms_dbfs_after = 20.0 * math.log10(max(1e-6, rms_after))

    fade_out_n = min(int(0.85 * SAMPLE_RATE), total_samples // 6)
    if fade_out_n > 0:
        f_curve = np.linspace(1.0, 0.0, fade_out_n, dtype=np.float32)
        mix[-fade_out_n:, 0] *= f_curve
        mix[-fade_out_n:, 1] *= f_curve

    pcm = np.clip(mix * 32767.0, -32768, 32767).astype(np.int16)
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())

    return {
        "wav_path": str(out_wav),
        "duration_sec": round(total_samples / SAMPLE_RATE, 2),
        "voiced_scenes": voiced_scenes,
        "sfx_events": len(events),
        "peak_dbfs": round(20.0 * math.log10(max(1e-5, float(np.max(np.abs(mix))))), 2),
        # KI-008: reports must carry RMS or the documented band cannot be gated on. Earlier
        # shipped films recorded peak only, which is how a -24 dBFS mix went unnoticed.
        "rms_dbfs": round(rms_dbfs_after, 2),
        "rms_dbfs_before_makeup": round(rms_dbfs_before, 2),
        "loudness_makeup_gain_db": makeup_gain_db,
        "bgm": bgm_meta,
    }


def mux_video_and_audio(silent_mp4: Path, master_wav: Path, final_mp4: Path) -> None:
    ffmpeg = get_ffmpeg_exe()
    final_mp4.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y",
        "-i", str(silent_mp4),
        "-i", str(master_wav),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        str(final_mp4),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
