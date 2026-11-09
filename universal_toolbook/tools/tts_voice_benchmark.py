#!/usr/bin/env python3
"""Voice benchmark harness for the TTS subsystem.

Runs a fixed set of voices over fixed scripts with the subsystem's standard
processing chain, and records objective measurements (generation time, RTF,
audio duration, words/minute pace, raw + processed peak/RMS) to a JSON
report. The benchmark is for LISTENING first and numbers second: every run
also writes processed WAV + MP3 files so a human can A/B the voices — the
final voice choice is always made by ear (see TTS_VOICE_COMPARISON.md).

Rules for valid numbers
-----------------------
* RUN STANDALONE — no other CPU work in the sandbox (RTF is otherwise
  meaningless; see TTS_BENCHMARK.md "contamination" note).
* Same scripts + same processing settings as the original 4-voice run so
  numbers are comparable across missions.

Usage
-----
    .venv/bin/python universal_toolbook/tools/tts_voice_benchmark.py
        [--voices am_michael af_bella ...]   # default: mission-2 shortlist
        [--include-piper]                    # add piper voices (pace check)
        [--out runtime/renders/tts/benchmark2]
        [--mp3-kbps 128]  [--no-mp3]  [--fast]

Output layout (git-ignored):
    <out>/scripts/*.txt            the exact benchmark texts
    <out>/raw/*.wav                raw engine output (24000 / 22050 Hz)
    <out>/proc/*.wav               processed 44100 Hz (the chain in use)
    <out>/mp3/*.mp3                128 kbps listening copies
    <out>/results.json             all measurements
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # universal_toolbook/ on the path

# --------------------------------------------------------------------------- scripts
# Reproduced verbatim from docs/production/TTS_BENCHMARK.md §4 so the
# numbers stay comparable with the original 4-voice benchmark.
SCRIPTS: dict[str, str] = {
    "conversational": (
        "Hey, so — quick question before we start. Have you ever watched a video and "
        "thought, \"Wait, who IS this person talking to me?\" That's the voice. And the "
        "voice matters more than people think. In episode twelve, we're talking about "
        "how narration changes everything. Not the script. Not the music. The voice. "
        "Think about it. Same words, same images, different voice, and suddenly the "
        "whole video feels like a different movie. So here's the thing. I asked my "
        "friend Maya in Biratnagar what she listens to. She said podcasts, always "
        "podcasts. \"The host's voice is the only reason I get through the commute,\" "
        "she told me. Forty-five minutes, every single morning. What if your video had "
        "that kind of pull? Not loud. Not fancy. Just a voice you trust."
    ),
    "energetic_youtube": (
        "STOP SCROLLING! What if I told you that you can render a full animated "
        "episode on a machine with TWO cores and 3.8 gigabytes of RAM?! Yes, you "
        "heard me right. No GPU. No cloud. No monthly bill! This is the most exciting "
        "thing in this entire channel, and I need you to understand why. Most "
        "animation studios spend 42,000 dollars on render farms! Us? We spent... "
        "nothing! Completely free tools, open-source everything! Here's the stack. "
        "FFmpeg for the video, ImageIO for the frames, and for the voice, we swapped "
        "Microsoft's cloud engine for something local, something private, something "
        "you can trust with your creative work. Kokoro. Say it with me: KO-KO-RO. 82 "
        "million parameters, whispering your narration into existence! And the best "
        "part? It runs in real time on a laptop! We are not joking. Watch. What. Just. "
        "Happened!"
    ),
    "educational": (
        "Text to speech systems have evolved dramatically. Modern TTS engines convert "
        "written language into natural speech using neural networks trained on "
        "thousands of hours of audio. The pipeline we're describing has three stages. "
        "First, a text normalization stage converts raw strings into a phonetic "
        "representation. Numbers like 42 become words. Abbreviations like API, GPU, "
        "and CI/CD are expanded or pronounced according to a dictionary. Second, an "
        "acoustic model predicts a sequence of mel spectrograms, at a rate of "
        "roughly 75 frames per second. Third, a neural vocoder, often called "
        "HiFi-GAN, turns those spectrograms into a 24 kilohertz waveform. Loudness "
        "matters. Broadcast standards target integrated loudness of negative 16 dBFS "
        "for podcast-style speech, with a true peak below negative 1 dBTP. On our "
        "hardware, the CPU is a single core with hyper-threading, so the whole "
        "inference runs at about one point one times real time. In 2026, the "
        "open-source community offers several fully local options: Kokoro, Piper, and "
        "a growing list of multilingual models. Each trade quality against speed in a "
        "different way."
    ),
    "dramatic": (
        "It was the last night before the festival. And Elias had made a choice. He "
        "stood at the window of the old studio, watching the rain stitch the city "
        "together, and remembered every hour he'd spent alone, frame by frame, drawing "
        "a staircase that never ended. \"You kept saying it was impossible,\" his mother "
        "had told him. \"And you kept saying that was exactly why it had to be made.\" "
        "Silence. Then, softly, as if from a great distance: \"It's finished.\" The city "
        "below was so quiet he could hear the machines still breathing. Somewhere, a "
        "train passed, and the lights trembled. And in that tremor, Elias finally "
        "understood that the story was never about the staircase at all. It was about "
        "climbing."
    ),
}

#: Mission-2 shortlist: references + v1.0 A/B + one candidate per requested
#: genre (deep documentary male, warm conversational male, young casual male,
#: steady explainer male, warm conversational female, energetic female, calm
#: soft female, professional neutral female, British female, British male).
DEFAULT_VOICES = [
    "am_michael",        # reference standard (primary default)
    "af_bella",          # reference standard (secondary)
    "am_michael_v1",     # v1.0 re-recording A/B
    "af_bella_v1",       # v1.0 re-recording A/B
    "am_onyx",           # deep / documentary male
    "am_liam",           # warm conversational male
    "am_fenrir",         # young casual male
    "am_eric",           # steady explainer male
    "af_heart",          # warm conversational female
    "af_jessica",        # energetic female
    "af_aoede",          # calm / soft female
    "af_kore",           # professional neutral female
    "bf_alice",          # British female
    "bm_daniel",         # British male
]
PIPER_VOICES = ["en_US-ryan-medium", "en_GB-alan-medium"]


def _words(text: str) -> int:
    return len(text.split())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voices", nargs="*", default=DEFAULT_VOICES,
                    help="kokoro voice ids to benchmark (default: mission-2 shortlist)")
    ap.add_argument("--include-piper", action="store_true",
                    help="also run piper voices (fallback pace assessment)")
    ap.add_argument("--out", default="runtime/renders/tts/benchmark2")
    ap.add_argument("--mp3-kbps", type=int, default=128)
    ap.add_argument("--no-mp3", action="store_true")
    ap.add_argument("--fast", action="store_true",
                    help="one short sentence per voice (style cards, no scripts)")
    ap.add_argument("--script", choices=sorted(SCRIPTS), default=None,
                    help="run only one script (default: all four)")
    args = ap.parse_args()

    import numpy as np
    from tts import audio as A
    from tts.config import load_config
    from tts.providers import get_engine

    out = Path(args.out)
    for sub in ("scripts", "raw", "proc", "mp3"):
        (out / sub).mkdir(parents=True, exist_ok=True)

    proc_cfg = load_config()["processing"]
    script_names = [args.script] if args.script else list(SCRIPTS)
    for name in script_names:
        (out / "scripts" / f"{name}.txt").write_text(SCRIPTS[name], encoding="utf-8")

    if args.fast:
        texts = {"style_card": (
            "This is how the voice sounds. Warm, even, and easy to follow. "
            "Numbers, dates, and questions all work here too."
        )}
    else:
        texts = {name: SCRIPTS[name] for name in script_names}

    jobs: list[tuple[str, str, str]] = []  # (engine, voice, script)
    for v in args.voices:
        for s in texts:
            jobs.append(("kokoro", v, s))
    if args.include_piper:
        for v in PIPER_VOICES:
            for s in texts:
                jobs.append(("piper", v, s))

    eng_kokoro = None
    eng_piper = None
    results: list[dict] = []
    t_start = time.time()
    for i, (engine, voice, script) in enumerate(jobs, 1):
        text = texts[script]
        tag = f"{engine}_{voice}__{script}"
        print(f"[{i}/{len(jobs)}] {engine} {voice} {script} ...", flush=True)
        try:
            if engine == "kokoro":
                if eng_kokoro is None:
                    eng_kokoro = get_engine("kokoro")
                    print(f"    voices loaded: {len(eng_kokoro.voices())}", flush=True)
                eng = eng_kokoro
            else:
                if eng_piper is None:
                    eng_piper = get_engine("piper")
                eng = eng_piper
            t0 = time.time()
            res = eng.synthesize(text, voice=voice, speed=1.0)
            gen_s = time.time() - t0

            raw_wav = out / "raw" / f"{tag}.wav"
            A.write_wav(raw_wav, res.audio, res.sample_rate)
            raw_an = A.analyze(raw_wav)
            proc_wav = out / "proc" / f"{tag}.wav"
            proc_an, steps = A.process_audio(
                raw_wav, proc_wav,
                resample_rate=proc_cfg["resample_rate"],
                normalize_peak_dbfs=proc_cfg["normalize_peak_dbfs"],
                normalize_rms_dbfs=proc_cfg["normalize_rms_dbfs"],
                limit_dbfs=proc_cfg["limit_dbfs"],
            )
            mp3 = None
            if not args.no_mp3:
                mp3 = out / "mp3" / f"{tag}.mp3"
                A.encode_mp3(proc_wav, mp3, args.mp3_kbps)

            n_words = _words(text)
            dur = raw_an.duration_s
            results.append({
                "engine": engine,
                "voice": res.voice,
                "voice_requested": voice,
                "script": script,
                "words": n_words,
                "words_per_min": round(n_words / (dur / 60.0), 1) if dur else None,
                "gen_seconds": round(gen_s, 2),
                "audio_seconds": round(dur, 2),
                "rtf": round(gen_s / dur, 3) if dur else None,
                "raw_peak": round(float(np.max(np.abs(res.audio))), 4) if len(res.audio) else None,
                "raw_rms": round(float(np.sqrt(np.mean(res.audio ** 2))), 4) if len(res.audio) else None,
                "raw_peak_dbfs": round(raw_an.peak_dbfs, 2),
                "raw_rms_dbfs": round(raw_an.rms_dbfs, 2),
                "proc_peak_dbfs": round(proc_an.peak_dbfs, 2),
                "proc_rms_dbfs": round(proc_an.rms_dbfs, 2),
                "limit_engaged": steps.get("limit_engaged", False),
                "files": {"raw": str(raw_wav), "proc": str(proc_wav), "mp3": str(mp3) if mp3 else None},
                "fallback": res.meta.get("voice_fallback", False),
            })
            r = results[-1]
            print(f"    ok: {r['audio_seconds']}s audio in {r['gen_seconds']}s "
                  f"(RTF {r['rtf']}, {r['words_per_min']} wpm, raw peak {r['raw_peak']})", flush=True)
        except Exception as e:
            print(f"    ERROR: {type(e).__name__}: {e}", flush=True)
            results.append({"engine": engine, "voice": voice, "script": script,
                            "error": f"{type(e).__name__}: {e}"})

    meta = {
        "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "total_seconds": round(time.time() - t_start, 1),
        "python": platform.python_version(),
        "kokoro_version": eng_kokoro.engine_version() if eng_kokoro else None,
        "piper_included": args.include_piper,
        "fast": args.fast,
        "scripts": script_names,
        "processing": proc_cfg,
        "standalone": "run with no other CPU load for valid RTF (see docstring)",
    }
    (out / "results.json").write_text(
        json.dumps({"meta": meta, "runs": results}, indent=1), encoding="utf-8")
    n_ok = sum(1 for r in results if "error" not in r)
    print(f"\n{len(jobs)} jobs: {n_ok} ok, {len(jobs)-n_ok} failed in {meta['total_seconds']}s")
    print(f"report: {out / 'results.json'}")
    print("listening: " + (str(out / "mp3" / "*.mp3") if not args.no_mp3 else str(out / "proc" / "*.wav")))


if __name__ == "__main__":
    main()
