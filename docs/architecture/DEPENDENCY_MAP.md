# Dependency and responsibility map (current architecture)

This is the post-reorganization map. The measured pre-change graph is preserved in
[`BASELINE_INVENTORY.md`](BASELINE_INVENTORY.md) §3. File paths are repository-root relative.
`tools/check_docs.py` treats every path quoted in Markdown as an executable claim;
`tools/validate_structure.py` checks the structural invariants below.

## 1. Runtime imports (unchanged engine code)

```
universal_toolbook/run_studio.py
  ├── engine.voice_engine ──> tts.providers (lazy), tts.audio, imageio-ffmpeg
  ├── engine.audio_mixer ──> engine.bgm_library ──> assets/bgm/BGM_CATALOG.json
  ├── engine.voice_engine.get_ffmpeg_exe
  ├── tools.script_helper ──> engine.bgm_library
  ├── config/studio_config.json
  └── node: engine/video_renderer.js

engine/video_renderer.js
  ├── canvas_backend.js ──> @napi-rs/canvas | canvas (npm)
  ├── font.js ──> assets/Poppins-*.ttf
  ├── episode.js ──> character_rig.js, environments.js, motion_library.js,
  │                  world_props_and_boards.js
  ├── character_rig.js, motion_library.js, environments.js
  ├── world_props_and_boards.js ──> beacon_harbor.js, impossible_wall.js
  ├── parchment_ink_style.js ──> beacon_harbor.js, impossible_wall.js
  ├── portrait_framing.js, render_layout.js
  └── camera / subtitle / transition drawing (all local)

universal_toolbook/generate_voiceover.py
  └── tts/{__init__,audio,manifest,segment,config}.py ──> tts/config/voices.json
universal_toolbook/setup_tts.py
  └── tools/convert_kokoro_v1_voices.py, tts/providers, runtime/cache/tts (ignored)
```

External runtime dependencies: Python `numpy`, `imageio-ffmpeg`, `edge-tts`; optional
`kokoro-onnx`, `piper-tts`; Node `@napi-rs/canvas` or `canvas`; ffmpeg binary from
`imageio-ffmpeg`. Development: `pytest`, `pyyaml`. **No React, Remotion, Three.js, Lottie,
Tailwind, bundler or second animation engine.**

## 2. Development-repository dependencies

```
AGENTS.md ──> skills/README.md ──> 6 SKILL.md files ──> references/*, docs/*, templates/*
AGENTS.md ──> templates/MASTER_VIDEO_PRODUCTION_PROMPT.md ──> projects/<slug>/PROMPT.md
scripts/new_project.py ──> master prompt, episode_minimal.json, tools/make_scene_plan.py
tools/produce_video.py ──> universal_toolbook/run_studio.py, imageio-ffmpeg, project files
tools/check_docs.py ──> all Markdown (with legacy alias map for historical records)
tools/validate_structure.py ──> check_docs.py, skills, templates, projects, runtime, git ls-files
tools/validate_specs.py ──> run_studio.py validate, examples/*.json, kit minimal template
tests/regression/run_all_tests.js ──> 9 engine/*.js modules
tests/integration/test_studio_pipeline.py ──> engine/*.py, kit tools, run_studio.py
tests/production/ ──> project archives, polish prompt hash, docs links, CI environment, mix reports
tests/unit/ ──> repository structure, skills, single master prompt, runtime hygiene, link checks
.github/workflows/verify.yml ──> all of the above + render-smoke
scripts/verify_fresh_checkout.py ──> git clone + all gates + kit standalone + silent draft
```

The kit is deliberately absent from the left-hand side of the second graph: nothing in
`universal_toolbook/` imports repository-level tools, tests, skills or docs.

## 3. Configuration ownership

| Setting | File | Verified by |
|---|---|---|
| fps, default resolution, grain off, subtitles, BGM mode, voice default, empty channel name | `universal_toolbook/config/studio_config.json` | `tests/regression/run_all_tests.js`, `tools/validate_structure.py` |
| TTS engine priority, `am_michael` default, `af_bella` secondary, aliases, voice catalog | `universal_toolbook/tts/config/voices.json` | `tools/validate_structure.py`, `universal_toolbook/tts/test_tts.py` |
| pronunciation | `universal_toolbook/tts/config/pronunciation_dictionary.json` | TTS tests |
| music catalog + licences | `universal_toolbook/assets/bgm/BGM_CATALOG.json`, `CREATIVE_COMMONS_LICENSES.md` | `tests/integration/test_studio_pipeline.py` |
| CI jobs | `.github/workflows/verify.yml` | `tools/check_workflows.py` |

## 4. Documentation link ownership

| Consumer | Points at |
|---|---|
| Root `README.md` | `AGENTS.md`, `skills/`, `universal_toolbook/`, `docs/`, `templates/`, `tests/`, `deliverables/`, `runtime/` |
| `AGENTS.md` | each skill, master template, architecture docs, ADRs, validation tools |
| `skills/*/SKILL.md` | the real engine files, kit process docs, production docs, immutable polish prompt |
| `docs/production/INDEX.md` | the 13-stage workflow docs in the same folder + kit process docs |
| `docs/getting-started/` | kit CLI, install, first video |
| `projects/<slug>/PROMPT.md` | the master template (historical instances keep their original links) |
| `tools/check_docs.py` | resolves canonical paths; legacy aliases only for historical records |

## 5. Structural invariants enforced by validation

1. Required root files, skill files, template files and directory layout exist.
2. Exactly one master production prompt and exactly one immutable polish prompt (SHA-256 guarded).
3. Every skill is referenced in `AGENTS.md` and has an activation section.
4. Every project under `projects/` has the required archive.
5. No tracked files inside ignored runtime directories; no generated media in source directories.
6. Voice defaults in both config files remain `am_michael`.
7. No non-empty `channel_name` in any JSON.
8. No legacy path strings in new documentation (historical records are exempt).
9. `tools/check_docs.py` resolves every path claim and Markdown link.
10. CI YAML parses and references existing commands.
