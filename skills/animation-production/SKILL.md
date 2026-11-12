---
name: animation-production
description: "Create, continue, repair, render, inspect and archive a complete animated video with the existing Universal Animation Toolbook renderer."
---

# Skill: animation-production

**Authority:** this is the primary procedure for creating or changing a complete animated video
with the Universal Animation Toolbook. `AGENTS.md` decides when a skill must be activated; this
file explains *how* to do the work once activated. Detailed technical references live in
[`references/`](references/) and in [`docs/architecture/`](../../docs/architecture/).

## Purpose

Produce a complete, publishable animated video — film, voice, subtitles, music, cover, title,
description and record — using the existing renderer, without rediscovering the repository and
without leaving anything half-finished or falsely claimed.

## When to activate

Activate for **any** request that creates, continues, repairs, renders or reviews a video:
"create a new video", "make another one", a title, an idea, a complete script, a reference video,
or a request to animate/storyboard/render/QA a scene. Also activate when a production failure
reveals that the shared system needs a reusable fix. A bare "Create a new video." already
authorises the entire workflow below; do not ask the user to restate the master prompt.

Consult the specialist skills alongside this one:
[`character-design-and-rigging`](../character-design-and-rigging/SKILL.md),
[`stickman-animation`](../stickman-animation/SKILL.md),
[`physical-interactions-and-props`](../physical-interactions-and-props/SKILL.md),
[`animation-principles`](../animation-principles/SKILL.md),
[`cinematic-composition`](../cinematic-composition/SKILL.md),
[`environment-and-asset-continuity`](../environment-and-asset-continuity/SKILL.md),
[`subtitles-and-typography`](../subtitles-and-typography/SKILL.md),
[`animation-scriptwriting`](../animation-scriptwriting/SKILL.md),
[`youtube-storytelling-and-hooks`](../youtube-storytelling-and-hooks/SKILL.md),
[`sound-design`](../sound-design/SKILL.md),
[`animation-quality-assurance`](../animation-quality-assurance/SKILL.md),
[`scriptwriting`](../scriptwriting/SKILL.md),
[`voiceover-audio`](../voiceover-audio/SKILL.md),
[`youtube-research`](../youtube-research/SKILL.md) and
[`production-quality`](../production-quality/SKILL.md). The authoritative activation table is in
[`AGENTS.md`](../../AGENTS.md).

## Inputs

Any one of: a topic, a title, an idea, a reference video, a draft script, a complete script, or a
request to continue or repair an existing `videos/<slug>/` package. Nothing else is required — the
format, voice, palette and gates are decided by policy, not by the user restating them.

What you must *produce* as inputs before authoring: the one-sentence promise (see
[`youtube-packaging`](../youtube-packaging/SKILL.md)) and a validated `episode.json`.

## Non-negotiable invariants

1. `run_studio.py validate` must print `warnings: []` before any render.
2. **Automatic Video Format & Duration Policy:** `< 60.0s` (`00:59` or less) renders natively in Portrait `9:16` (`1080x1920`) for YouTube Shorts; `>= 60.0s` (`01:00` or longer) renders in Landscape `16:9` (`1920x1080`) for YouTube long-form, unless explicitly overridden by the user. Re-evaluate after TTS synthesis if speech duration crosses `60.0s`.
3. Render and **look at** full-resolution stills in every delivered aspect ratio before any full render.
4. Film grain stays off, and the locked near-black minimal studio visual identity (`studio_config.json`) stays consistent across scenes. Never stretch artwork: 16:9 and 9:16 compositions are projected natively in vector space by the engine.
5. `"status": "COMPLETE"` alone is not proof: read `"voiced"`, `"warnings"` and the validation report. `COMPLETE_SILENT` / exit code 3 means no narration was synthesized.
6. Default narrator is Kokoro `am_michael`; `af_bella` is the preferred secondary voice. Never change this default silently.
7. Polish scripts with [`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](../../docs/production/prompts/VOICEOVER_POLISH_PROMPT.md) **byte-for-byte**. Never edit, weaken or replace that file.
8. A completed video is a **publishing package**, not an MP4: `videos/<slug>/<slug>.mp4` + `script.md` + `thumbnail.jpg` + `record.json`, with an entry in `videos/index.json`. Generic names (`final.mp4`, `output.mp4`) are a hard failure in `tools/validate_publishing.py`. Temporary scratch stays in git-ignored `runtime/` (or a per-run `projects/<slug>/` during authoring). Never delete an existing completed video without verified replacement.
9. Report only numbers that came out of a file the run produced. Never claim a visual or audio check that was not performed.
10. Fixes go into the shared engine, skills, templates, tests and docs — not into one video's spec.
11. No channel name, watermark or branding; English narration unless explicitly requested otherwise.

## Implementation references

| Need | File |
| --- | --- |
| The operating manual | [`master_prompt.md`](../../master_prompt.md) |
| Engine modules | [`docs/architecture/ENGINE_MODULES.md`](../../docs/architecture/ENGINE_MODULES.md) |
| Rendering pipeline | [`docs/architecture/RENDERING_PIPELINE.md`](../../docs/architecture/RENDERING_PIPELINE.md) |
| Minimum viable spec | [`universal_toolbook/templates/episode_minimal.json`](../../universal_toolbook/templates/episode_minimal.json) |
| 14 working specs | [`examples/`](../../examples/) |
| The orchestrator CLI | [`universal_toolbook/run_studio.py`](../../universal_toolbook/run_studio.py) |
| Packaging gates | [`youtube-packaging`](../youtube-packaging/SKILL.md) |
| QA gates | [`production-quality`](../production-quality/SKILL.md) |

## 1. Inspect the repository architecture first

Before authoring anything, read in this order:

| # | File | What it establishes |
|---|---|---|
| 1 | [`AGENTS.md`](../../AGENTS.md) | mandatory rules, architecture boundaries, skill activation map |
| 2 | [`README.md`](../../README.md) | what the repository is, install and quick start |
| 3 | [`docs/architecture/SYSTEM_OVERVIEW.md`](../../docs/architecture/SYSTEM_OVERVIEW.md) | one-source-of-truth responsibility map |
| 4 | [`universal_toolbook/README.md`](../../universal_toolbook/README.md) | the self-contained kit: CLI, assets, config, schema |
| 5 | [`universal_toolbook/process/README.md`](../../universal_toolbook/process/README.md) | script → film technical procedure |
| 6 | [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](../../templates/MASTER_VIDEO_PRODUCTION_PROMPT.md) | the only master production prompt |

Then verify the machine, not the documentation:

```bash
python3 universal_toolbook/run_studio.py check
python3 tools/validate_structure.py
python3 tools/validate_specs.py
```

`check` must report `status: OK`. If `kokoro_ready` or `offline_voiceover_ready` is false, follow
[`docs/getting-started/INSTALL.md`](../../docs/getting-started/INSTALL.md) before promising a voiced
render. `tools/validate_structure.py` proves the skills, templates, project archives and runtime
layout are intact. Use [`docs/architecture/DEPENDENCY_MAP.md`](../../docs/architecture/DEPENDENCY_MAP.md)
to see which module owns each responsibility before editing shared code.

## 2. Classify the input and create the project

| Input | Action |
|---|---|
| Only an idea / "find a topic" | research topics, evaluate, choose one, then develop title and concept → [`youtube-research`](../youtube-research/SKILL.md) |
| A title or subject | research *that subject*, preserve intent, improve the title only if meaning is preserved |
| A complete script | polish, preserving meaning and word choices; flag meaning-changing edits instead of making them silently → [`scriptwriting`](../scriptwriting/SKILL.md) |
| A reference video | analyse creative direction, then build an original concept; never reproduce copyrighted scenes, characters or scripts |
| "Another one" | reuse the established system, create a **new** independent project, never touch old files |

Create the folder before production starts:

```bash
python3 scripts/new_project.py video-003-topic --title "Your title" --format "16:9" --runtime "8 min"
```

The script copies the master template into `projects/<slug>/PROMPT.md`, creates the required
artifact headers and the `assets/`, `audio/`, `renders/` directories. **Customise and save
`PROMPT.md` before any scene, asset or audio work.** Record every deviation from it in
`PRODUCTION_LOG.md`. Project archive rules and the authoritative checklist are in
[`templates/VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md`](../../templates/VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md).

## 3. Automatic 20-stage workflow

Run in order; independent research and asset tasks may run in parallel. Never skip a stage
silently — a skipped stage is recorded in `PRODUCTION_LOG.md` with a reason.

1. **Input analysis** — classify the request, format, runtime, aspect and constraints.
2. **Topic research where appropriate** — sources, dates, confidence, competition.
3. **Fact-checking** — every asserted number traces to a high-confidence research row; label `[M]` measured, `[O]` observed, `[P]` predicted.
4. **Title and concept development** — premise, one-sentence thesis, one carried metaphor.
5. **Script preparation / polishing** — see [`scriptwriting`](../scriptwriting/SKILL.md).
6. **Save original and polished scripts** — `SCRIPT_ORIGINAL.md`, `SCRIPT_POLISHED.md`, `SCRIPT_CHANGELOG.md`.
7. **Save the video-specific production prompt** — `PROMPT.md`, derived from the master template, before production.
8. **Storyboard** — `STORYBOARD.md`: per-scene objective, environment, characters, key actions, board/prop, narration segment, SFX, transition.
9. **Character and asset design** — `CHARACTERS.md` and `ASSET_MANIFEST.json`; see [`stickman-animation`](../stickman-animation/SKILL.md).
10. **Scene production** — author `episode.json`; derive `SCENE_PLAN.json` with `python3 tools/make_scene_plan.py projects/<slug>` so the plan cannot drift from the spec.
11. **Animation** — beats, actions, camera shots, boards, transitions, captions (§4–§8 below).
12. **Kokoro voiceover** — `am_michael` default; see [`voiceover-audio`](../voiceover-audio/SKILL.md).
13. **Music and sound effects** — bundled CC catalog, per-act mood, foley, speech ducking.
14. **Synchronization** — speech-locked `cue_on` / `hide_on`, word timings, camera cues.
15. **Complete MP4 rendering** — draft, then master in every delivered aspect.
16. **Video inspection** — extracted frames, mute-legibility, container decode, audio measurements.
17. **Error correction** — root cause, reusable fix, regression check, re-render, verification.
18. **Final export** — `final.mp4`, chapters, reports, QA report, delivery archive.
19. **Project archiving** — all source files, prompts, scripts, assets, audio and reports stay in the project folder; durable copies go to `deliverables/`.
20. **Reusable pipeline improvement** — update the skill, master template, tests and changelog when the production revealed a gap.

Detailed stage-by-stage procedures (including human approval gates and evidence formats) are in
[`docs/production/COMPLETE_WORKFLOW.md`](../../docs/production/COMPLETE_WORKFLOW.md); the concise
agent rules are in `AGENTS.md`. When they disagree about a CLI command, the kit's
[`process/03_RENDER_PIPELINE.md`](../../universal_toolbook/process/03_RENDER_PIPELINE.md) and
`run_studio.py --help` are authoritative for actual flags.

## 4. Define scenes, timing and animation with the real renderer

The Toolbook is **not** a Remotion app. It uses a plain CommonJS 2D-canvas renderer driven by
`universal_toolbook/run_studio.py`. Time is measured in seconds in `episode.json` and converted
to integer frames by `compileEpisode()` in
[`universal_toolbook/engine/episode.js`](../../universal_toolbook/engine/episode.js):

- `fps` comes from `config/studio_config.json` (30 by default).
- Each scene has `duration` (seconds, minimum 1.5), `startSec`, `endSec`, `startFrame`, `endFrame`.
- `renderEpisodeFrame(ctx, w, h, episode, frameIdx)` in `engine/video_renderer.js` computes `globalT = frameIdx / fps` and `ts = clamp(globalT - scene.startSec, 0, scene.duration)`. **Every animated value is a pure function of the frame index.**
- Character motion is `beats[]` with `start`, `end`, `action`, `from_x`/`to_x`, `x`, `facing`, `expression`, `seated`. Actions must be one of the 60 names in `SUPPORTED_ACTIONS` (`engine/motion_library.js`); unknown actions fall back to `idle_stand`.
- Interpolation and easing helpers live in `engine/character_rig.js`: `clamp`, `lerp`, `ease` (smoothstep), `springEase`, `backEase`, `lerpPose`, `skeleton`, `drawFigure`. Use them when extending the engine; do not invent a second animation runtime.
- No scene may rely on a static pose plus a zoom. Every scene needs at least one real action and a visual purpose.

See [`references/frame-based-animation.md`](references/frame-based-animation.md) for the
framework-independent timing principles and their exact Toolbook equivalents, and
[`references/toolbook-renderer-map.md`](references/toolbook-renderer-map.md) for the module and
schema field map. The complete schema is
[`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](../../universal_toolbook/01_TOOLBOOK_REFERENCE.md).

## 5. Consistent characters and camera movement

- `episode.json` → `cast` is the single source of truth. `CHARACTERS.md` mirrors it; never maintain two different designs.
- Hard constraint: **at most two characters in a scene**.
- Choose `style: "cel"` or parchment/ink-stick; give each cast member a distinct `build`, `hair`, `hair_color`, `shoe_color`, `posture`, `scale` and accessories. See [`stickman-animation`](../stickman-animation/SKILL.md).
- Camera work uses `camera` (slow drift: `zoom_from`, `zoom_to`, `pan_from`, `pan_to`, `focus_x`, `focus_y`, `move_dur`) and `camera_shots[]` (cuts: `start`, `cue_on`, `zoom_from`, `zoom_to`, `focus_x`, `focus_y`, `move_dur`, `cut`, `blend_sec`).
- Prefer multi-word `cue_on` phrases so `engine/voice_engine.py` can lock a push or cut to the spoken beat (`align_scene_cameras_to_speech`). Verify with stills/draft frames at `cue + ~1.6 s`.
- Portrait delivery is reframed by `engine/portrait_framing.js`; do not hand-author `portrait_focus` / `portrait_focus_x` unless a specific draft frame proves a framing defect (KI-009). Boards are fitted to the safe crop by `fitBoardToPortraitViewport`.

## 6. Transitions

The renderer supports: automatic 0.32 s fade-in / 0.28 s fade-out when adjacent scenes change
environment, `fade_to_black`, `cut_to_black_at`, `wind_blackout_at`, `flashback_window`,
`split_screen`, `intertitle`, `end_card`, chapter ribbons and `outro`. Scene cuts are also
expressed through `camera_shots[].cut`. There is **no** generic cross-dissolve or transition
package; if a story needs one, add the primitive to `engine/video_renderer.js` reusably with a
regression test, never fake it per-video. Transition grammar is in
[`universal_toolbook/process/04_VISUAL_GEOMETRY.md`](../../universal_toolbook/process/04_VISUAL_GEOMETRY.md).

## 7. Audio/visual synchronization and captions

- Voice, BGM and foley are built by Python (`engine/voice_engine.py`, `engine/audio_mixer.py`, `engine/bgm_library.py`, `tts/`). The renderer receives a **retimed** episode: actual speech durations, `line_timings` and `word_timings`.
- Boards use `cue_on`, `hide_on`, `hold_sec`, `build_dur`; camera shots use `cue_on` / `end_on`. `align_scene_board_to_speech()` resolves multi-word phrases against real word times — avoid short stopwords as cues.
- `accent_words` drives glowing multi-word subtitle highlights; `line_timings` drives speaker pills and subtitles; `subtitles_mode` is `cinema` or `off`. Subtitles are burned in. SRT/VTT export is *not* implemented (roadmap F4 in [`docs/development/ROADMAP.md`](../../docs/development/ROADMAP.md)); do not claim it exists.
- Foley comes from `sfx[]` and generated sound events (footsteps, chapter chimes, board cues). Ducking, loudness normalisation and CC attribution are engine responsibilities.
- See [`voiceover-audio`](../voiceover-audio/SKILL.md) and
[`docs/production/AUDIO_VISUAL_SYNCHRONIZATION.md`](../../docs/production/AUDIO_VISUAL_SYNCHRONIZATION.md).

## 8. Render, validate and inspect

```bash
python3 universal_toolbook/run_studio.py validate projects/<slug>/episode.json
python3 universal_toolbook/run_studio.py stills projects/<slug>/episode.json \
    --out-dir runtime/previews/<slug> --width 1920 --height 1080
python3 universal_toolbook/run_studio.py render projects/<slug>/episode.json \
    --out runtime/renders/<slug>/draft.mp4 --draft --voice auto --workers 2 --chunk-sec 20
python3 universal_toolbook/run_studio.py render projects/<slug>/episode.json \
    --out projects/<slug>/final.mp4 --full --preset veryfast --crf 24 \
    --chunk-sec 45 --workers 2 --resume --voice auto
python3 tools/produce_video.py projects/<slug>       # ordered gates A–I, measurements, QA frames
```

`--voice none` is only for a deliberately silent smoke test. `--short-form` gates 40–90 s;
`--shorts` selects 9:16 and allows up to 180 s. After every render read the `*_report.json`,
`*_validation_report.json` and `*_visual_audio_cues.json` files written beside the MP4. Follow
[`production-quality`](../production-quality/SKILL.md) for the full QA gate: full decode,
dimensions/fps/streams, ≥6 inspected frames, no black sections, measured peak/RMS, mute
legibility and `QA_REPORT.md`.

## 9. Troubleshoot and recover

Use [`docs/troubleshooting/INDEX.md`](../../docs/troubleshooting/INDEX.md) first, then
[`docs/production/KNOWN_ISSUES.md`](../../docs/production/KNOWN_ISSUES.md),
[`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md)
and [`docs/production/TTS_TROUBLESHOOTING.md`](../../docs/production/TTS_TROUBLESHOOTING.md).
For every failure: record stage and exact error in `PRODUCTION_LOG.md`, reproduce, find the root
cause, fix it **reusably**, add a regression test or validation rule, update the affected skill /
template / doc, then retry and verify. Never retry endlessly, never work around a failure without
understanding it, and never claim a fix without evidence.

## 10. Update the shared system

When a production exposes a missing instruction or a repeated defect, update exactly one
authoritative location: this skill for procedure, `AGENTS.md` for rules,
`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` for per-video prompt structure,
`universal_toolbook/` for engine behaviour, `docs/architecture/` for architecture,
`docs/production/` for detailed stage docs, `tests/` for regression protection, and
`CHANGELOG.md` for the change record. Do not create a second copy of a rule inside a project.
Record the change in `PIPELINE_CHANGELOG.md` and add a test under `tests/production/` or
`tests/unit/`.

## Rules

- Never invent a CLI flag, module responsibility or path. Verify with `--help` and `ls`.
- Never describe planned functionality as available.
- Never claim a gate passed without running it, or a frame was inspected without looking at it.
- Never delete the only copy of a video, script or asset.
- Never crop a landscape composition into portrait; re-stage the shot.
- The polish standard is applied as it exists, never paraphrased.
- One run, one voice: `am_michael` unless explicitly overridden.
- Report measured, observed and predicted separately.

## Common mistakes

| Mistake | Why it fails |
| --- | --- |
| Rendering before `validate` prints `warnings: []` | A spec error costs a full render to discover |
| Skipping stills because "the draft will show it" | Stills cost seconds; the draft costs minutes |
| Trusting `status: COMPLETE` | It says nothing about `voiced` or the validation report |
| Filing an MP4 as `final.mp4` | `validate_publishing.py` fails it; the package needs a slug-named master |
| Guessing at a duration instead of reading it from the render | The format boundary is 60.0 s exactly and is not negotiable by feel |
| Patching one video's spec to fix a shared bug | The next video has the same bug |
| Writing the packaging after the render | The hook and title shape the script, not the reverse |
| Authoring `chapter` as an object | `chapter` is the string `"Label \| Title"`; the compiler prints `String(chapter)`, so an object ships `[object Object]` into the ribbon **and** the chapters file. `run_studio.py validate` does not catch it — `validate_specs.py` does (KI-021). Chapters come from scene strings only; a top-level `chapters[]` array is never read (KI-022) |
| Picking a backdrop by name without looking at it | Some parchment backdrops hard-code furniture at fixed screen coordinates for a specific earlier film (a chair at x≈1225 in `parchment_studio`). Under a tighter camera it floats mid-frame. Look at a still before committing a scene to a backdrop |
| Letting the cover repeat a number the title already carries | `thumbnail_copy.py` fails it, and it is right: one surface is wasted. If the title says the number, the cover shows the mechanism the title does not name |
| Building a cover by cropping a frame that fights the film's palette | `thumbnail_style.py` scores it (floor 0.62). A card-dominant crop on a warm ground scored 0.515; the same film's fuller frame scored 0.835 with no change to the type |
| Placing boards and actors in separate bands without checking who occludes whom | A figure's head can cover the one square the viewer must be able to count. Compose the proof object first, then put actors where they cannot cover it |

## Quality checklist

- [ ] Promise written and packaging recorded in `record.json` before the script was final
- [ ] `run_studio.py validate` prints `warnings: []`
- [ ] Stills rendered in every delivered aspect and actually inspected
- [ ] Draft inspected at each board cue and camera cut
- [ ] Master reports `voiced: true`, correct aspect, 30 fps, expected frame count
- [ ] Chapters read as real titles in the `_chapters.txt`, not `[object Object]` (KI-021)
- [ ] Format obeys the 60.0 s policy or carries a recorded exception
- [ ] Subtitles inside safe regions, removed at real speech end
- [ ] Audio within the measured band, narration above music
- [ ] Package complete: `<slug>.mp4`, `script.md`, `thumbnail.jpg`, `record.json`, index entry
- [ ] All creative and publishing gates pass
- [ ] A human has looked at the film and the cover together

## Examples

### "Create a new video." — the bare request

No topic, no script, no format. This authorises the full workflow: classify the intake, research a
topic, evaluate candidates, propose ideas, and stop at the user-selection gate. It does not authorise
skipping the gate and picking a topic unilaterally.

### A portrait film that ran long

Script planned at 52 s (portrait), the speech-locked render came out at 61.4 s. The format policy is
re-evaluated after synthesis: either cut ~2 s of narration to stay portrait, or accept landscape
deliberately and record why. What must not happen is shipping portrait at 61 s with no record of the
decision — that is what the approved-exception list in `master_prompt.md` §5 exists to prevent.

## Remotion knowledge — evaluated, not adopted

Remotion is a React-based programmatic video framework. Its **framework-independent** ideas
(frame-driven animation, interpolation, easing, sequencing, composition metadata, asset timing,
caption timing) are adapted to this renderer in
[`references/frame-based-animation.md`](references/frame-based-animation.md). Its **framework-specific**
APIs are documented, clearly labelled and quarantined in
[`references/remotion-techniques.md`](references/remotion-techniques.md). The technical evaluation
and decision are recorded in
[`docs/decisions/ADR-0001-remotion-evaluation.md`](../../docs/decisions/ADR-0001-remotion-evaluation.md):
**Remotion, React, Three.js, Lottie and Tailwind are not dependencies of this repository and were
not adopted.** Do not add them without a tested evaluation that demonstrates a real benefit.

## Source attribution and licence notice

Framework concepts are attributed to the Remotion documentation and the `remotion-dev/skills`
repository. See [`references/ATTRIBUTION.md`](references/ATTRIBUTION.md) for the licence
verification performed on 2026-11-09. No upstream source text or code was copied into this
repository; the material here is an original adaptation written for the Toolbook's renderer.
Bundled audio and third-party runtime components retain their own licences — see
[`universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md`](../../universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md)
and [`docs/production/TTS_BENCHMARK.md`](../../docs/production/TTS_BENCHMARK.md).
