---
name: production-quality
description: "Validate specs, inspect stills and rendered MP4s, measure audio, write QA reports and determine whether a video is ready to export."
---

# Skill: production-quality

## Purpose

Decide, with evidence, whether a video is finished — and refuse to call it finished on the strength
of a passing encode. Every gate below answers a question a render report cannot.

## When to use

**Activate when:** validating a spec, reviewing stills or a draft, inspecting a rendered MP4,
measuring audio, writing `QA_REPORT.md`, interpreting a validation report, deciding whether a
video is finished, or diagnosing a render/QA failure. Always activate alongside
[`animation-production`](../animation-production/SKILL.md) for a video request.

**Authority:** [`docs/production/QUALITY_CONTROL.md`](../../docs/production/QUALITY_CONTROL.md)
(stage 12), [`universal_toolbook/process/06_QA_GATE.md`](../../universal_toolbook/process/06_QA_GATE.md)
(toolbook QA gate) and [`docs/troubleshooting/INDEX.md`](../../docs/troubleshooting/INDEX.md)
(verified failures). Automated enforcement lives in `tests/production/`,
`tests/unit/` and `tools/validate_structure.py`.

## Inputs

A finished package directory and the gates that have already passed. Quality assessment needs
something to assess, so there is no QA of a plan — run the gates against artifacts.

## Workflow — the gates, in order

1. **Spec gate.** `python3 universal_toolbook/run_studio.py validate projects/<slug>/episode.json`
   must print `warnings: []`. For verbatim scripts also require `exact_word_match: true`.
2. **Stills gate.** Render full-resolution stills in every delivered aspect
   (`--width 1920 --height 1080`, `--width 1080 --height 1920`) and **look at every PNG**:
   anatomy, occlusion, subtitle/board collisions, name tags, clipped limbs, safe areas.
3. **Draft gate.** Draft render with real voice timings. Inspect a frame at every board cue
   (`cue_on + ~1.6 s`) and camera cut; stills do not include TTS timings (KI-003). Check subtitle
   speaker labels, multi-word highlight and board build.
4. **Master gate.** `*_report.json` must show `voiced: true`, `warnings: []`, expected aspect,
   `film_grain: false`, 30 fps and the expected frame count. `COMPLETE_SILENT` / exit 3 is a
   failure, not a delivery. Read `*_validation_report.json` for `dimensions_match_aspect`.
5. **Decode gate.** `ffmpeg -v error -i final.mp4 -f null -` exits clean. Probe dimensions, fps,
   duration and exactly one video + one audio stream.
6. **Visual gate.** Extract ≥6 frames across the whole timeline, actually look at them, and
   record findings in `QA_REPORT.md`. No black-screen sections: sampled frames must be non-uniform.
   Mute-legibility: the frame sequence must tell the story without audio.
7. **Audio gate.** Measure the mixed WAV: peak −3…−1 dBFS, RMS −16…−19 dBFS, no unintended
   interior silence, narration clearly above music. Never ship on peak alone.
8. **Repository gate.** `python3 tools/validate_structure.py`,
   `python3 tools/check_docs.py`, `python3 tools/validate_specs.py`,
   `node tests/regression/run_all_tests.js`,
   `python3 tests/integration/test_studio_pipeline.py`,
   `python3 -m pytest tests/unit tests/production -q`.
9. **Sign-off.** `QA_REPORT.md` lists every gate, the file each number came from, inspected frame
   paths and any remaining limitation. `PRODUCTION_LOG.md` records deviations and skipped stages.

## Rules

- Report only numbers that came out of a file this run produced. No estimated duration, loudness
  or frame count.
- **Never claim a visual or audio check passed if it was not performed.** A successful encode is not
  a review.
- Do not edit a report by hand; copy it from the render output.
- A silent render is acceptable only when explicitly requested with `--voice none` for a smoke
  test, and must be labelled `voiced: false`.
- Never overwrite an existing master; use a new filename and say which one you used.
- Look at many frames, not the first and the last.

## Common mistakes

| Mistake | Why it fails |
| --- | --- |
| Treating `COMPLETE_SILENT` as a delivery | Exit 3 means no voice was synthesized |
| Inspecting only the first and last frame | Props that jump between scenes are invisible at the endpoints |
| Checking stills for subtitle collisions | Stills have no TTS timings, so the collision only exists in the master |
| Reporting a gate from memory of a previous run | The number must come from a file this run wrote |
| Shipping on peak level alone | Peak −1 dBFS with RMS −25 dBFS is quiet and still "passes" |
| Calling a gate score a quality score | Gates prove the process ran; taste is the last checklist item |

## Quality checklist

- [ ] Spec validates with `warnings: []` (and `exact_word_match: true` where required)
- [ ] Stills rendered in every delivered aspect and actually looked at
- [ ] Draft inspected at each board cue and camera cut
- [ ] Master report shows `voiced: true`, correct aspect, 30 fps, expected frame count
- [ ] Decode runs clean; exactly one video and one audio stream
- [ ] ≥6 frames across the timeline extracted and inspected
- [ ] Audio measured: peak −3…−1 dBFS, RMS −16…−19 dBFS, no unintended silence
- [ ] Repository gates green (`validate_structure`, `check_docs`, `validate_specs`, tests)
- [ ] `QA_REPORT.md` lists every gate with the file each number came from
- [ ] A human has looked at the finished film and the cover together

## Implementation references

| Need | File |
| --- | --- |
| QA procedure and stage 12 | [`docs/production/QUALITY_CONTROL.md`](../../docs/production/QUALITY_CONTROL.md) |
| Toolbook QA gate | [`universal_toolbook/process/06_QA_GATE.md`](../../universal_toolbook/process/06_QA_GATE.md) |
| Verified failures | [`docs/troubleshooting/INDEX.md`](../../docs/troubleshooting/INDEX.md) |
| Known defects | [`docs/production/KNOWN_ISSUES.md`](../../docs/production/KNOWN_ISSUES.md) |
| Ordered gate runner | [`tools/produce_video.py`](../../tools/produce_video.py) |
| Audio measurement | [`tools/mix_probe.py`](../../tools/mix_probe.py) |
| Subtitle sync | [`tools/subtitle_check.py`](../../tools/subtitle_check.py) |
| Creative gates | [`youtube-packaging`](../youtube-packaging/SKILL.md) |

## Evidence rules

- Report only numbers that came out of a file the run produced. No estimated duration, loudness or
  frame count.
- **Never claim a visual or audio check passed if it was not performed.** A successful encode is
  not a review.
- Do not edit a report by hand; copy it from the render output.
- A silent render is only acceptable when explicitly requested with `--voice none` for a smoke
  test, and must be labelled `voiced: false`.
- Never overwrite an existing master; use a new filename and state it.

## Failure loop

1. Record the error, stage, command and report path in `PRODUCTION_LOG.md`.
2. Reproduce where possible; consult `KNOWN_ISSUES.md` / `LESSONS_LEARNED.md` first.
3. Find the root cause, fix it **reusably** in the engine, skill, template or docs.
4. Add a regression test or validation rule; update `PIPELINE_CHANGELOG.md` and `CHANGELOG.md`.
5. Re-run the failed gate and every dependent gate; verify with fresh output files.
6. Never retry endlessly, never hide a recurring problem, never claim resolution without evidence.

Useful tools: [`tools/produce_video.py`](../../tools/produce_video.py) (ordered gates A–I and
`qa_measurements.json`), `tools/audio_report.py`, `tools/mix_probe.py`,
`tools/subtitle_check.py`, `tools/validate_specs.py`.

## Examples

### A package that passes every gate and is still not ready

The thumbnail was never looked at on a phone. Gates prove process, not quality — that judgement is
the last item on the checklist for a reason.

### The subtitle collision that only existed in the master

Stills were clean, `warnings: []`, and every gate green. The master showed a subtitle row crossing a
character's hand for eleven frames, because stills are rendered without TTS timings. The fix is
procedural: inspect the draft at `cue_on + ~1.6 s`, not just the stills.

