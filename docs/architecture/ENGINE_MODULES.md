# Engine modules — conceptual responsibilities without a risky physical rewrite

`universal_toolbook/engine/` is intentionally **flat**. All 15 CommonJS modules use relative
`require('./x')`, `tests/regression/run_all_tests.js` imports them by path, and the renderer is a
single frame pipeline. Splitting it into `rendering/`, `animation/`, `composition/`, `audio/`,
`voiceover/`, `synchronization/` and `orchestration/` folders would rewrite every import for no
functional gain. The conceptual map below is the authoritative substitute; see
[`../decisions/ADR-0002-engine-layout.md`](../decisions/ADR-0002-engine-layout.md).

| Conceptual layer | Modules | Responsibility |
|---|---|---|
| **Orchestration** | `run_studio.py` | CLI `check`, `bgm-list`, `validate`, `stills`, `render`, `player`; spawns Node, invokes Python audio, writes reports |
| **Composition / timeline** | `episode.js` | `compileEpisode()`: fps, scene `startSec`/`endSec`/`startFrame`/`endFrame`, chapters, cast resolution, subtitles, sound events, validation warnings |
| **Rendering** | `video_renderer.js`, `canvas_backend.js`, `font.js`, `render_layout.js` | `renderEpisodeFrame()` pure function of `frameIdx`; canvas backend abstraction; Poppins font registration; viewport/safe-area geometry |
| **Animation / rig** | `character_rig.js`, `motion_library.js` | BONES/skeleton/IK, `clamp`/`lerp`/`ease`/`springEase`/`backEase`/`lerpPose`, 60 `SUPPORTED_ACTIONS`, `evaluateCharacterState()`, paired interactions, footstep timing |
| **World / assets** | `environments.js`, `world_props_and_boards.js`, `parchment_ink_style.js`, `beacon_harbor.js`, `impossible_wall.js`, `bamboo_grove.js`, `doodle_date.js`, `stamp_card.js` | 12 environment presets and parametric settings, props/vehicles, 14 board types (including the count-and-fill `stamp_card`), ink-on-paper style, harbor, wall and bamboo-cutaway scene libraries |
| **Camera / framing** | `portrait_framing.js` + camera code in `video_renderer.js` | speech-aware 9:16 crop, held-prop and board fitting, `camera` drift, `camera_shots` cuts, uniform scaling |
| **Voiceover** | `engine/voice_engine.py`, `tts/` | Kokoro → Edge → Piper chain, per-line WAV cache, word timings, silence compaction, cue alignment, external audio |
| **Audio / music / mix** | `engine/audio_mixer.py`, `engine/bgm_library.py` | CC BGM catalog and mood scoring, dynamic per-scene tracks, foley, ducking, loudness normalisation, mux to MP4 |
| **Synchronization** | `voice_engine.py` alignment functions + compiled `lineTimings`/`wordTimings` | resolve `cue_on`/`hide_on`/`end_on` against measured speech; drive subtitle glow and camera cuts |

## Supporting kit files

| File | Responsibility |
|---|---|
| `config/studio_config.json` | fps 30, 1920×1080, `film_grain: false`, `subtitles_default`, `bgm_default`, `voice_default: am_michael`, empty channel name |
| `tts/config/voices.json` | `default_engine: kokoro`, `default_voice: am_michael`, `secondary_voices`, aliases, 44-voice catalog |
| `tts/config/pronunciation_dictionary.json` | pronunciation-safe replacements |
| `assets/Poppins-Regular.ttf`, `Poppins-Bold.ttf` | bundled typography |
| `assets/bgm/BGM_CATALOG.json` | 7 CC0/CC BY track ids, moods, keywords, licences, source URLs |
| `assets/bgm/CREATIVE_COMMONS_LICENSES.md` | per-track attribution |
| `templates/episode_minimal.json` | validated 2-scene / 24 s runnable skeleton |
| `01_TOOLBOOK_REFERENCE.md` | full JSON schema, all actions/environments/boards |
| `process/01..08` | kit-internal technical procedure: intake, authoring, render, geometry, audio, QA, troubleshooting, limits |

## Extension rules

1. New action → `motion_library.js` `SUPPORTED_ACTIONS` + `evaluateCharacterState()` + assertion in `tests/regression/run_all_tests.js`.
2. New board/prop → `world_props_and_boards.js` supported list + renderer + spec validation.
3. New timing/easing → reuse `character_rig.js` helpers; keep every visual a pure function of the frame.
4. New voice/provider → `tts/providers/` + `tts/config/voices.json` + `docs/production/TTS_ARCHITECTURE.md` + tests.
5. New output format → `run_studio.py` + `episode.js`/`video_renderer.js` + `tests/integration/test_studio_pipeline.py` + docs.
6. Never add a per-video workaround to a project spec; fix the shared engine and add a regression test.
