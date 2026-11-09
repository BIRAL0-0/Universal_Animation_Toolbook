# Frame-based animation principles adapted to the Toolbook

This reference translates general programmatic-video ideas into the **actual** Toolbook renderer.
It is framework-independent: no React, Remotion or bundler is required. For Remotion-specific API
names see [`remotion-techniques.md`](remotion-techniques.md).

## 1. Time is an integer frame, not a wall clock

The renderer draws frame `frameIdx` at `globalT = frameIdx / episode.fps` (30 fps by default).
`compileEpisode()` assigns every scene `startSec`, `endSec`, `startFrame` and `endFrame`; a frame
belongs to exactly one scene. Therefore:

- Author in **seconds** in `episode.json`; let the engine convert to frames.
- Every visual must be a pure function of `ts = globalT - scene.startSec`. No `Date.now()`, no
  random per-frame values, no state carried between frames. This is what makes chunked parallel
  rendering and `--resume` deterministic.
- Duration is data: total frames = `round(totalDuration * fps)`; scene order is the `scenes[]` array.
- Use `validate` to check the authored duration before a render; `--short-form` (40–90 s) and
  `--shorts` (≤180 s, 9:16) gate the *speech-locked* final runtime rather than the authored guess.

## 2. Interpolation and easing

| Principle | Toolbook implementation | Where |
|---|---|---|
| Normalised progress | `u = clamp((t - start) / (end - start))` | beats and camera evaluation |
| Linear interpolation | `lerp(a, b, k)` | camera zoom/pan/focus, character x travel |
| Smoothstep easing | `ease(k) = k²(3−2k)` | fades, ribbon enter/exit, board build, most motion |
| Spring / damped overshoot | `springEase(t, {stiffness, damping, mass})` or `{bounce}` | organic settle; available in `character_rig.js` |
| Anticipation / overshoot | `backEase(t, overshoot)` | available in `character_rig.js` |
| Pose blending | `lerpPose(a, b, k)` | transitions between rig poses |
| Clamping | `clamp(v, a, b)` | all timing and geometry |

When adding a new motion, reuse these helpers and register the action in `SUPPORTED_ACTIONS`.
Never hardcode a per-video easing curve into `episode.json`; extend the engine and add a JS
regression assertion in `tests/regression/run_all_tests.js`.

## 3. Sequencing and composition

- A film is an ordered array of scenes. Each scene has a duration, an environment, a cast subset,
  boards/props, camera shots, dialogue and SFX. This is the Toolbook equivalent of a composition
  timeline: **the scene list is the sequence**, and the compiled `startFrame`/`endFrame` are the
  in/out points.
- Metadata (title, style, fps, aspect, BGM mode, cast, voices) lives at the top of `episode.json`.
  Delivery size and aspect are chosen at render time; the same spec can produce 1920×1080 and
  1080×1920 without changing geometry.
- Dynamic duration: narration is synthesized first, then `voice_engine.py` retimes scenes to the
  measured speech and writes `line_timings` / `word_timings`. Do not assume an authored scene
  duration survives a voiced render. Reports record the final duration.
- Chapters are derived from `scenes[].chapter` and emitted as `*_chapters.txt`; they are also drawn
  as on-screen chapter ribbons. One field, two outputs, no duplicate chapter list.

## 4. Camera and transitions

- `camera` interpolates a slow drift across the scene; `camera_shots[]` describes motivated cuts
  with `start`/`cue_on`, zoom range, focus, `move_dur`, `cut` and `blend_sec`.
- Speech-locked cues are resolved by `align_scene_cameras_to_speech()` against measured word
  timings. Use full multi-word phrases, not a stopword that appears early in the line.
- Environment changes automatically fade (0.32 s in, 0.28 s out). Explicit `fade_to_black`,
  `cut_to_black_at`, `wind_blackout_at`, `flashback_window`, `split_screen`, `intertitle` and
  `end_card` are supported. There is no generic transition library; adding one is an engine change.
- Portrait reframing (`portrait_framing.js`) eases toward the active speaker, fits held props and
  boards inside the safe crop, and uses uniform scaling. Overrides require a specific draft frame
  as evidence (KI-009).

## 5. Captions and typography

- Fonts are bundled (`assets/Poppins-Regular.ttf`, `Poppins-Bold.ttf`) and registered once by
  `font.js`; do not rely on system fonts.
- `line_timings` produce exact speaker-labelled subtitle cards; `word_timings` produce word-level
  glowing highlights; `accent_words` selects multi-word phrases for emphasis.
- Subtitles are screen-space: they stay inside the safe area while the world camera moves. Boards
  are also screen-space clamped. `ink_caption` props are drawn after the camera transform is
  restored for the same reason.
- Keep one spoken sentence per `dialogue[]` entry: long lines wrap into two rows and can cover
  characters. `subtitles_mode: "off"` is available but mute-legibility still requires that the
  visuals tell the story.
- SRT/VTT import and transcription are **not implemented**. The roadmap item F4 in
  [`docs/development/ROADMAP.md`](../../../docs/development/ROADMAP.md) describes what would be
  needed. Do not write SRT-specific instructions as if they were executable here.

## 6. Media and synchronization

| Need | Toolbook mechanism |
|---|---|
| Voice | `tts/` Kokoro (default `am_michael`) → Edge → Piper fallback; `--voice auto` |
| Music | 7 bundled CC MP3s + `BGM_CATALOG.json`; `bgm: "dynamic"` / per-scene `bgm` |
| Sound effects | `sfx[]` plus generated events (footsteps, chapter chime, board reveal) |
| Mix | `audio_mixer.py`: ducking, loudness normalisation, peak/RMS measurement, mux |
| Word-accurate sync | `word_timings`, `line_timings`, `cue_on`/`hide_on` alignment |
| External media | `--voice-dir` for pre-rendered per-scene WAVs; local licensed MP3 via `--bgm` |
| Assets | fonts and BGM tracked in the kit; TTS weights downloaded by `setup_tts.py` into ignored `runtime/cache/tts/` |

Audio is prepared **before** frame encoding: the renderer receives the retimed episode, so visual
cues and captions already know the real speech timeline. User-supplied audio is the only
exception and must be aligned explicitly.

## 7. Quality and determinism checklist

1. `validate` → `warnings: []`.
2. Full-resolution stills in every delivered aspect, actually inspected.
3. Draft render with real voice timings; inspect board reveals and camera cuts at their cue times.
4. Master render; read `voiced`, `warnings`, `dimensions_match_aspect` and frame count from reports.
5. Full decode with ffmpeg, measure container and audio, extract ≥6 frames and look at them.
6. No black sections, no clipped limbs, no board outside the safe crop, no unintended silence.
7. Any defect becomes a reusable engine/skill/test change, not a one-video workaround.
