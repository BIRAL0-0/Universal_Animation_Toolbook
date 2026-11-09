# TTS BENCHMARK — self-hosted English TTS for the animation pipeline

**Status: IMPLEMENTED + MEASURED.** Every number below came from real
generation on the actual target machine (not from papers or vendor claims).
All 24 generated WAVs remain in `output/tts/benchmark/` (git-ignored) and six
representative MP3s are committed in `outputs/tts_benchmark/` for human
listening.

Date: 2026-11-03 · Harness (now committed): `universal_toolbook/tools/tts_voice_benchmark.py`
· Original results: `output/tts/benchmark/results.json`

> **Mission 2 (2026-11-09) update:** the voice catalog expanded 11 → 44 and
> the default became `am_michael`. The 4 benchmark scripts below are
> unchanged and reused by the mission-2 run (16 voices × 4 scripts,
> standalone); see `TTS_VOICE_COMPARISON.md` for the new measurements,
> listening set, and the Piper ryan pace assessment. The mission-1 numbers
> remain the reference standard for those 4 voices.

## 1. Why this benchmark exists

The pipeline's default voiceover was Microsoft Edge TTS (cloud). Problems:

1. **Quality** was unsatisfactory for the channel's narration voice.
2. It is **not self-hosted** and not guaranteed free (proprietary endpoint,
   no contractual right to use output in monetized videos).
3. In this sandbox `speech.platform.bing.com` is **unreachable**, so Edge
   synthesis fails per line and the pipeline was already silently falling back
   to Piper.

Mission: a **completely free, local, on-demand** engine, benchmarked for real.

## 2. Candidates considered

| Candidate | Code | Weights | Verdict |
| --- | --- | --- | --- |
| **Kokoro-82M** (hexgrad, 82M params) | `kokoro-onnx` (MIT, ONNX Runtime) | **CC-BY-4.0** (commercial OK with attribution) | **Benchmarked — WINNER.** int8 ONNX runs on 2 vCPU / 3.8 GB RAM, no GPU, no PyTorch. Weights reachable here via a pinned GitHub git-blob (Hugging Face and GitHub release-asset CDN are both blocked in this sandbox — see `ENVIRONMENT_REPORT.md`). |
| **Piper** (piper1-gpl, ~20M params) | `piper-tts` (Apache-2.0) | Apache-2.0 voices | **Benchmarked — fallback.** Much faster (RTF ~0.06) but clearly lower prosody quality; 2 voices available in the reachable mirror. Kept as fast/last-resort engine. |
| **Edge/Azure neural** | `edge-tts` (MIT wrapper) | proprietary cloud | **Not benchmarked** — endpoint unreachable in this sandbox and fails the mission's self-hosted/free criteria. Retained as a provider for machines that can reach it. |
| **Chatterbox** (resemble-ai) | MIT code | HF-only, weight license requires verification (possible non-commercial terms) | **Excluded without benchmarking:** weights are Hugging Face–only (unreachable here) and the weight license was not verified to permit commercial use. The mission rejects noncommercial-only weights; do not adopt without checking. |
| **Tortoise / VITS-XTTS / Coqui** | various | various (HF-only) | **Excluded:** no reachable weight source in this sandbox, and/or slower/larger than Kokoro for the same class of quality. |
| **espeak-ng** | system | — | Robotic; kept only as the existing `--voice offline` last resort. |

## 3. Hardware & software (measured — `ENVIRONMENT_REPORT.md`)

* Debian 12, Intel Xeon @ 2.60 GHz, **1 core / 2 threads (2 vCPU)**, **3.8 GB
  RAM, no GPU, ~20 GB free disk**, Python 3.11.2.
* Kokoro: `kokoro-onnx 0.6.1` + ONNX Runtime 1.31.1 (CPU), **Kokoro-82M
  v0.19 int8 ONNX** (`kokoro.onnx`, 92.4 MB) + `voices.npz` (5.8 MB, 11
  voices), 24 kHz output.
* Piper: `piper-tts` (piper1-gpl) + `onnx` (alignment extra), **medium**
  voices (22 kHz), from the `007-Akira/Project-Rocky` GitHub mirror.
* Edge: `edge-tts 7.x` (install OK; synthesis **fails** — network blocked).

## 4. Benchmark scripts (4 genres)

Each script mixes short + long sentences, questions, exclamations, numbers,
abbreviations, proper nouns, and calm + energetic delivery. Full text is
embedded in `output/tts/benchmark/scripts/*.txt` (git-ignored) and reproduced
below.

**conversational** (podcast-host style):

> Hey, so — quick question before we start. Have you ever watched a video and
> thought, "Wait, who IS this person talking to me?" That's the voice. And the
> voice matters more than people think. In episode twelve, we're talking about
> how narration changes everything. Not the script. Not the music. The voice.
> Think about it. Same words, same images, different voice, and suddenly the
> whole video feels like a different movie. So here's the thing. I asked my
> friend Maya in Biratnagar what she listens to. She said podcasts, always
> podcasts. "The host's voice is the only reason I get through the commute,"
> she told me. Forty-five minutes, every single morning. What if your video had
> that kind of pull? Not loud. Not fancy. Just a voice you trust.

**energetic_youtube** (hype, numbers, exclamations):

> STOP SCROLLING! What if I told you that you can render a full animated
> episode on a machine with TWO cores and 3.8 gigabytes of RAM?! Yes, you
> heard me right. No GPU. No cloud. No monthly bill! This is the most exciting
> thing in this entire channel, and I need you to understand why. Most
> animation studios spend 42,000 dollars on render farms! Us? We spent...
> nothing! Completely free tools, open-source everything! Here's the stack.
> FFmpeg for the video, ImageIO for the frames, and for the voice, we swapped
> Microsoft's cloud engine for something local, something private, something
> you can trust with your creative work. Kokoro. Say it with me: KO-KO-RO. 82
> million parameters, whispering your narration into existence! And the best
> part? It runs in real time on a laptop! We are not joking. Watch. What. Just.
> Happened!

**educational** (technical terms, abbreviations, units):

> Text to speech systems have evolved dramatically. Modern TTS engines convert
> written language into natural speech using neural networks trained on
> thousands of hours of audio. The pipeline we're describing has three stages.
> First, a text normalization stage converts raw strings into a phonetic
> representation. Numbers like 42 become words. Abbreviations like API, GPU,
> and CI/CD are expanded or pronounced according to a dictionary. Second, an
> acoustic model predicts a sequence of mel spectrograms, at a rate of
> roughly 75 frames per second. Third, a neural vocoder, often called
> HiFi-GAN, turns those spectrograms into a 24 kilohertz waveform. Loudness
> matters. Broadcast standards target integrated loudness of negative 16 dBFS
> for podcast-style speech, with a true peak below negative 1 dBTP. On our
> hardware, the CPU is a single core with hyper-threading, so the whole
> inference runs at about one point one times real time. In 2026, the
> open-source community offers several fully local options: Kokoro, Piper, and
> a growing list of multilingual models. Each trade quality against speed in a
> different way.

**dramatic** (short lines, ellipses, emotional):

> It was the last night before the festival. And Elias had made a choice. He
> stood at the window of the old studio, watching the rain stitch the city
> together, and remembered every hour he'd spent alone, frame by frame, drawing
> a staircase that never ended. "You kept saying it was impossible," his mother
> had told him. "And you kept saying that was exactly why it had to be made."
> Silence. Then, softly, as if from a great distance: "It's finished." The city
> below was so quiet he could hear the machines still breathing. Somewhere, a
> train passed, and the lights trembled. And in that tremor, Elias finally
> understood that the story was never about the staircase at all. It was about
> climbing.

## 5. Results (real, clean run — no other CPU load)

`gen` = wall-clock generation seconds; `dur` = audio duration; `RTF` =
gen/dur (< 1.0 = faster than realtime). 24 runs, all succeeded.

| engine | voice | script | gen (s) | dur (s) | RTF | peak | rms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| kokoro | af_bella | conversational | 26.8 | 44.47 | 0.60 | 0.739 | 0.093 |
| kokoro | af_bella | dramatic | 24.1 | 41.12 | 0.59 | 0.638 | 0.091 |
| kokoro | af_bella | educational | 47.7 | 79.83 | 0.60 | 0.802 | 0.090 |
| kokoro | af_bella | energetic_youtube | 33.6 | 53.88 | 0.62 | 0.725 | 0.091 |
| kokoro | af_sky | conversational | 26.4 | 42.92 | 0.61 | 0.484 | 0.060 |
| kokoro | af_sky | dramatic | 23.9 | 39.74 | 0.60 | 0.429 | 0.059 |
| kokoro | af_sky | educational | 46.6 | 78.25 | 0.60 | 0.561 | 0.059 |
| kokoro | af_sky | energetic_youtube | 30.9 | 51.15 | 0.60 | 0.541 | 0.059 |
| kokoro | am_michael | conversational | 28.9 | 48.83 | 0.59 | 0.685 | 0.061 |
| kokoro | am_michael | dramatic | 27.5 | 45.37 | 0.61 | 0.787 | 0.060 |
| kokoro | am_michael | educational | 51.8 | 88.32 | 0.59 | **1.018** | 0.060 |
| kokoro | am_michael | energetic_youtube | 37.1 | 60.56 | 0.61 | 0.980 | 0.060 |
| kokoro | am_adam | conversational | 24.8 | 41.47 | 0.60 | 0.907 | 0.116 |
| kokoro | am_adam | dramatic | 24.1 | 38.54 | 0.63 | 0.884 | 0.113 |
| kokoro | am_adam | educational | 44.3 | 75.29 | 0.59 | 0.984 | 0.115 |
| kokoro | am_adam | energetic_youtube | 29.9 | 50.94 | 0.59 | 0.900 | 0.115 |
| piper | en_US-ryan-medium | conversational | 2.4 | 37.62 | 0.07 | 1.000 | 0.178 |
| piper | en_US-ryan-medium | dramatic | 2.3 | 33.74 | 0.07 | 1.000 | 0.167 |
| piper | en_US-ryan-medium | educational | 4.2 | 67.55 | 0.06 | 1.000 | 0.170 |
| piper | en_US-ryan-medium | energetic_youtube | 2.9 | 44.92 | 0.06 | 1.000 | 0.191 |
| piper | en_GB-alan-medium | conversational | 2.9 | 48.65 | 0.06 | 1.000 | 0.166 |
| piper | en_GB-alan-medium | dramatic | 2.8 | 43.69 | 0.06 | 1.000 | 0.148 |
| piper | en_GB-alan-medium | educational | 5.2 | 82.78 | 0.06 | 1.000 | 0.146 |
| piper | en_GB-alan-medium | energetic_youtube | 3.8 | 60.49 | 0.06 | 1.000 | 0.159 |

**Per-engine totals (4 scripts each):**

| engine | voice | gen (s) | audio (s) | avg RTF |
| --- | --- | ---: | ---: | ---: |
| kokoro | af_bella | 132.3 | 219.3 | 0.603 |
| kokoro | af_sky | 127.9 | 212.1 | 0.603 |
| kokoro | am_michael | 145.3 | 243.1 | 0.598 |
| kokoro | am_adam | 123.1 | 206.2 | 0.597 |
| piper | en_US-ryan-medium | 11.8 | 183.8 | 0.064 |
| piper | en_GB-alan-medium | 14.7 | 235.6 | 0.062 |

A full episode's narration (~3 min) ≈ **2 min of Kokoro generation** on this
box when idle.

## 6. Observations (measured)

**Speed.** Kokoro int8 on 2 vCPU is ~0.6 RTF when the machine is idle —
faster than realtime, but a previous pass measured ~1.1 RTF while other CPU
work ran concurrently. Expect 0.6–1.1 RTF in practice; budget generation time
accordingly. Piper is 10× faster (0.06 RTF) — it is the engine to reach for in
tight timeboxes.

**Raw output levels differ a lot between voices** (this is real, measured):
Kokoro raw peaks range from 0.43 (`af_sky`) to **1.018 (`am_michael` on the
educational script — the raw float output exceeds full scale)**. Piper always
outputs full-scale-normalized (peak 1.000). **Consequence: the processing
chain (RMS −16 dBFS + soft limit at −0.5 dBFS) is mandatory, not optional —
without it, some voices clip and others are inaudibly quiet.** The pipeline
applies it by default.

**Pace differs between voices on identical text** (e.g. educational:
`am_michael` 88.3 s vs `am_adam` 75.3 s — a 17 % difference). Scene retiming
absorbs this (measured speech wins), but voice choice changes total film
length; re-verify duration gates after switching voices.

**Word timings.** This Kokoro int8 export has **no native word-boundary
output** (measured: the ONNX session exposes no duration tensor). The
subsystem therefore derives word timings with the syllable-proportional +
energy-refined fallback (same method the pipeline already used for Piper).
Piper **does** report per-phoneme alignments (with `piper-tts[alignment]`) and
the provider converts them to word timings. This is an honest limitation of
the chosen export, documented rather than faked; lip-sync/subtitle timing
remains speech-locked as before.

**Audio integrity.** All 24 files validated clean (readable, non-silent, no
corruption) by `validate_audio.py`. No file failed.

**Quality (subjective — human listening required).** This report deliberately
makes **no** "Kokoro sounds better than X" claim. The committed samples in
`outputs/tts_benchmark/` are for a human to actually listen and decide which
voice to keep per character. What *can* be said, from measurement: Kokoro
produces natural-sounding prosody (longer, more varied phrase timing than
Piper on identical text — e.g. 44.5 s vs 37.6 s on the conversational script),
which is the classic signature of a stronger prosody model, but the aesthetic
judgment is yours to make from the samples.

## 7. Licensing (verified at runtime)

| Component | License | Commercial use (monetized YouTube) |
| --- | --- | --- |
| Kokoro-82M **weights** | **CC-BY-4.0** | **Allowed, with attribution** (see `outputs/tts_benchmark/README.md` for the exact line) |
| `kokoro-onnx` (code) | MIT | Allowed |
| `onnxruntime`, `espeakng-loader`, `phonemizer` | MIT/Apache-2.0 | Allowed |
| Piper code (`piper-tts`) | Apache-2.0 | Allowed |
| Piper voices (medium) | Apache-2.0 / MIT (per-voice, per the mirror) | Allowed |
| `edge-tts` | MIT wrapper around a **proprietary** service | **Not recommended** — no contractual right to use output; not self-hosted |

**Attribution obligation:** published videos using Kokoro must credit the
model (CC-BY-4.0). The description-credit line is in
`outputs/tts_benchmark/README.md`.

## 8. Final recommendation

**Default engine: Kokoro-82M int8 ONNX (via `kokoro-onnx`), CPU.**
Reasons, in order:

1. **Free + self-hosted + local** — meets every hard constraint (no API, no
   subscription, no server, no GPU); CC-BY-4.0 permits monetized use with
   attribution.
2. **Verified to run here** — 2 vCPU / 3.8 GB / no GPU, ~0.6 RTF idle, ~0.7 GB
   RAM. 11 voices including the podcast-host tones the channel uses.
3. **Weights are reachable in this sandbox** (pinned GitHub git-blob) — the
   only high-quality candidate with a working download path here.
4. **Integrated + tested** — pluggable provider, resumable jobs, pipeline
   integration with the existing fallback chain, full test suite green.

**Fallback: Piper** (faster, smaller, 2 voices) for time-critical or
last-resort generation; **Edge** retained only for machines that can reach
the endpoint. **Not recommended for this sandbox:** Chatterbox and other
HF-only models (unreachable + unverified weight license).

**Known limitations (carry into production):** no native word timings (energy
fallback); raw per-voice level variance (mitigated by mandatory processing);
CPU-only speed ceiling; weights must be re-fetched after a session reset
(`setup_tts.py`).
