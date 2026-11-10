---
name: cinematic-composition
description: "Compose native 9:16 vertical Shorts (<60s) and 16:9 landscape long-form (>=60s) shots, enforce safe regions, motivate camera pushes/cuts, and stage subjects with clean negative space."
---

# Skill: cinematic-composition

## Purpose

Ensure every shot in `universal_toolbook/engine/render_layout.js`, `universal_toolbook/engine/portrait_framing.js`, `universal_toolbook/engine/video_renderer.js`, and `universal_toolbook/run_studio.py` selects the right aspect ratio from planned/actual duration before layout, composes natively for `9:16` (`1080x1920`) or `16:9` (`1920x1080`) without cropping or stretching, and guides viewer focus cleanly.

## Trigger Conditions

Activate whenever:
- planning video format, aspect ratio, storyboard framing, character `x` positions, or camera shots,
- authoring `camera`, `camera_shots[]`, `portrait_focus`, `portrait_focus_x`, or `boards[]` in `episode.json`,
- editing `universal_toolbook/engine/render_layout.js`, `universal_toolbook/engine/portrait_framing.js`, or `universal_toolbook/run_studio.py`,
- diagnosing cramped framing, clipped headers/props, awkward cuts, or boundary-crossing duration shifts.

## Core Rules & Non-Negotiable Constraints

1. **Automatic Video Format & Duration Policy (`FORMAT_DURATION_BOUNDARY_SEC = 60.0`).**
   - `< 60.0s` (`00:59` or less) -> Portrait `9:16` (`1080x1920`) for YouTube Shorts.
   - `>= 60.0s` (`01:00` or longer) -> Landscape `16:9` (`1920x1080`) for YouTube long-form.
   - Determine format from planned narration/video duration during script planning (never from scene count or filename), store `selected_video_format` in the spec/scene plan, and re-evaluate after TTS synthesis (`cmd_render`) so boundary crossings (`59s <-> 60s`) automatically recompose before rendering frames.
   - Honor explicit user overrides (`--aspect-ratio`, `--shorts`, `video_format_override`) and report `override_notice` in `format_policy`.
2. **Native vector composition in both formats — never crop a landscape bitmap.** `renderEpisodeFrame` projects stage vectors directly onto the `1080x1920` or `1920x1080` canvas with full-bleed near-black background and native screen-space UI/subtitles.
3. **Respect aspect-specific safe zones (`CANONICAL_LAYOUT_16_9` & `CANONICAL_LAYOUT_9_16`).**
   - `16:9`: margins `72/72/48/42`, `animationSafeRegion` `[96..1824, 108..862]`, `subtitleSafeRegion` `[240..1680, 882..1038]`.
   - `9:16`: margins `56/56/96/128`, `animationSafeRegion` `[68..1012, 240..1465]`, `subtitleSafeRegion` `[64..1016, 1490..1786]`.
4. **Motivated camera moves only.** Keep default scene drift restrained (`zoom_from: 1.0 -> zoom_to: 1.04`). Reserve `camera_shots[]` close-ups (`zoom: 1.15–1.28`) for concrete emotional reveals, phone screens, or speech-locked `cue_on` phrases.

## Practical Workflow

1. **Calculate planned runtime first.** Sum estimated spoken duration (`words / 2.55` + pauses) across scenes and run `selectVideoFormatForDuration` / `select_video_format_for_duration` before blocking character `x` coordinates.
2. **Stage tighter horizontal groupings for `< 60s` (`9:16`).** Keep two-actor conversations within `0.36..0.64` normalized stage width so both actors fit comfortably inside the vertical `9:16` field of view without excessive zoom-out.
3. **Stage balanced rule-of-thirds spacing for `>= 60s` (`16:9`).** Place focal actors around `0.34–0.66` with clear sightlines toward props or boards.
4. **Inspect both framing & safe margins.** Render full-resolution stills (`1080x1920` or `1920x1080`) and verify headers, held props, hands, and feet clear every margin.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Chapter header clipped at top of `9:16` | Header drawn in offset stage coordinates | Draw headers via `drawNativeScreenChapterRibbon` inside `layout.headerSafeRegion` |
| Blurry or letterboxed `9:16` video | Rasterizing to `1920x1080` scratch bitmap and scaling crop | Keep direct vector transform in `renderEpisodeFrame` (`universal_toolbook/engine/video_renderer.js`) |
| Held prop clipped at frame edge on camera push | Authored zoom ignored prop bounds | `computePortraitViewport` and `computeLandscapePropZoomScale` automatically ease zoom back to fit held props |
| Script crosses `60s` after TTS | Planned `58s` voiced at `62s` | Let `run_studio.py` re-evaluate `select_video_format_for_duration` post-TTS before chunk rendering |

## Quality Checklist

- [ ] `format_policy` matches `< 60.0s -> 9:16` and `>= 60.0s -> 16:9` (or documents explicit override).
- [ ] Encoded pixel dimensions match declared aspect (`dimensions_match_aspect: true`).
- [ ] Zero letterbox bars, blurred sidebars, or clipped character heads/hands/props.
- [ ] Camera cuts align with story turns or multi-word `cue_on` phrases.

## External References & Attribution

- Katz, S. D. (1991), *Film Directing Shot by Shot* — shot scale, eyeline continuity, 180-degree staging rule, and motivated camera movement.
- Block, B. (2020), *The Visual Story* — screen space, depth cues, contrast of affinity, and negative space.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — composition metadata and dynamic duration concepts (`calculateMetadata` mapped to Python pre-render retiming; `docs/decisions/ADR-0001-remotion-evaluation.md`).

## Concrete Engine Recipes

### Querying format policy in JS (`render_layout.js`) & Python (`run_studio.py`)

```js
const { selectVideoFormatForDuration, getLayoutConfig } = require('./universal_toolbook/engine/render_layout');
const policy = selectVideoFormatForDuration(48.5); // -> { format: '9:16', width: 1080, height: 1920, ... }
const layout = getLayoutConfig(policy.width, policy.height);
```
