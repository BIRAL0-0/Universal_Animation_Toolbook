# Universal Animation Toolbook

**Version 3.0.0** — a self-contained, AI-agnostic production kit for complete stickman/cel
animation videos: 16:9 (1920×1080) or 9:16 (1080×1920), 30 fps, zero film grain, Kokoro
voiceover, Creative Commons music, synchronised foley and burned-in glowing captions. A single
`episode.json` drives a deterministic frame renderer; Python handles speech, timing and audio,
plain CommonJS JavaScript draws every frame. Portrait output reframes the composition — it never
stretches it.

## What is in this repository

| Location | Purpose |
|---|---|
| [`universal_toolbook/`](universal_toolbook/README.md) | **the reusable production kit** — CLI, renderer, audio/TTS, config, bundled assets, schema, template and kit procedure. Copy this folder alone to render films. |
| [`AGENTS.md`](AGENTS.md) | mandatory rules for autonomous agents, architecture and skill activation |
| [`skills/`](skills/README.md) | six permanent agent skills: animation production, scriptwriting, stickman animation, voiceover/audio, YouTube research, production quality |
| [`templates/`](templates/README.md) | the one master video-production prompt and the project skeleton |
| [`projects/`](projects/) | one independent, never-overwritten folder per finished video |
| [`examples/`](examples/) | 11 validated reference episode specs |
| [`docs/`](docs/architecture/SYSTEM_OVERVIEW.md) | architecture, setup, development, production detail, troubleshooting, decisions |
| [`tests/`](tests/README.md) | unit, integration, regression, production and fixture tests |
| [`tools/`](tools/README.md), [`scripts/`](scripts/README.md) | repository validation, QA and developer entry points |
| [`deliverables/`](deliverables/README.md) | finished distributable packages, benchmark samples, durable text results |
| [`runtime/`](runtime/README.md) | git-ignored temporary work, renders, previews, cache and logs |

**Kit vs repository:** `universal_toolbook/` is the runtime and is copyable on its own. `skills/`,
`AGENTS.md`, `projects/`, `docs/`, `tests/`, `tools/` and `scripts/` are the complete development
repository around it; they are **not** required to render a film from the kit.

## Requirements

- Python 3.11+ with `numpy`, `imageio-ffmpeg`, `edge-tts` (`universal_toolbook/requirements.txt`)
- Node.js 20+ with `@napi-rs/canvas` or `canvas` (`npm install --prefix universal_toolbook`)
- `ffmpeg` binary supplied by `imageio-ffmpeg`
- Kokoro weights and voices downloaded by `universal_toolbook/setup_tts.py` into ignored `runtime/cache/tts/`
- Optional: `piper-tts` as a last-resort offline fallback

## Installation (fresh environment)

```bash
python3 -m venv .venv
.venv/bin/pip install -r universal_toolbook/requirements.txt pytest pyyaml
npm install --prefix universal_toolbook --no-audit --no-fund
.venv/bin/python universal_toolbook/setup_tts.py
.venv/bin/python universal_toolbook/run_studio.py check
```

`check` must print `"status": "OK"`. Full setup, environment variables and troubleshooting are in
[`docs/getting-started/INSTALL.md`](docs/getting-started/INSTALL.md).

## Quick start — render the smallest example

```bash
mkdir -p runtime/work runtime/renders runtime/previews
.venv/bin/python universal_toolbook/run_studio.py validate universal_toolbook/templates/episode_minimal.json
.venv/bin/python universal_toolbook/run_studio.py stills universal_toolbook/templates/episode_minimal.json \
    --out-dir runtime/previews/minimal --width 1920 --height 1080
.venv/bin/python universal_toolbook/run_studio.py render universal_toolbook/templates/episode_minimal.json \
    --out runtime/renders/minimal.mp4 --draft --voice auto --workers 2 --chunk-sec 20
```

`--voice none` produces a deliberately silent smoke render. `--short-form` gates a 40–90 s final
runtime; `--shorts` selects 9:16 and allows up to 180 s. Read the `*_report.json` and
`*_validation_report.json` written beside the MP4: `"voiced": true` and `"warnings": []` are
required for a real delivery. Full command reference:
[`universal_toolbook/README.md`](universal_toolbook/README.md) and
[`universal_toolbook/process/03_RENDER_PIPELINE.md`](universal_toolbook/process/03_RENDER_PIPELINE.md).

## How to create a video

For an autonomous agent: read [`AGENTS.md`](AGENTS.md) and activate
[`skills/animation-production/SKILL.md`](skills/animation-production/SKILL.md). A bare *"Create a
new video."* already authorises the full research → prompt → script → animation → narration →
render → QA workflow.

For a human starting a new project:

```bash
python3 scripts/new_project.py video-003-topic --title "Your title"
# customise projects/video-003-topic/PROMPT.md BEFORE production
python3 tools/make_scene_plan.py projects/video-003-topic
python3 tools/produce_video.py projects/video-003-topic
```

Each project keeps its own prompt, research, original/polished scripts, storyboard, characters,
scene plan, asset manifest, production log, QA report, audio, renders and `final.mp4`. The
master prompt is [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](templates/MASTER_VIDEO_PRODUCTION_PROMPT.md);
the English voiceover polish standard is immutable at
[`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](docs/production/prompts/VOICEOVER_POLISH_PROMPT.md).

## Documentation map

| Need | Read |
|---|---|
| Agent rules and skill activation | [`AGENTS.md`](AGENTS.md) |
| Architecture, module map, decisions | [`docs/architecture/SYSTEM_OVERVIEW.md`](docs/architecture/SYSTEM_OVERVIEW.md), [`docs/decisions/README.md`](docs/decisions/README.md) |
| Fresh setup / first video | [`docs/getting-started/INSTALL.md`](docs/getting-started/INSTALL.md), [`docs/getting-started/FIRST_VIDEO.md`](docs/getting-started/FIRST_VIDEO.md) |
| Full production stages | [`docs/production/INDEX.md`](docs/production/INDEX.md) |
| Verified problems and fixes | [`docs/troubleshooting/INDEX.md`](docs/troubleshooting/INDEX.md) |
| Testing / contribution | [`docs/development/TESTING.md`](docs/development/TESTING.md), [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Change history | [`CHANGELOG.md`](CHANGELOG.md) |

## Tests

```bash
python3 tools/validate_structure.py
python3 tools/check_docs.py
python3 tools/validate_specs.py
node tests/regression/run_all_tests.js
python3 tests/integration/test_studio_pipeline.py
python3 -m pytest tests/unit tests/production -q
```

CI (`.github/workflows/verify.yml`) runs these plus a silent draft-render smoke test.

## Licence

See [`LICENSE`](LICENSE). Bundled third-party audio and TTS components retain their own licences;
attribution is recorded in
[`universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md`](universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md)
and [`docs/production/TTS_BENCHMARK.md`](docs/production/TTS_BENCHMARK.md).
