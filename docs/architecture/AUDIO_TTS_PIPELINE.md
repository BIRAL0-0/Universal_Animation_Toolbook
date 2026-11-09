# Audio, TTS and synchronization pipeline

Detailed subsystem documentation:
[`../production/TTS_ARCHITECTURE.md`](../production/TTS_ARCHITECTURE.md),
[`../production/TTS_SETUP.md`](../production/TTS_SETUP.md),
[`../production/TTS_BENCHMARK.md`](../production/TTS_BENCHMARK.md),
[`../production/AUDIO_VISUAL_SYNCHRONIZATION.md`](../production/AUDIO_VISUAL_SYNCHRONIZATION.md).
Agent procedure: [`skills/voiceover-audio/SKILL.md`](../../skills/voiceover-audio/SKILL.md).

## Ownership

| Layer | Files | Responsibility |
|---|---|---|
| CLI | `universal_toolbook/run_studio.py`, `generate_voiceover.py`, `process_audio.py`, `validate_audio.py` | render integration, standalone TTS jobs, processing, validation |
| TTS subsystem | `universal_toolbook/tts/` | Kokoro / Piper / Edge providers, audio processing, segmentation, manifests, config |
| Film integration | `universal_toolbook/engine/voice_engine.py` | per-line synthesis, word timings, dead-air compaction, speech-locked cue alignment, external audio |
| Music / mix | `universal_toolbook/engine/audio_mixer.py`, `engine/bgm_library.py` | 7-track CC catalog, mood scoring, per-scene dynamic BGM, foley, ducking, loudness, mux |
| Config | `universal_toolbook/tts/config/voices.json`, `pronunciation_dictionary.json`, `config/studio_config.json` | voice policy, pronunciation, studio defaults |
| Downloaded weights | ignored `runtime/cache/tts/` via `setup_tts.py` | Kokoro model + voices, Piper fallback voices |

## Voice policy

`default_engine: kokoro`, `selection.default_voice: am_michael`, `selection.automatic:
default_voice`, `secondary_voices: [af_bella, am_adam, af_sky]`, `per_scene_switching: false`.
`config/studio_config.json` also sets `voice_default: am_michael`. `--voice auto` resolves Kokoro →
Edge → Piper. A render with no synthesized speech exits 3 with `status: COMPLETE_SILENT` and
`voice_diagnosis`; it is never a voiced delivery. `--voice none` is only for silent smoke tests.

## Speech-locked timeline

1. Each `dialogue[]` line is synthesized to a per-line WAV with a content-addressed cache key.
2. `compact_internal_silences_with_words()` removes TTS dead air while preserving punctuation
   pauses; word timestamps shift with the audio.
3. `align_scene_board_to_speech()` and `align_scene_cameras_to_speech()` resolve multi-word
   `cue_on` / `hide_on` / `end_on` phrases against word timings.
4. The **retimed episode** carries `line_timings` and `word_timings`; `episode.js` uses them for
   subtitle cards and word glow, and the renderer uses them for boards and camera cuts.
5. `audio_mixer.py` combines narration, BGM and foley, applies ducking and loudness normalisation,
   and writes `master_audio.wav` plus measured peak/RMS values in the render report.
6. `run_studio.py` muxes the master audio with the encoded video.

Measured mix targets: peak −3…−1 dBFS, RMS −16…−19 dBFS. Attribution for every used CC track is
generated from `BGM_CATALOG.json` and recorded in `*_chapters.txt` and the project's
`ASSET_MANIFEST.json`.

## Verification

- `universal_toolbook/tts/test_tts.py` — TTS subsystem suite (run after `setup_tts.py`).
- `tests/integration/test_studio_pipeline.py` — BGM catalog, mood scoring, silence compactor,
  speech-locked boards/cameras, exact-word script fidelity.
- `tests/production/test_ki008_mix_loudness.py` — measured masters stay in the loudness band.
- `tools/audio_report.py`, `tools/mix_probe.py`, `tools/subtitle_check.py` — QA measurements.
- CI render-smoke proves the ffmpeg/encode path without downloading voice weights.
