# Universal Animation Toolbook — the copyable production kit

This directory **is** the runtime. It resolves `engine/`, `tts/`, `tools/`, `config/`, `assets/`,
`templates/` and `process/` relative to `run_studio.py`, so the folder can be copied out of the
repository and used on its own. Nothing here imports or executes repository-level `tools/`,
`scripts/`, `skills/`, `docs/`, `tests/`, `projects/`, `examples/` or `deliverables/`.

When you use the **complete development repository**, read [`../AGENTS.md`](../AGENTS.md) and
[`../skills/animation-production/SKILL.md`](../skills/animation-production/SKILL.md) first: they
own the agent rules and the full production workflow. This README is the kit's standalone
technical surface.

## Capabilities

- Deterministic, zero-grain frame renderer: 1920×1080 (16:9) or 1080×1920 (9:16), 30 fps.
  Portrait output reframes with uniform scaling; it never stretches the artwork.
- Two visual styles: atmospheric cel characters and warm parchment / hand-inked stick figures.
  7 body builds, 12 hairstyles, 18 accessories, articulated hands, grounded shoes and curved-spine
  posture. See [`engine/character_rig.js`](engine/character_rig.js).
- 60 supported actions with paired interactions, IK locomotion, world-space prop occlusion and
  0 px bone stretch / stance foot slip. See [`engine/motion_library.js`](engine/motion_library.js).
- 12 environments plus parametric settings, supported props and 13 board types. See
  [`engine/environments.js`](engine/environments.js) and
  [`engine/world_props_and_boards.js`](engine/world_props_and_boards.js).
- Speech-locked camera cuts, board reveals, multi-word subtitle glow and speaker pills. See
  [`engine/episode.js`](engine/episode.js) and [`engine/video_renderer.js`](engine/video_renderer.js).
- Kokoro-first voiceover (`am_michael` default, `af_bella` preferred secondary), Edge/Piper
  fallback, dead-air compaction and real word timings. See
  [`tts/config/voices.json`](tts/config/voices.json) and
  [`engine/voice_engine.py`](engine/voice_engine.py).
- 7 bundled CC0 / CC BY 4.0 music tracks with mood scoring, per-act switching, foley, ducking and
  loudness normalisation. See [`assets/bgm/BGM_CATALOG.json`](assets/bgm/BGM_CATALOG.json) and
  [`engine/audio_mixer.py`](engine/audio_mixer.py).
- Portable canvas backend: `node-canvas` or `@napi-rs/canvas`
  ([`engine/canvas_backend.js`](engine/canvas_backend.js)).

Full schema: [`01_TOOLBOOK_REFERENCE.md`](01_TOOLBOOK_REFERENCE.md). Technical procedure:
[`process/README.md`](process/README.md). Runnable skeleton:
[`templates/episode_minimal.json`](templates/episode_minimal.json).

## Standalone install

From this directory (or with `--prefix universal_toolbook` from the repository root):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm install --no-audit --no-fund
.venv/bin/python setup_tts.py
.venv/bin/python run_studio.py check
```

Kokoro weights are downloaded into an ignored local `runtime/cache/tts/`; Piper voices are fallback only.
System `ffmpeg` is not required — `imageio-ffmpeg` supplies the binary.

## CLI

```bash
python3 run_studio.py check
python3 run_studio.py bgm-list
python3 run_studio.py validate templates/episode_minimal.json
cp templates/episode_minimal.json /tmp/work/episode.json
python3 run_studio.py validate /tmp/work/episode.json          # must print warnings: []
python3 run_studio.py stills /tmp/work/episode.json --out-dir /tmp/work/stills --width 1920 --height 1080
python3 run_studio.py render /tmp/work/episode.json --out /tmp/work/draft.mp4 --draft --voice auto --workers 2 --chunk-sec 20
python3 run_studio.py render /tmp/work/episode.json --out /tmp/work/final.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
python3 run_studio.py player /tmp/work/final.mp4 --out /tmp/work/player.html
```

Episode and output paths resolve from your **current working directory**. Keep generated files out
of this source folder: use a scratch directory such as `runtime/renders/` when working in the
complete repository, or `/tmp/work` when the kit is copied out. `--voice none` is only for a
deliberately silent smoke test; `--voice auto` resolves Kokoro → Edge → Piper. `--short-form` gates
40–90 s; `--shorts` selects 9:16 and allows up to 180 s.

A render writes `<stem>_report.json`, `<stem>_validation_report.json`,
`<stem>_visual_audio_cues.json` and `<stem>_chapters.txt` beside the MP4. Read `voiced`,
`warnings`, `film_grain`, fps and dimensions: `COMPLETE_SILENT` / exit 3 is not a voiced delivery.

## Kit layout

| Path | Responsibility |
|---|---|
| `run_studio.py` | single production CLI |
| `engine/` | flat JS frame renderer + Python audio/TTS integration |
| `tts/` | Kokoro / Piper / Edge subsystem |
| `tools/` | kit-internal helpers (script fidelity, voice fetch, storyboard SVG, benchmark, server) |
| `config/studio_config.json` | fps, resolution, grain, subtitles, BGM and voice defaults |
| `assets/` | Poppins fonts, 7 CC music tracks, catalog, licences |
| `templates/episode_minimal.json` | validated 2-scene / 24 s skeleton |
| `process/` | film-agnostic technical procedure (intake → authoring → render → QA → limits) |
| `01_TOOLBOOK_REFERENCE.md` | complete JSON schema |
| `setup_tts.py` | pinned TTS weight/voice download and verification |

## Limits and troubleshooting

Read [`process/08_LIMITS.md`](process/08_LIMITS.md) before promising a capability and
[`process/07_TROUBLESHOOTING.md`](process/07_TROUBLESHOOTING.md) when a command fails. Repo-level
verified issues are in [`../docs/troubleshooting/INDEX.md`](../docs/troubleshooting/INDEX.md).
