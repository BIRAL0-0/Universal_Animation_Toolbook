# Baseline inventory, dependency map and responsibility map

**Recorded:** 2026-11-09, before any restructuring, on branch
`arena/c7c9d20d-universal-animation-toolbook` at `abedd59`. This is the evidence snapshot the
reorganization is based on. It is intentionally kept as a historical record; the current
architecture is documented in [`SYSTEM_OVERVIEW.md`](SYSTEM_OVERVIEW.md) and
[`DEPENDENCY_MAP.md`](DEPENDENCY_MAP.md).

## 1. Repository at baseline

| Measure | Value | How it was measured |
|---|---|---|
| Tracked files | 263 | `git ls-files \| wc -l` |
| Regular files on disk | 261 | `find . -path ./.git -prune -o -type f -print` |
| Difference | 2 symlinks in `downloads/` | `downloads/the_wall_you_agreed_with_1080x1920.mp4` and `.zip` are symlinks, not regular files |
| Markdown | 75 files / 8,815 lines | `git ls-files '*.md' \| xargs wc -l` |
| Python + JavaScript | 43 `.py` + 15 `.js` = 24,682 lines | `git ls-files '*.py' '*.js' \| xargs wc -l` |
| Media / archives tracked | 37 PNG, 26 MP3, 6 MP4, 5 ZIP, 1 WAV, 1 M4A, 2 TTF, 1 SVG | `git ls-files` by extension |
| Repository size | 249 MB | `du -sh --exclude=.git .` |
| Working tree | clean | `git status --porcelain=v1` was empty |
| Branches | local `main`, working branch `arena/c7c9d20d-universal-animation-toolbook` | `git branch -a` |
| CI | one workflow, 4 jobs, 28 steps | `.github/workflows/verify.yml` |
| Version | 3.0.0 | `universal_toolbook/package.json` |

Two tracked symlinks were already broken at baseline:
`downloads/the_wall_you_agreed_with_1080x1920.mp4` pointed at a directory that does not exist,
and the `.zip` symlink pointed at `outputs/the_wall_you_agreed_with_1080x1920.zip`. The MP4
target is absent from the repository.

## 2. Baseline test results (all recorded before edits)

Environment prepared with a local venv (`.venv`, ignored), `pip install -r
universal_toolbook/requirements.txt pytest pyyaml` and `npm install --prefix universal_toolbook`.
System `ffmpeg` is absent; `imageio-ffmpeg` supplies the binary. Kokoro weights are **not**
installed, so `check` reported `kokoro_ready: false` and `offline_voiceover_ready: false`.

| Command | Result |
|---|---|
| `python universal_toolbook/run_studio.py check` | exit 0, `status: OK`, 7 BGM tracks, 60/60 smoke frames |
| `python tools/check_docs.py --verbose` | exit 0, all path claims resolved |
| `python tools/check_workflows.py` | exit 0, 1 workflow / 4 jobs / 28 steps |
| `python tools/validate_specs.py` | exit 0, 11/11 specs valid, `warnings: []` |
| `node tests/run_all_tests.js` | exit 0, `js_tests: PASSED`, 60 actions, 7 builds, 12 hairstyles, 12 presets, 0 px drift |
| `python tests/test_studio_pipeline.py` | exit 0, `py_tests: PASSED` (BGM, silence compaction, speech-locked boards/camera, exact-word fidelity) |
| `python -m pytest tests/production -q` | exit 0, **22 passed** |
| Silent draft render (`--voice none --draft --chunk-sec 20`) | exit 0, `status: COMPLETE`, 24 s, 960×540, 720 frames, 30 fps, `film_grain: false`, `warnings: []`, `voiced: false`, valid validation report |

The baseline render was deliberately silent. No voiced render, no subjective visual review and no
audio listening test were performed for this baseline snapshot.

## 3. Runtime dependency map (measured from imports and `require()`)

### 3.1 Entry points

| Entry point | Kind | Responsibility | Depends on |
|---|---|---|---|
| `universal_toolbook/run_studio.py` | CLI (primary) | `check`, `validate`, `stills`, `render`, `bgm-list`, `player`; orchestrates JS renderer + Python audio | `engine.voice_engine`, `engine.audio_mixer`, `engine.bgm_library`, `tools.script_helper`, `engine/episode.js` via `node`, `config/studio_config.json`, `assets/`, `templates/` |
| `universal_toolbook/generate_voiceover.py` | CLI | standalone resumable Kokoro/Piper/Edge narration job | `tts/` package, `tts/config/voices.json` |
| `universal_toolbook/process_audio.py`, `validate_audio.py` | CLI | TTS audio processing + validation | `tts/` package |
| `universal_toolbook/setup_tts.py` | CLI | download pinned Kokoro weights/voices, Piper fallback voices, verify | `tts/`, `tools/convert_kokoro_v1_voices.py`, `tools/fetch_piper_voices.py`, `cache/tts/` (ignored) |
| `universal_toolbook/tools/*.py` | helpers | script segmentation, voice fetch, benchmark, storyboard SVG, deliverable server | `engine.bgm_library`, `tts/`, `engine.voice_engine` |
| `tools/produce_video.py` | repo-level orchestrator | runs the ordered validate → stills → draft → master → measure → frames → verify gates for a project | `run_studio.py`, `imageio-ffmpeg`, project `episode.json` |
| `tools/validate_specs.py`, `check_docs.py`, `check_workflows.py`, `audio_report.py`, `mix_probe.py`, `subtitle_check.py` | dev/QA tools | repository and render validation | `run_studio.py`, `engine.audio_mixer`, `engine.bgm_library`, `PyYAML` |
| `tests/run_all_tests.js`, `tests/test_studio_pipeline.py`, `tests/production/` | tests | engine regression and production hygiene | `universal_toolbook/engine/*`, `universal_toolbook/run_studio.py`, `tools/check_docs.py` |

### 3.2 JavaScript renderer graph (all paths inside `universal_toolbook/engine/`)

```
run_studio.py --(node)--> video_renderer.js
video_renderer.js
  ├── canvas_backend.js ──> node-canvas | @napi-rs/canvas (npm optionalDependencies)
  ├── font.js ──> canvas_backend.js + assets/Poppins-*.ttf
  ├── episode.js ──> character_rig.js, environments.js, motion_library.js,
  │                  world_props_and_boards.js
  ├── character_rig.js (BONES, skeleton, lerpPose, springEase, drawFigure, clamp/lerp/ease)
  ├── motion_library.js ──> character_rig.js (SUPPORTED_ACTIONS, evaluateCharacterState)
  ├── environments.js ──> character_rig.js
  ├── world_props_and_boards.js ──> character_rig.js, environments.js,
  │                                beacon_harbor.js, impossible_wall.js
  ├── parchment_ink_style.js ──> canvas_backend.js, character_rig.js,
  │                              beacon_harbor.js, impossible_wall.js
  ├── portrait_framing.js ──> motion_library.js, character_rig.js
  ├── render_layout.js, impossible_wall.js
  └── config/studio_config.json + assets/bgm/ (read through Python, not JS)
```

`tests/run_all_tests.js` imports 9 of those modules by relative path. `tools/make_poster.js`
imports `canvas_backend.js` and `font.js`. There are **no** React, Remotion, Three.js, Lottie,
Tailwind or bundler dependencies in `package.json`; the JS renderer is plain CommonJS drawing to
a 2D canvas and piping raw frames to ffmpeg.

### 3.3 Python graph (all paths relative to `universal_toolbook/`)

```
run_studio.py ──> engine/voice_engine.py ──> tts/providers/* (lazy), tts/audio.py
               ├─> engine/audio_mixer.py ──> engine/bgm_library.py ──> assets/bgm/BGM_CATALOG.json
               ├─> engine/voice_engine.get_ffmpeg_exe ──> imageio-ffmpeg binary
               └─> tools/script_helper.py ──> engine/bgm_library.py
generate_voiceover.py ──> tts/__init__.py, tts/audio.py, tts/manifest.py, tts/segment.py,
                          tts/config.py ──> tts/config/voices.json, pronunciation_dictionary.json
setup_tts.py ──> tools/convert_kokoro_v1_voices.py, tts/providers, cache/tts/ (ignored)
voices config: tts/config/voices.json → default_engine=kokoro, default_voice=am_michael,
              secondary_voices=[af_bella, am_adam, af_sky]
engine config: config/studio_config.json → fps=30, 1920×1080, film_grain=false,
              voice_default=am_michael, channel_name=""
```

External runtime dependencies: `numpy`, `imageio-ffmpeg`, `edge-tts` (Python);
optional `piper-tts`, `kokoro-onnx` (downloaded by `setup_tts.py`); `@napi-rs/canvas` or
`canvas` (Node); `ffmpeg` binary from `imageio-ffmpeg`. Development: `pytest`, `pyyaml`.

### 3.4 Data flow

```
script / idea
  → projects/<slug>/{PROMPT,RESEARCH,SCRIPT_ORIGINAL,SCRIPT_POLISHED,STORYBOARD,CHARACTERS}.md
  → projects/<slug>/episode.json + SCENE_PLAN.json + ASSET_MANIFEST.json
  → run_studio.py validate / stills
  → engine/episode.js compileEpisode(spec) → frame-indexed scenes, subtitles, boards, cameras
  → tts/ + engine/voice_engine.py → per-line WAVs + word timings + retimed episode
  → engine/audio_mixer.py + bgm_library.py → master WAV (voice, BGM, foley, loudness)
  → engine/video_renderer.js → raw RGBA frames → ffmpeg → final.mp4
  → *_report.json / *_validation_report.json / *_visual_audio_cues.json / chapters.txt
  → QA_REPORT.md, PRODUCTION_LOG.md, deliverables/
```

## 4. Responsibility map (baseline: where the same responsibility was duplicated)

| Responsibility | Authoritative content at baseline | Competing / overlapping copies found |
|---|---|---|
| Agent operating rules | `AGENT_OPERATING_RULES.md` | `START_HERE.md`, `universal_toolbook/process/SESSION_PROMPT.md`, `universal_toolbook/MASTER_PROMPT.md`, `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` |
| Orientation / quick start | `START_HERE.md` + `README.md` | `universal_toolbook/00_START_HERE.md`, `universal_toolbook/README.md`, `universal_toolbook/process/README.md` |
| Architecture / folder map | `universal_toolbook/process/REPO_MAP.md` | root `README.md`, `START_HERE.md`, `docs/production-workflow/INDEX.md`, `TOOLS_AND_MODELS.md` |
| Whole production workflow | `docs/production-workflow/COMPLETE_WORKFLOW.md` + 24 stage docs | `universal_toolbook/process/01..08`, `AGENT_OPERATING_RULES.md` §1.2, master template §0–13 |
| Script polish standard (immutable) | `docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md` (SHA-256 `aeef0850…`) | references from 11 files; no competing copy of the text (kept intact) |
| Change logs | `docs/production/PIPELINE_CHANGELOG.md`, `docs/production-workflow/WORKFLOW_CHANGELOG.md` | no root `CHANGELOG.md` |
| Troubleshooting | `universal_toolbook/process/07_TROUBLESHOOTING.md`, `docs/production-workflow/TROUBLESHOOTING.md`, `TTS_TROUBLESHOOTING.md`, `docs/production/KNOWN_ISSUES.md` | overlapping symptom tables |
| Configuration | `universal_toolbook/config/studio_config.json`, `universal_toolbook/tts/config/voices.json`, `pronunciation_dictionary.json` | documented in 3 setup docs; no duplicate config files |
| Voice defaults | `tts/config/voices.json` + `config/studio_config.json` (both `am_michael`) | prose in master prompt, AGENT rules, docs; no conflicting value |
| Assets | `universal_toolbook/assets/` (fonts, 7 BGM MP3s, catalog, licenses) | `projects/*/assets/` are per-video evidence, not duplicates |
| Deliverables | `outputs/` (text results, sample MP4, ZIPs, TTS benchmark), `deliverables/` (TTS source ZIP), `projects/*/final.mp4` and release ZIP, `downloads/` (stale hand-off page) | 3 locations for distributable artifacts |
| Runtime work | `work/`, `output/`, `.work_*/`, `cache/`, `node_modules/`, `.venv/` (all ignored) | no unified runtime root |
| Skills for agents | none | workflow knowledge embedded in 5 competing instruction documents |

## 5. Decisions taken from this evidence

1. **Do not split `universal_toolbook/engine/` into 7 subdirectories.** All 15 JS modules use
   relative `require('./x')`, `tests/run_all_tests.js` imports them by path, and the renderer is
   a single tightly coupled frame pipeline. A physical rewrite would add risk without adding a
   new source of truth. The conceptual responsibilities are documented in
   `docs/architecture/ENGINE_MODULES.md` instead (ADR-0002).
2. **Do not adopt Remotion / React / Three.js.** No such dependency exists; the custom renderer
   already implements frame-based timing, interpolation, sequencing, speech-locked cues and
   caption rendering. Framework-independent concepts are adapted; Remotion-specific APIs are
   clearly labelled as not adopted (ADR-0001).
3. **Consolidate agent instructions into `AGENTS.md` + `skills/`.** The five competing
   instruction documents are the largest source of ambiguity for a future agent.
4. **Keep the byte-for-byte immutable polish prompt at a single path** and update the hash guard
   to the new path without changing a single byte of its content.
5. **Keep all historical projects, benchmark samples and release archives.** They are evidence,
   not duplication; they are relocated, not deleted.
6. **Unify temporary output under `runtime/`**, and distributable artifacts under
   `deliverables/`, while keeping `universal_toolbook/` copyable with no repository-level
   runtime dependency.
