# Universal Animation Toolbook

AI-agnostic 16:9 landscape and 9:16 portrait animation, neural voiceover and Creative Commons music pipeline.
Give an AI agent the toolbook plus a script, and it can render zero-grain `1920×1080` landscape or `1080×1920` portrait MP4s at 30fps. The renderer preserves geometry and reframes portrait shots instead of stretching them.

```
Universal_Animation_Toolbook/
├── universal_toolbook/   ★ the production kit — engine, assets, tools, process, template, schema
├── docs/                   the full production-workflow docs (idea → script → film → publishing)
├── examples/               complete episode specs to copy structure and pacing from
├── tests/                  regression suite + its schema fixtures
├── outputs/                text results of finished films (chapters, reports, cue sheets)
├── output/                 renders — git-ignored, regenerated on demand
└── work/                   your working episode + QA stills — git-ignored
```

`universal_toolbook/` is self-contained: `universal_toolbook/run_studio.py` resolves its own `universal_toolbook/engine/`, `universal_toolbook/assets/`
and `universal_toolbook/config/` relative to itself, so it can be copied out and used on its own. Episodes and
outputs always resolve from *your* current directory.

## Start here

**First stop for any session: [`START_HERE.md`](START_HERE.md)** — bootstrap commands, the
reading order, and the five non-negotiable rules in one page.

| If you want to… | Open |
| --- | --- |
| run the whole content operation — idea → script → film → YouTube prep | [`docs/production-workflow/INDEX.md`](docs/production-workflow/INDEX.md) |
| know how a film gets made, step by step | [`universal_toolbook/process/README.md`](universal_toolbook/process/README.md) |
| hand this to an agent that has a script | [`universal_toolbook/process/SESSION_PROMPT.md`](universal_toolbook/process/SESSION_PROMPT.md) |
| the CLI surface and capabilities | [`universal_toolbook/00_START_HERE.md`](universal_toolbook/00_START_HERE.md) |
| the full JSON schema, all actions/environments | [`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](universal_toolbook/01_TOOLBOOK_REFERENCE.md) |
| the creative brief for an agent | [`universal_toolbook/MASTER_PROMPT.md`](universal_toolbook/MASTER_PROMPT.md) |
| which folder stores what | [`universal_toolbook/process/REPO_MAP.md`](universal_toolbook/process/REPO_MAP.md) |
| know what the engine cannot do | [`universal_toolbook/process/08_LIMITS.md`](universal_toolbook/process/08_LIMITS.md) |
| a worked spec to copy | [`examples/`](examples) |

## Quick start (from the repository root)

```bash
python3 universal_toolbook/run_studio.py check                 # node, python, ffmpeg, fonts, BGM, voices
npm install --prefix universal_toolbook                        # 2D canvas backend
pip install -r universal_toolbook/requirements.txt             # edge-tts, numpy, imageio-ffmpeg

cp universal_toolbook/templates/episode_minimal.json work/episode.json
#   … author it (see universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md) …
python3 universal_toolbook/run_studio.py validate work/episode.json
python3 universal_toolbook/run_studio.py stills work/episode.json \
    --out-dir work/stills --width 1920 --height 1080          # look at these before rendering
python3 universal_toolbook/run_studio.py render work/episode.json \
    --out output/final_film_16x9.mp4 --full --preset veryfast \
    --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

`--voice auto` is required where the Edge endpoint is unreachable: the engine falls back to
local Piper voices (`universal_toolbook/tools/fetch_piper_voices.py`).

## Choose the delivery format

The same episode JSON can be rendered in either orientation. Select the aspect from the script and
delivery requirement; short-form does not inherently mean portrait. Landscape remains the
default; portrait uses a subject-aware crop, keeps subtitles/boards inside the safe area, and never
scales X and Y independently. The example delivery pair here is a long 16:9 landscape film and a
40–90 second 9:16 portrait cut. The generic `--short-form` gate remains aspect-independent.

```bash
# Long-form 16:9 landscape master (default); no short-form gate
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 \
    --out output/film_landscape.mp4 --full --voice auto

# Short 9:16 portrait cut (inclusive 40–90 second gate)
python3 universal_toolbook/run_studio.py render work/short_episode.json --aspect-ratio 9:16 --short-form \
    --out output/film_short_portrait.mp4 --full --voice auto

# Vertical YouTube Shorts profile (any positive runtime through 180 seconds)
python3 universal_toolbook/run_studio.py render work/short_episode.json --shorts \
    --out output/film_shorts.mp4 --full --voice auto

# Inspect the portrait crop before encoding
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_portrait \
    --width 1080 --height 1920
```

`--short-form` checks the speech-locked final duration and exits with
`INVALID_SHORT_FORM_DURATION` unless it is 40–90 seconds; it does not select an aspect ratio. The
example pair above uses that gate for the short portrait, while the landscape master is long-form.
Other aspect/runtime pairings remain available when the delivery calls for them. `--shorts` selects
vertical 9:16 and accepts any positive duration up to 180 seconds (3 minutes), reporting
`INVALID_SHORTS_DURATION` otherwise. For deliberate framing, a scene can set
`"portrait_focus": "character_id"` (or `"board"`) / `"portrait_focus_x": 0.0..1.0`.

## Reference films (episode specs, not renders)

| Spec | Style | Shows |
| --- | --- | --- |
| [`examples/two_inch_bridge_episode.json`](examples/two_inch_bridge_episode.json) | parchment | 8 scenes, 2 ink-stick actors, 7 backdrops, 4 board types, two-actor `handoff`, dynamic CC BGM |
| [`examples/cel_two_inch_bridge_episode.json`](examples/cel_two_inch_bridge_episode.json) | cel | 8 scenes, stat cards + notebook boards, rain setting, camera cuts cued on speech |
| [`examples/red_umbrella_episode.json`](examples/red_umbrella_episode.json) | cel | night-city weather, umbrellas, multi-character cast |
| [`examples/discipline_vs_obsession_episode.json`](examples/discipline_vs_obsession_episode.json) | cel | long-form essay pacing, phone cards, per-act BGM switching |

Their text results live in [`outputs/`](outputs/README.md).

## Tests (development only — not needed to render)

```bash
node tests/run_all_tests.js            # 60 actions, 12 hairstyles, 12 presets, IK, 0 px drift
python3 tests/test_studio_pipeline.py  # pipeline + speech-lock checks
```
