# TTS ARCHITECTURE

How the self-hosted text-to-speech subsystem is built, how it plugs into the
animation pipeline, and why each piece is shaped the way it is.

> Honest scope note: this subsystem is a **working, tested, modular** TTS
> layer. It is integrated with the pipeline's voiceover stage
> (`universal_toolbook/engine/voice_engine.py`) via a pluggable provider, and it is the default
> offline engine. It is **not** a replacement for the voiceover script-polish
> step — the original → polish-prompt → approved-script → TTS order is
> preserved exactly (see `docs/production-workflow/VOICE_GENERATION.md`).

## 1. Layer map

```
            ┌────────────────────────────────────────────────────────┐
            │  Animation pipeline (engine/voice_engine.py)           │
            │  prepare_episode_voiceover(mode="auto"|"kokoro"|...)   │
            │      tries backends in order: Kokoro → Edge → Piper    │
            └───────────────┬────────────────────────────────────────┘
                            │ calls TTSProvider.synthesize()
   ┌────────────────────────▼───────────────────────────────────────┐
   │  universal_toolbook/tts/            (the subsystem)            │
   │                                                                  │
   │   providers/              base.py           config.py           │
   │   ├── kokoro_provider     TTSProvider       voices.json         │
   │   ├── piper_provider      (abstract)        (engine settings,   │
   │   ├── edge_provider       AudioResult       aliases, pauses)    │
   │   └── __init__ (registry) EngineUnavailable pronunciation_dictionary.json │
   │                                                                  │
   │   audio.py  segment.py  manifest.py                            │
   │   (process/  (split +     (job ids, per-segment                │
   │    analyze)   dict)        status, resumable)                  │
   └───────────────┬──────────────────────────────────────────────────┘
                   │
        ┌──────────┼───────────────────────────────┐
        ▼          ▼                                ▼
  kokoro-onnx   piper-tts                      edge-tts
  (ONNX, CPU)   (ONNX, CPU)                    (cloud, fallback)
        │          │                                │
   cache/tts/  ~/.cache/piper_voices         speech.platform.bing.com
   (weights)   (voices)                       (NOT reachable in sandbox)
```

## 2. The provider interface (`universal_toolbook/tts/base.py`)

Every engine implements `TTSProvider`:

| member | purpose |
| --- | --- |
| `synthesize(text, voice, speed, language) -> AudioResult` | produce float32 mono audio (+ optional word timings) |
| `load()` / `is_available()` | lazy model load; cheap readiness check |
| `voices()` / `resolve_voice(name)` | list native voices; map a pipeline name (Edge alias) to a native id |
| `engine_version()` | string recorded into manifests and the benchmark |

`AudioResult` carries `audio`, `sample_rate`, `timings` (or `None`),
`engine`, `voice`, and a `meta` dict. **`timings is None` is a first-class,
honest state** — Kokoro's int8 export has no duration output, so it returns
`None` and the caller applies the syllable-proportional + energy-refined word
timings (the same path Piper already used). We do **not** fake Kokoro word
timings.

Design rules enforced by the package:
* **Lazy imports.** Importing `tts` never pulls in `kokoro_onnx`, `piper`, or
  `edge_tts`. Each provider imports its heavy dependency only inside
  `load()`. This keeps the import light and the fallback chain robust.
* **Stateful after load, cached per process.** `providers.get_engine(name)`
  returns one memoized instance per engine, so a batch reuses a single loaded
  model instead of re-loading per line.

## 3. The three engines

### Kokoro (`kokoro_provider.py`) — default
* Model: **Kokoro-82M v0.19, int8 ONNX** (`cache/tts/kokoro.onnx`, 92.4 MB).
  Runs on CPU via the `kokoro-onnx` (ONNX Runtime) package — no PyTorch, no
  GPU needed.
* **Two voice sets, 44 selectable voices** (merged by the provider at load):
  * `voices.npz` — 11-voice v0.19 set (5.8 MB), loaded first under plain
    names (`am_michael`, `af_bella`, ...).
  * `voices-v1.0-en.npz` — 33-voice English v1.0 set (17.2 MB), downloaded as
    pinned `.pt` tensor files and converted torch-free by
    `tools/convert_kokoro_v1_voices.py`. The 23 v1.0-only voices load under
    their plain names (`af_heart`, `am_onyx`, `bf_alice`, ...); the 10
    v1.0 re-recordings whose names collide with v0.19 voices load with a
    `_v1` suffix (`am_michael_v1`, `af_bella_v1`, ...) so the plain names
    always keep pointing at the v0.19 recordings the pipeline was
    benchmarked on.
  * All 44 are style vectors for the same 82M model
    (`(510, 1, 256)` float32; v0.19 uses `(511, 1, 256)` — the one-row
    difference is absorbed by kokoro-onnx's style clamping).
* 24000 Hz output. `speed` in 0.5–2.0 scales phoneme durations (measured
  non-linearly — see `TTS_BENCHMARK.md`); default 1.0, natural pace.
* **No native word timings** on this export → `timings=None`.
* Weights are downloaded from pinned GitHub git-blobs (Hugging Face and
  GitHub *release assets* are unreachable in this sandbox; see
  `TTS_SETUP.md`).

### Piper (`piper_provider.py`) — fast fallback
* `piper-tts` (piper1-gpl), medium voices in `~/.cache/piper_voices`
  (fetched by the repo's `universal_toolbook/tools/fetch_piper_voices.py` from the GitHub mirror).
* 22050 Hz output.
* **Does** report per-phoneme alignments (with `piper-tts[alignment]`), so the
  provider derives real word timings from them.
* **Rate control**: the `speed` parameter maps to Piper's native
  `SynthesisConfig.length_scale` (`length_scale = 1 / speed`; <1 faster,
  >1 slower). Default 1.0 keeps each voice's natural pace — by policy we do
  **not** slow ryan down to imitate the Kokoro voices (that degrades the
  voice); the pace difference is documented in `TTS_VOICE_COMPARISON.md`.
* **Fallback only by policy**: while Kokoro is available, Piper never takes
  over from it; its role is air-gapped/last-resort output.

### Edge (`edge_provider.py`) — retained, not the default
* Wraps `edge-tts` (proprietary cloud). Kept so machines that *can* reach
  `speech.platform.bing.com` still can, and as a third reference provider.
* In the Arena sandbox the endpoint is unreachable, so synthesis fails per
  line and the chain falls through to the offline engines.
* Not chosen as default: not self-hosted, not guaranteed free, and the
  motivation for this work was to move off it.

## 3a. Voice selection policy (`tts/config/voices.json` → `selection`)

The selection rules are data, not code — they live in `voices.json` and are
enforced deterministically:

* **Primary default: `am_michael`.** New projects and every automatic
  selection resolve to `selection.default_voice` (=`am_michael`). `af_bella`
  is the secondary default (readily selectable, still the `Jenny`/`Sofia`
  alias target); `am_adam`/`af_sky` are the other quick picks.
* **One run = one voice.** Automatic selection is a single deterministic
  lookup, never random and never per-scene
  (`selection.per_scene_switching: false`). A 2+ scene job keeps the same
  resolved voice start to finish (covered by `test_voice_selection_and_expansion`).
* **Explicit selection per project/channel.** `--voice` on
  `generate_voiceover.py`, the `voice` field on scene jobs, or a per-project
  config value. Changing the voice never touches the narration script —
  the job signature (engine/voice/speed/language/text) just changes, so
  switching voices re-synthesizes without any script edit.
* **Aliases are stable shorthand.** The Edge-style names (`en-US-JennyNeural`,
  ...) and `narrator`/`host` map to native ids in `engines.<engine>.aliases`;
  `narrator`/`host` follow the default (`am_michael` on Kokoro).
* **Unavailable voice = clear report + documented fallback.** If a requested
  voice is not installed, the provider logs one warning naming the voice and
  the fallback, synthesizes with the engine's default, and records
  `meta.voice_fallback=true` + `meta.voice_requested` on every result (so
  manifests show exactly what happened). It never fails the job silently.

## 4. Audio processing (`universal_toolbook/tts/audio.py`)

A small, side-effect-free library (numpy + stdlib `wave` + ffmpeg) shared by
the CLIs, the pipeline, and the tests. The processing chain is fixed and
deliberately gentle:

```
resample → peak pre-pass → RMS loudness normalize → soft peak limit
```

* **resample** — to one consistent rate (44100 by default, matching the
  pipeline's `SAMPLE_RATE`).
* **peak pre-pass** — only *lowers* peaks above −1 dBFS; never amplifies.
* **RMS normalize** — the **primary** loudness control (target −16 dBFS, in
  the repo's narration QC band −16…−19) so every segment sits at the same
  level.
* **soft limit** — tanh knee at −0.5 dBFS as a safety net. **No compression.**

`analyze()` produces a full quality report (duration, peak, RMS,
leading/trailing/longest-internal silence, clipped-sample count, all-silence)
used by `validate_audio.py` and by the resume check. `check_file()` is the
resumability gate: a cached segment is only reused if it's readable,
non-silent, and its duration matches what the manifest recorded.

**Originals are always preserved** — `process_audio` writes `*_processed.wav`
next to the input and never modifies the source.

## 5. Segmentation & pronunciation (`universal_toolbook/tts/segment.py`)

* **Segmentation** — splits approved text into natural units with explicit
  pause hints: paragraph break → `paragraph_pause_s` (0.6), sentence end
  (`. ! ? …`, including after a newline) → `sentence_pause_s` (0.25).
  Overlong sentences are split at clause boundaries. In **scene mode** the
  whole scene is one segment (for animation sync). The original text is kept
  verbatim on every segment so captions/timings always show the approved
  spelling.
* **Pronunciation dictionary** — `pronunciation_dictionary.json` maps a
  written token (word-boundary, case-insensitive) to the spelling that is
  *spoken*. Only the text sent to the engine is rewritten (`tts_text`); the
  approved text is untouched. This controls pronunciation of names/acronyms
  without changing meaning or spelling in deliverables.

## 6. Resumability & manifests (`universal_toolbook/tts/manifest.py`)

One **job directory** holds everything for one (script, engine, voice,
settings) combo:

```
<out_dir>/
  manifest.json            job metadata + per-segment status
  segments/seg-NNN.wav     raw engine output (originals)
  segments/seg-NNN.mp3     optional
  final/seg-NNN.wav        processed (resampled/normalized/limited)
  final/full.wav           concatenated with configured pauses
  final/full.mp3           optional
```

* **Job id** = SHA-1 over engine/voice/speed/language/text-hash/settings —
  a stable identity for a script+settings combination.
* **Resume rule**: a segment is skipped on re-run iff its file exists, passes
  `check_file`, and its stored signature matches. A single failed segment is
  retried on the next run and never forces regeneration of the others.
* The manifest stores model/config metadata (engine version, model, voice,
  speed, language, processing settings) so output from one session is
  reproducible in another.

## 7. Pipeline integration (`universal_toolbook/engine/voice_engine.py`)

`prepare_episode_voiceover(spec, work_dir, mode, ...)` now tries backends in
this order (only for lines not yet produced):

```
mode "kokoro" :  Kokoro (forced; clear error if not set up)  → Piper rescue
mode "auto"   :  Kokoro (if installed) → Edge → Piper
mode "edge"   :  Edge → Piper
mode "piper"  :  Piper
mode "offline":  OS TTS (espeak)
mode "none"   :  text-led (no audio)
```

Kokoro lines are synthesized at 24 kHz, converted to 44.1 kHz mono, compacted
for internal dead air, and given the energy-refined word timings — the exact
sequence the Piper path already used, so boards/cameras/subtitles stay
speech-locked. Kokoro-mode cache uses a distinct signature namespace
(`k1|` prefix) so switching engines never reuses another engine's cached WAV.

The `run_studio.py render` command gained `--voice kokoro` and reports
`kokoro_ready` in its bootstrap `check`.

## 8. Why this shape

* **Pluggable, not a fork.** The pipeline keeps working if Kokoro is absent
  (it falls back to Edge/Piper exactly as before). Adding a future engine is
  one provider class + one registry line.
* **CPU-first, no server.** Everything is on-demand inference that loads,
  synthesizes, and exits. No daemon, no GPU, fits in ~0.7 GB RAM.
* **Honest metadata.** Missing word timings, cloud vs local, and generation
  timing are recorded rather than papered over.
