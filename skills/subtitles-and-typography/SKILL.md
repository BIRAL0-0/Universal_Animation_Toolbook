---
name: subtitles-and-typography
description: "Render crisp native-resolution subtitles in 16:9 and 9:16 with pre-placement text measurement, balanced wrapping, strict speech-end sync, and automatic collision-free relocation around characters and props."
---

# Skill: subtitles-and-typography

## Purpose

Ensure burned-in subtitles and on-screen typography in `universal_toolbook/engine/render_layout.js`, `universal_toolbook/engine/episode.js`, and `universal_toolbook/engine/video_renderer.js` remain effortlessly legible on desktop (`16:9`) and mobile (`9:16`), never clip or overflow margins, never linger past speech end, and never cover faces, active hands, held phones, or key props.

## Trigger Conditions

## Inputs

The compiled word timings, the frame size, and frames from the scenes with the densest speech. Subtitle problems only appear where the words are fastest.

Activate whenever:
- authoring `dialogue[]`, `narration`, `accent_words[]`, `chapter`, or `boards[]` in `episode.json`,
- editing subtitle chunking/timing in `universal_toolbook/engine/episode.js` or placement/rendering in `universal_toolbook/engine/render_layout.js` and `universal_toolbook/engine/video_renderer.js`,
- running `tools/subtitle_check.py` or inspecting `subtitleLayout` collision metrics,
- diagnosing text overlap, orphan line wraps, lingering captions, or font-size jumps.

## Core Rules & Non-Negotiable Constraints

1. **Measure text BEFORE placement (`measureAndPlaceSubtitle`).** Every token is measured with bundled `Poppins-Regular` (`500` medium cinema weight via `font.js`) at the canonical format font size (`30 px` on `1920x1080`, `42 px` on `1080x1920`) before computing screen coordinates. Font size never shrinks or jumps unpredictably from cue to cue.
2. **Balanced dynamic line wrapping inside safe margins.** `splitIntoBalancedChunks` breaks cues at punctuation/clause boundaries (`<= 11` words / `<= 68` chars), and `measureAndPlaceSubtitle` rebalances 2-line wraps to eliminate 1-word orphans while clamping strictly inside `layout.margins` and `style.maxLineWidth` (`1200 px` in `16:9`, `560 px` in `9:16`).
3. **Collision-aware placement (`0 px` overlap).** `video_renderer.js` projects active character `face`, `hand`, `prop`, `body`, and `text` bounding boxes into output screen pixels (`screenObstacles`). `measureAndPlaceSubtitle` scores `subtitleFallbackCentersY` (`[954, 976, 926, 168, 214]` in `16:9`; `[1622, 1668, 1568, 264, 326]` in `9:16`) and automatically relocates the subtitle block to an unobstructed safe band (`relocated: true`, `criticalOverlapPx: 0`) whenever low action occupies the bottom third.
4. **Strict speech-synced timing — never linger past speech end.** `buildSubtitlesFromLineTimings` and `buildCinemaSubtitles` cap every cue's `end` at `<= item.end` (measured speech end) and keep sequential cues strictly non-overlapping (`overlapping_cues == 0`).
5. **Borderless cinema typography & warm sand-gold emphasis (`accent_words`).** Render floating borderless white text (`#f4f7fb` / `#ffffff`) with a crisp multi-pass dark drop-shadow (zero rectangular pill border, zero underline bars) and warm sand-gold (`#dfba78`) `accent_words`.

## Practical Workflow

1. **Write concise spoken sentences (`<= 18` words per `dialogue[]` entry).** Shorter sentences produce cleaner 1–2 line subtitle cues and crisper TTS breath phrasing.
2. **Verify timing alignment.** After a voiced render, run `python3 tools/subtitle_check.py <work_dir>` to verify `words_outside_measured_speech == 0`, `script_words_in_order == True`, `overlapping_cues == 0`, and `coverage_percent >= 70.0`.
3. **Verify zero visual overlap.** Inspect `renderEpisodeFrame(...).subtitleLayout` in regression tests (`criticalOverlapPx === 0`) and visually check rendered `16:9` and `9:16` frames.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Subtitle covers character's legs or low prop | Blindly hardcoding bottom `y = 930` | Keep `measureAndPlaceSubtitle` + `recordCharacterScreenObstacles` active so cues relocate to upper safe band when lower frame is occupied |
| Subtitle stays on screen during 2s silent reaction | Adding `+0.2s` post-roll past `item.end` or bridging long pauses | Cap `cueEnd <= lineSpeechEnd` and bridge only intra-line micro-gaps `<= 0.14s` (`episode.js`) |
| Highlight pill crowds adjacent words | Zero extra width budgeted for capsule padding | `measureAndPlaceSubtitle` adds `spaceW * 1.32` + `6 * scale` capsule pad on highlighted words |
| Blurry subtitles in `9:16` Shorts | Drawing subtitles on `1920x1080` canvas before cropping | Draw via `drawNativeScreenSubtitle` directly in `1080x1920` output coordinates |

## Quality Checklist

- [ ] `subtitleLayout.criticalOverlapPx === 0` across all sampled frames in both `16:9` and `9:16`.
- [ ] All subtitle boxes stay strictly inside `layout.margins` with zero clipped characters.
- [ ] Font size stays constant across cues within a format (`28 px` in `16:9`, `38 px` in `9:16`).
- [ ] Subtitles disappear promptly when speech ends and never overlap sequential cues.
- [ ] `tools/subtitle_check.py` returns `"verdict": "PASS"`.

## External References & Attribution

- BBC Subtitle Guidelines (v1.2.3, `https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/`) — balanced two-line grammatical chunking, speech-locked out-times, and speaker-safe repositioning principles (adapted in original code).
- Netflix Timed Text Style Guide (`https://partnerhelp.netflixstudios.com`) — reading speed, line-balance rules, and safe-margin discipline.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — pre-render text measurement (`measuring-text`) and word-highlighted caption concepts (`docs/decisions/ADR-0001-remotion-evaluation.md`).

## Examples

### Subtitles that outlive the speech

The line is removed on a fixed timer instead of the compiled speech end. Bind removal to the real speech end.

## Concrete Engine Recipes

### Measuring and verifying zero-overlap subtitle layout (`render_layout.js`)

```js
const frameInfo = renderEpisodeFrame(ctx, 1080, 1920, compiledEpisode, frameIdx);
if (frameInfo.subtitleLayout) {
  console.assert(frameInfo.subtitleLayout.criticalOverlapPx === 0, 'Subtitle must not overlap subjects');
}
```
