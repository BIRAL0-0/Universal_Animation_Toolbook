# Toolbook renderer map — where each responsibility actually lives

This is the implementation map for [`../SKILL.md`](../SKILL.md). It describes the **existing**
custom renderer, not Remotion. Paths are repository-root relative.

## Runtime ownership

| Concern | Owner | Notes |
|---|---|---|
| CLI / orchestration | `universal_toolbook/run_studio.py` | `check`, `bgm-list`, `validate`, `stills`, `render`, `player`; spawns Node for frame rendering, imports Python audio modules |
| Episode compile / validation | `universal_toolbook/engine/episode.js` | `compileEpisode(spec, options)` builds frame-indexed scenes, chapters, subtitles, sound events; emits `warnings` |
| Frame drawing | `universal_toolbook/engine/video_renderer.js` | `renderEpisodeFrame()`; `findSceneAtFrame()`; environment change fades; screen-space captions/boards |
| Canvas backend | `universal_toolbook/engine/canvas_backend.js`, `font.js` | `node-canvas` or `@napi-rs/canvas`; Poppins fonts from `assets/` |
| Characters / rig math | `universal_toolbook/engine/character_rig.js` | `BONES`, `skeleton`, `drawFigure`, `clamp`, `lerp`, `ease`, `springEase`, `backEase`, `lerpPose` |
| Actions / motion | `universal_toolbook/engine/motion_library.js` | `SUPPORTED_ACTIONS` (60), `evaluateCharacterState()`, `resolveSceneInteractions()`, footstep times |
| Environments | `universal_toolbook/engine/environments.js` | 12 presets, parametric `setting` objects, `drawEnvironment()` |
| Props / boards | `universal_toolbook/engine/world_props_and_boards.js` | `SUPPORTED_PROPS`, `SUPPORTED_BOARDS` (13 board types) |
| Parchment/backdrop sets | `parchment_ink_style.js`, `beacon_harbor.js`, `impossible_wall.js` | ink-stick style, harbor and wall scene libraries |
| Camera / framing | `video_renderer.js`, `portrait_framing.js`, `render_layout.js` | scene camera evaluation, speech-safe 9:16 reframing, safe-area layout |
| Voice generation | `universal_toolbook/engine/voice_engine.py`, `universal_toolbook/tts/` | Kokoro → Edge → Piper chain, word timings, silence compaction, cue alignment, external audio |
| Music / mix / encode | `engine/audio_mixer.py`, `engine/bgm_library.py` | BGM catalog, dynamic per-scene tracks, foley, ducking, loudness, mux to MP4 |
| Standalone TTS CLI | `generate_voiceover.py`, `process_audio.py`, `validate_audio.py`, `setup_tts.py` | resumable TTS jobs, pinned weight download, audio validation |
| Config | `config/studio_config.json`, `tts/config/voices.json`, `tts/config/pronunciation_dictionary.json` | fps/size/grain/voice default; voice engine policy; pronunciation |
| Assets | `assets/Poppins-*.ttf`, `assets/bgm/*.mp3`, `BGM_CATALOG.json`, `CREATIVE_COMMONS_LICENSES.md` | bundled, tracked; Kokoro weights are downloaded into ignored `runtime/cache/tts/` |
| Spec template | `templates/episode_minimal.json` | smallest validated 2-scene / 24 s episode; use it for smoke tests |

## `episode.json` → compiled scene field map

| Authoring field | Compiled field | Used by |
|---|---|---|
| `fps`, `width`, `height` | `episode.fps`, render viewport | `compileEpisode`, `renderEpisodeFrame` |
| `scenes[].duration` | `duration`, `startSec`, `endSec`, `startFrame`, `endFrame` | sequencing, all timing |
| `scenes[].environment` / `setting` | `environment`, `setting`, `settingSignature` | `drawEnvironment`, automatic transition fades |
| `scenes[].characters[].beats[]` | `characters[].beats[]` | `evaluateCharacterState` |
| `scenes[].camera`, `camera_shots[]` | `camera`, `cameraShots` | `evaluateSceneCamera` |
| `scenes[].board` / `boards[]` | `board`, `boards` | `drawWorldBoard`, `fitBoardToPortraitViewport` |
| `scenes[].props[]` | `props` | `drawWorldProp`, foreground/background passes |
| `scenes[].dialogue[]`, `narration` | `dialogue`, `narration`, `subtitles` | voice synthesis, `buildCinemaSubtitles` |
| `scenes[].line_timings`, `word_timings` | `lineTimings`, `wordTimings` | exact subtitle timing, word glow |
| `scenes[].accent_words` | subtitle highlight tokens | `drawCinemaSubtitles` / glow capsules |
| `scenes[].sfx`, `sound_events` | `episode.soundEvents` | `audio_mixer.py` |
| `scenes[].bgm`, `bgm_gain`, `bgm_offset`, `bgm_fade_out` | scene BGM metadata | `bgm_library.py` |
| `scenes[].chapter`, `intertitle`, `end_card`, `outro` | compiled scene / outro | chapter ribbon, intertitles, end card |
| `scenes[].fade_to_black`, `cut_to_black_at`, `wind_blackout_at`, `split_screen`, `flashback_window` | compiled flags | transition drawing in `video_renderer.js` |
| `scenes[].portrait_focus`, `portrait_focus_x` | framing hints | `portrait_framing.js` (override only with frame evidence) |
| `cast` | `episode.cast` | `compileEpisode` resolves per-scene character profiles |
| `voices` | TTS engine selection | `voice_engine.py` |
| `bgm` (top level) | global BGM mode | `bgm_library.py` |

## CLI surface (`universal_toolbook/run_studio.py`)

| Command | Purpose | Key flags |
|---|---|---|
| `check` | environment, fonts, BGM, ffmpeg, TTS readiness | — |
| `bgm-list` | list 7 bundled CC tracks and moods | — |
| `validate` | spec structure + optional verbatim script fidelity | `--script` |
| `stills` | full-resolution PNGs for visual QA | `--out-dir`, `--width`, `--height`, `--limit` |
| `render` | draft or master MP4 | `--out`, `--aspect-ratio`, `--short-form`, `--shorts`, `--draft`, `--full`, `--voice`, `--voice-name`, `--voice-rate`, `--voice-dir`, `--bgm`, `--subtitles`, `--preset`, `--crf`, `--chunk-sec`, `--workers`, `--resume`, `--allow-silent` |
| `player` | self-contained HTML5 download wrapper | `--out`, `--max-mb` |

Exit code 3 = `COMPLETE_SILENT` (no speech synthesized). Reports written beside the MP4:
`<stem>_report.json`, `<stem>_validation_report.json`, `<stem>_visual_audio_cues.json`,
`<stem>_chapters.txt`.

## Regression protection

| Test | Protects |
|---|---|
| `tests/regression/run_all_tests.js` | rig geometry, 60 actions, 12 environments, portrait framing, subtitle glow, 0 px bone stretch/foot slip |
| `tests/integration/test_studio_pipeline.py` | aspect profiles, BGM catalog/scoring, script fidelity, silence compactor, speech-locked boards/cameras |
| `tests/production/` | project archives, polish prompt hash, no channel name, aspect pixels, mix loudness, docs links, environment readiness |
| `tests/unit/` | repository structure, skill activation, single master prompt, runtime hygiene, link validity |
| `tools/validate_specs.py` | all `examples/` specs and the minimal template validate with `warnings: []` |
| `tools/validate_structure.py` | required paths, generated-file hygiene, skill/template/project integrity |
