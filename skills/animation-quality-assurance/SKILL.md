---
name: animation-quality-assurance
description: "Execute automated geometric/layout/audio assertions AND mandatory visual frame-by-frame inspection across all 17 regression scenarios, format boundaries, subtitles, and final MP4 renders."
---

# Skill: animation-quality-assurance

## Purpose

Prevent visual, anatomical, interaction, continuity, composition, subtitle, format, or audio defects from ever shipping. Combines deterministic automated regression checks (`tests/regression/run_all_tests.js`, `tests/regression/visual_regression_suite.js`, `pytest`, `tools/subtitle_check.py`) with **mandatory human/agent visual inspection of actual rendered PNG frames and MP4 video streams**. Works alongside [`production-quality`](../production-quality/SKILL.md).

## Trigger Conditions

## Inputs

A rendered master or still set, the `episode.json` that produced it, and the record of which scenarios the change could affect. The regression suite itself is the fixture.

Activate whenever:
- verifying any engine, rig, prop, environment, layout, subtitle, format-policy, or audio change,
- running pre-delivery QA on a demonstration or production video (`9:16` or `16:9`),
- adding new actions, props, or scenes that require regression coverage,
- investigating any visual defect before declaring work complete.

## Core Rules & Non-Negotiable Constraints

1. **Never claim a render passed QA without rendering and visually inspecting actual frames.** Exit code `0` and `"status": "COMPLETE"` are necessary but **never sufficient**. Extract and view real PNG frames across key action beats, transitions, and subtitle cues.
2. **Enforce hard mathematical invariants on every frame.**
   - Bone length drift: `< 1e-4 px` across all `BONES` and all 70 `SUPPORTED_ACTIONS`.
   - Stance foot slip: `< 1e-6 px` during planted gait phases.
   - Character colour unity: 100% uniform base colour (`CANONICAL_CHARACTER_SPEC.singleColorBody === true` and `uniformLimbFill === true`).
   - Subtitle collisions: `subtitleLayout.criticalOverlapPx === 0` and strict containment inside `layout.margins`.
   - Subtitle speech cutoff: zero words outside speech intervals, `overlapping_cues === 0`, cue `end <= lineSpeechEnd`.
   - Format policy: `< 60.0s -> 9:16 (1080x1920)`, `>= 60.0s -> 16:9 (1920x1080)`, `dimensions_match_aspect === true`.
3. **Maintain all 17 controlled visual regression scenarios.** `tests/regression/visual_regression_suite.js` must test and verify:
   (1) neutral standing, (2) walking, (3) running, (4) sitting on chair, (5) reaching for phone, (6) picking up phone, (7) holding phone, (8) scrolling phone, (9) typing on phone, (10) putting down phone, (11) table interaction, (12) door interaction, (13) multi-character scene, (14) camera transition scene, (15) subtitle-heavy scene with active animation, (16) `16:9` landscape subtitle test, and (17) `9:16` vertical Shorts subtitle test — plus format boundary (`59s` vs `60s` vs override) tests.
4. **Fix root causes centrally.** When visual inspection catches a defect (clipped header, straight locked arm, subtitle overlap, prop duplicate), fix the shared engine module and add a permanent regression assertion.

## Practical Workflow

1. **Run fast engine & spec checks.**
   ```bash
   node tests/regression/run_all_tests.js
   node tests/regression/visual_regression_suite.js
   python3 tools/validate_specs.py
   ```
2. **Visually inspect rendered contact sheets.** Open the generated contact-sheet PNGs in `runtime/previews/` and check joint bends, hand-to-prop contact, single-instance parent switching, background restraint, header clearance, and subtitle placement.
3. **Decode and probe full MP4 deliverables.** Verify container streams (`ffprobe` / `ffmpeg -v error -i <mp4> -f null -`), verify `voiced: true`, check `tools/subtitle_check.py`, extract >= 8 frames across the timeline into `runtime/previews/`, and inspect every extracted frame.
4. **Run repository & fresh-checkout gates.**
   ```bash
   python3 tools/validate_structure.py
   python3 tools/check_docs.py
   python3 tools/check_workflows.py
   python3 -m pytest -q
   ```

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Subtle UI clipping in `9:16` missed by unit tests | Unit test only checked `16:9` or returned metadata | Render `1080x1920` PNG sheet in `visual_regression_suite.js` and assert pixel/rect bounds + inspect image |
| Stale `.work_*` chunks reused after spec edit | `--resume` found old chunk files | Clear `.work_*` (or let `tools/produce_video.py` hash-invalidate cache) before re-rendering |
| Temporary QA PNGs dirtied git tree | Previews written outside `runtime/` | Always write scratch previews and extracted frames under git-ignored `runtime/previews/` |

## Quality Checklist

- [ ] `node tests/regression/run_all_tests.js` and `node tests/regression/visual_regression_suite.js` pass 100%.
- [ ] Contact sheets covering all 17 regression scenarios rendered to `runtime/previews/` and visually inspected.
- [ ] Both `9:16` (`1080x1920`) and `16:9` (`1920x1080`) deliverables decoded cleanly with `0` ffmpeg errors.
- [ ] Extracted MP4 frames inspected for character colour unity, seamless joints, prop contact, calm near-black stage, and collision-free subtitles.
- [ ] `validate_structure.py`, `check_docs.py`, `check_workflows.py`, and `pytest` all pass with exit code `0`.

## External References & Attribution

- Meszaros, G. (2007), *xUnit Test Patterns* — deterministic fixture isolation and invariant-driven regression suites.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — frame extraction, decode verification, and dimension/duration probing concepts adapted to FFmpeg + Node canvas (`docs/decisions/ADR-0001-remotion-evaluation.md`).
- Internal studio authority: `skills/production-quality/SKILL.md` and `scripts/verify_fresh_checkout.py`.

## Examples

### A portrait film that looks fine until you see the crop

Every gate passes, then the stills show a board clipped at the right edge because the composition was measured at 16:9. Fix the layout, not the stills grid.

## Concrete Engine Recipes

### Extracting an 8-frame inspection grid from a rendered MP4 (`bash`)

```bash
python3 -c "
import subprocess, imageio_ffmpeg
ff = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([
    ff, '-y', '-i', 'videos/video-005/final.mp4',
    '-vf', 'fps=1/5,scale=540:-1,tile=4x2',
    '-frames:v', '1', 'runtime/previews/video_005_qa_grid.png'
], check=True)
"
```
