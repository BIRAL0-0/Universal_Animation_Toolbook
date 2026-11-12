# Rendering pipeline — the actual custom frame renderer

This document describes the **existing** renderer. It is not a Remotion application; see
[`../decisions/ADR-0001-remotion-evaluation.md`](../decisions/ADR-0001-remotion-evaluation.md).
The agent-facing adaptation is
[`skills/animation-production/references/frame-based-animation.md`](../../skills/animation-production/references/frame-based-animation.md).

## 1. From spec to frames

`universal_toolbook/run_studio.py render` loads `episode.json`, prepares audio (see
[`AUDIO_TTS_PIPELINE.md`](AUDIO_TTS_PIPELINE.md)), then invokes Node with
`engine/video_renderer.js`. `compileEpisode()` in `engine/episode.js` turns the authored spec into
a frame-indexed structure:

- `fps` = `options.fps || spec.fps || config/studio_config.json.fps || 30`.
- Each scene gets `duration` (≥1.5 s), `startSec`, `endSec`, `startFrame`, `endFrame`.
- `cast` profiles are resolved into per-scene characters; `beats[]` are validated against the 60
  `SUPPORTED_ACTIONS`.
- `camera`, `camera_shots`, `boards`, `props`, `sfx`, `chapter`, `intertitle`, `end_card` and
  transition flags are compiled into scene objects.
- `line_timings` / `word_timings` produce subtitles and multi-word `accent_words` highlights.
- `soundEvents` (footsteps, chapter chimes, board/room cues) are derived from the same timeline.

## 2. Frame evaluation

`renderEpisodeFrame(ctx, outW, outH, episode, frameIdx)`:

1. `globalT = frameIdx / episode.fps`; `findSceneAtFrame()` selects the scene or outro.
2. `ts = clamp(globalT - scene.startSec, 0, scene.duration)` — every visual is a pure function of
   this value. No wall-clock time, no random state, no inter-frame mutation.
3. Portrait output calls `computePortraitViewport()` / `computeLandscapePropZoomScale()` from
   `portrait_framing.js`; uniform scaling keeps geometry intact.
4. Draw order: environment → background props → characters (with z-depth occlusion) → foreground
   props → screen-space boards/captions → chapter ribbon / intertitle → subtitles → transition
   overlays.
5. `evaluateSceneCamera()` interpolates zoom/pan/focus using `lerp` + `ease`; `camera_shots`
   supply cuts and `blend_sec`.
6. Boards are clamped in screen space (`fitBoardToPortraitViewport`) so camera moves never drag
   them off frame.
7. Raw RGBA frames are piped to ffmpeg in chunks; `--resume` reuses deterministic chunk output.

## 3. Timing, interpolation and easing

| Concept | Implementation |
|---|---|
| Frame clock | `frameIdx / fps`, integer frame indices |
| Normalised progress | `clamp((t - start) / (end - start))` |
| Linear interpolation | `lerp(a, b, k)` |
| Smoothstep | `ease(k) = k²(3−2k)` |
| Spring / overshoot | `springEase(t, {stiffness, damping, mass})`, `backEase(t, overshoot)` |
| Pose blending | `lerpPose(a, b, k)` |
| Dynamic duration | speech-locked retiming in Python before rendering; reports record the final duration |

All helpers live in `engine/character_rig.js`. Extend them, do not introduce a second animation
runtime.

## 4. Composition, transitions and captions

- **Composition metadata:** top-level `episode.json` (title, style, fps, cast, voices, BGM mode);
  delivery aspect/resolution chosen at render time. One spec can produce 1920×1080 and 1080×1920.
- **Sequencing:** the ordered `scenes[]` array; compiled in/out frames are the timeline. Chapters
  are derived from `scenes[].chapter` and emitted as `*_chapters.txt`.
- **Transitions:** automatic 0.32 s fade-in / 0.28 s fade-out on environment change;
  `fade_to_black`, `cut_to_black_at`, `wind_blackout_at`, `flashback_window`, `split_screen`,
  `intertitle`, `end_card`, `camera_shots[].cut`. No generic transition package.
- **Typography:** bundled Poppins fonts registered once by `font.js`; canvas text measurement and
  safe-area clamps.
- **Captions:** burned-in cinema subtitles from `line_timings`, word glow from `word_timings` /
  `accent_words`, speaker pills, `subtitles_mode: cinema|off`. SRT/VTT import, transcription and
  export are **not implemented** (roadmap F4).

## 5. Output and verification

Beside each MP4 the renderer writes `<stem>_report.json`,
`<stem>_validation_report.json`, `<stem>_visual_audio_cues.json` and `<stem>_chapters.txt`.
`tests/regression/run_all_tests.js` covers 60 actions, 7 builds, 12 hairstyles, 12 environments,
portrait framing, subtitle glow, 0 px bone stretch and 0 px stance foot slip. CI renders the
minimal episode silently and asserts a clean validation report. Full QA is in
[`skills/production-quality/SKILL.md`](../../skills/production-quality/SKILL.md).
