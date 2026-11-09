---
name: voiceover-audio
description: "Set up and operate the Kokoro and Piper TTS pipeline, choose approved voices, generate narration, mix BGM and SFX, and diagnose audio failures."
---

# Skill: voiceover-audio

**Activate when:** generating narration, choosing a voice, setting up TTS, mixing BGM/foley,
measuring audio, fixing silence/volume/sync problems, or interpreting `voice_backend`,
`voiced`, `peak_dbfs` / `rms_dbfs` in a render report. Always activate alongside
[`animation-production`](../animation-production/SKILL.md) for a video request.

**Authority:** [`universal_toolbook/tts/config/voices.json`](../../universal_toolbook/tts/config/voices.json)
is the single source of truth for voice policy;
[`universal_toolbook/config/studio_config.json`](../../universal_toolbook/config/studio_config.json)
holds the engine default; [`universal_toolbook/assets/bgm/BGM_CATALOG.json`](../../universal_toolbook/assets/bgm/BGM_CATALOG.json)
holds the music catalog. Architecture:
[`docs/production/TTS_ARCHITECTURE.md`](../../docs/production/TTS_ARCHITECTURE.md),
[`docs/architecture/AUDIO_TTS_PIPELINE.md`](../../docs/architecture/AUDIO_TTS_PIPELINE.md).

## Voice policy — never change silently

| Role | Engine | Voice |
|---|---|---|
| Default primary narrator | Kokoro | `am_michael` |
| Preferred secondary | Kokoro | `af_bella` |
| Other approved voices | Kokoro | only when a character genuinely suits them |
| Last-resort fallback | Piper | only when a line cannot be voiced by Kokoro |
| Cloud fallback | Edge | retained, not the default |

`default_engine: "kokoro"`, `selection.default_voice: "am_michael"`,
`selection.automatic: "default_voice"`, `per_scene_switching: false`. One run uses one voice from
start to finish unless a project explicitly names another. `config/studio_config.json` also sets
`voice_default: "am_michael"`. English-only narration unless the user explicitly asks otherwise.

## Setup and generation

```bash
python3 universal_toolbook/setup_tts.py          # pinned Kokoro weights + Piper fallback voices
python3 universal_toolbook/run_studio.py check   # kokoro_ready / offline_voiceover_ready must be true
python3 universal_toolbook/generate_voiceover.py --voices
```

Kokoro weights live in ignored `runtime/cache/tts/`; they are **not** committed. See
[`docs/getting-started/INSTALL.md`](../../docs/getting-started/INSTALL.md) and
[`docs/production/TTS_SETUP.md`](../../docs/production/TTS_SETUP.md). The film pipeline calls
`--voice auto` (Kokoro → Edge → Piper). `--voice none` is only for a deliberately silent smoke
test. A render with no synthesized speech exits 3 with `status: COMPLETE_SILENT` and a
`voice_diagnosis` list; fix the backend and re-render, never deliver it as voiced.

## Synchronization

- `voice_engine.py` synthesizes per-line WAVs, compacts TTS dead air while preserving punctuation
  pauses, derives word timings, and writes a **retimed** episode with `line_timings` /
  `word_timings`.
- `align_scene_board_to_speech()` and `align_scene_cameras_to_speech()` resolve `cue_on`,
  `hide_on` and `end_on` phrases against those word times. Use distinctive multi-word phrases; a
  short stopword can fire on an earlier occurrence.
- `accent_words` drives multi-word subtitle glow; `line_timings` drives speaker pills. Audio is
  prepared before frame encoding, so visuals follow the real speech timeline.
- `compact_internal_silences_with_words()` keeps sentence punctuation ≥0.42 s, commas ≥0.24 s and
  ellipses as deliberate pauses. Punctuation in the polished script is timing design.

## Music, foley and mix

- Use the 7 bundled CC0 / CC BY 4.0 tracks from `BGM_CATALOG.json`; `bgm: "dynamic"` or per-scene
  `bgm` ids switch mood per act. Credits are generated automatically from tracks actually used.
  Record licence and attribution in `ASSET_MANIFEST.json` and keep
  [`CREATIVE_COMMONS_LICENSES.md`](../../universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md)
  as the licence source.
- Foley comes from `sfx[]` and generated events (footsteps, chapter chimes, board cues). Speech
  ducking keeps narration above music and effects.
- Measured targets on the rendered mixed WAV: peak −3…−1 dBFS, RMS −16…−19 dBFS. The engine
  normalises loudness automatically; if a master still falls outside the band, fix the engine and
  re-render — never tweak one video's gains by hand.
- Measurement tools: `tools/audio_report.py`, `tools/mix_probe.py`, `tools/subtitle_check.py`,
  `tools/produce_video.py` (stages G–I) and the `*_report.json` written beside the MP4.

## Troubleshooting

Use [`docs/production/TTS_TROUBLESHOOTING.md`](../../docs/production/TTS_TROUBLESHOOTING.md),
[`docs/production/KNOWN_ISSUES.md`](../../docs/production/KNOWN_ISSUES.md) and
[`docs/troubleshooting/INDEX.md`](../../docs/troubleshooting/INDEX.md). Common verified cases:
missing Kokoro weights (silent fallback), Piper voice files not installed, a line dropped while
`voiced: true` still appears, chunk resume being content-blind, external audio via `--voice-dir`
and `<sceneId>.wav`. Every fix is reusable and gets a regression check.
