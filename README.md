# Universal Animation Toolbook

AI-agnostic 16:9 animation, neural voiceover and Creative Commons music pipeline.
Give any AI agent the toolbook plus a script, and it renders a zero-grain `1920×1080 @ 30fps` MP4.

```
Universal_Animation_Toolbook/
├── universal_toolbook/   ★ everything reusable: engine, tools, docs, assets, tests, template
├── examples/               finished episode specs (data for specific films)
├── outputs/                text results of finished films (chapters, reports, cue sheets)
├── output/                 renders — git-ignored, regenerated on demand
└── work/                   your working episode + QA stills — git-ignored
```

## Start here

| If you want to… | Open |
| --- | --- |
| know how a film gets made, step by step | [`universal_toolbook/process/README.md`](universal_toolbook/process/README.md) |
| hand this to an agent that has a script | [`universal_toolbook/process/SESSION_PROMPT.md`](universal_toolbook/process/SESSION_PROMPT.md) |
| the CLI surface and capabilities | [`universal_toolbook/00_START_HERE.md`](universal_toolbook/00_START_HERE.md) |
| the full JSON schema, all actions/environments | [`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](universal_toolbook/01_TOOLBOOK_REFERENCE.md) |
| the creative brief for an agent | [`universal_toolbook/MASTER_PROMPT.md`](universal_toolbook/MASTER_PROMPT.md) |
| which folder stores what (and what isn't in git) | [`universal_toolbook/process/REPO_MAP.md`](universal_toolbook/process/REPO_MAP.md) |

## Quick start (from the repository root)

```bash
python3 universal_toolbook/run_studio.py check                 # node, python, ffmpeg, fonts, BGM, voices
npm install --prefix universal_toolbook                        # 2D canvas backend
pip install -r universal_toolbook/requirements.txt             # edge-tts, numpy, imageio-ffmpeg

cp universal_toolbook/templates/episode_minimal.json work/episode.json
#   … author it (see process/02) …
python3 universal_toolbook/run_studio.py validate work/episode.json
python3 universal_toolbook/run_studio.py stills work/episode.json \
    --out-dir work/stills --width 1920 --height 1080          # look at these before rendering
python3 universal_toolbook/run_studio.py render work/episode.json \
    --out output/final_film_1080p.mp4 --full --preset veryfast \
    --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

`--voice auto` is required where the Edge endpoint is unreachable: the engine falls back to
local Piper voices (see `universal_toolbook/tools/fetch_piper_voices.py`).

## Sample films

- [`examples/cel_two_inch_bridge_episode.json`](examples/cel_two_inch_bridge_episode.json) — 8 scenes, cel style
- [`examples/two_inch_bridge_episode.json`](examples/two_inch_bridge_episode.json) — 8 scenes, parchment style
- [`examples/red_umbrella_episode.json`](examples/red_umbrella_episode.json), [`examples/discipline_vs_obsession_episode.json`](examples/discipline_vs_obsession_episode.json)

Their text results live in [`outputs/`](outputs/README.md).
