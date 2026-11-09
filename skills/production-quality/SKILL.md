---
name: production-quality
description: "Validate specs, inspect stills and rendered MP4s, measure audio, write QA reports and determine whether a video is ready to export."
---

# Skill: production-quality

**Activate when:** validating a spec, reviewing stills or a draft, inspecting a rendered MP4,
measuring audio, writing `QA_REPORT.md`, interpreting a validation report, deciding whether a
video is finished, or diagnosing a render/QA failure. Always activate alongside
[`animation-production`](../animation-production/SKILL.md) for a video request.

**Authority:** [`docs/production/QUALITY_CONTROL.md`](../../docs/production/QUALITY_CONTROL.md)
(stage 12), [`universal_toolbook/process/06_QA_GATE.md`](../../universal_toolbook/process/06_QA_GATE.md)
(toolbook QA gate) and [`docs/troubleshooting/INDEX.md`](../../docs/troubleshooting/INDEX.md)
(verified failures). Automated enforcement lives in `tests/production/`,
`tests/unit/` and `tools/validate_structure.py`.

## Gates, in order

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
