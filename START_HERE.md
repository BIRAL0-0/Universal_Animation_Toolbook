# START HERE

You are at the repository root. This page is the only orientation you need. Every path below
resolves from here; nothing is implied.

## 0. Before anything else — read the standing rules

**[`AGENT_OPERATING_RULES.md`](AGENT_OPERATING_RULES.md)** is the permanent production contract.
It defines **AUTOMATIC VIDEO CREATION MODE**: a bare request such as *"Create a new video."*
already authorises the full research → prompt → script → animation → narration → render → QA
workflow, with no need for the user to repeat the master prompt or walk you through stages.
It also carries the house content rules (no channel name anywhere, English-only narration,
Kokoro `am_michael` first, originality, evidence labelling) and the self-healing obligation.

A new video is produced by copying
**[`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](templates/MASTER_VIDEO_PRODUCTION_PROMPT.md)**
into a fresh folder under **[`projects/`](projects/)**, customising it with that video's research,
and saving the finalised prompt *before* production begins. Recurring problems and fixes live in
**[`docs/production/`](docs/production/)** (`KNOWN_ISSUES.md`, `LESSONS_LEARNED.md`,
`PIPELINE_CHANGELOG.md`); the rules that keep the system honest are enforced by
**[`tests/production/`](tests/production/)**.

## 1. What this repository is

`universal_toolbook/` renders a film from a single JSON spec in either 1920×1080 landscape or
1080×1920 portrait at 30 fps, with zero grain, multi-voice narration, Creative Commons music and
synchronised foley. The renderer reframes, never stretches; everything else in the
repository is a film, a test, or a result.

```
universal_toolbook/   the production kit  (engine, assets, tools, procedure, template)
templates/            MASTER_VIDEO_PRODUCTION_PROMPT.md — the reusable per-video prompt template
projects/             one folder per finished production (prompt, research, scripts, MP4)
docs/production/      KNOWN_ISSUES, LESSONS_LEARNED, PIPELINE_CHANGELOG — the self-healing log
tests/production/     hygiene + integrity tests that enforce the standing rules
examples/             five complete film specs — copy one to learn the shape
tests/                engine regression suite (development only)
outputs/              text results of finished films (chapters, reports, cue sheets)
output/               renders             (git-ignored, regenerated)
work/                 your episode + QA stills (git-ignored)
```

## 2. Bootstrap (once per machine)

```bash
# from the repository root, once per machine. Modern distros refuse system pip (PEP 668),
# so everything lives in the repo venv — never `pip install` into the system Python.
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
npm install --prefix universal_toolbook             # 2D canvas backend
.venv/bin/python universal_toolbook/setup_tts.py    # Kokoro weights -> cache/tts (primary voices)
.venv/bin/python universal_toolbook/run_studio.py check   # expect: "status": "OK", 7 BGM tracks
```

Kokoro is the **primary** narration backend (`am_michael` default, `af_bella` preferred secondary);
`setup_tts.py` caches its weights locally so renders work air-gapped. If `check` is not `OK`, read
`universal_toolbook/process/07_TROUBLESHOOTING.md` before doing anything else. Piper is a
**fallback only** — use it solely when a line cannot be voiced by Kokoro:

```bash
.venv/bin/pip install piper-tts
.venv/bin/python universal_toolbook/tools/fetch_piper_voices.py install                       # huggingface.co hosts the voices
.venv/bin/python universal_toolbook/tools/fetch_piper_voices.py install \
    --github 007-Akira/Project-Rocky --github-path voices    # when only github.com is reachable
python3 universal_toolbook/tools/fetch_piper_voices.py install --from-dir /path/to/piper_voices  # offline copy
```

`install --dry-run` prints the URLs it would fetch without downloading anything. The first
command fails in a few seconds (not minutes) when huggingface.co is blocked, and prints both
alternatives — verified end to end here: 4 files, `check` → `offline_voiceover_ready: true`, then
`--voice auto` renders with real narration.

## 3. Make a film

```bash
mkdir -p work                                       # work/ is not in git; create it first
cp universal_toolbook/templates/episode_minimal.json work/episode.json
#   author work/episode.json  ->  universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md

python3 universal_toolbook/run_studio.py validate work/episode.json     # must print warnings: []
python3 universal_toolbook/run_studio.py stills work/episode.json \
    --out-dir work/stills --width 1920 --height 1080                     # LOOK at every PNG
python3 universal_toolbook/run_studio.py render work/episode.json \
    --out /tmp/draft/film.mp4 --draft --voice auto --workers 2 --chunk-sec 20
python3 universal_toolbook/run_studio.py render work/episode.json \
    --out output/final_film_16x9.mp4 --aspect-ratio 16:9 --full --preset veryfast \
    --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto

# Short portrait cut (40–90 s); the long landscape master above has no short-form gate
python3 universal_toolbook/run_studio.py render work/short_episode.json \
    --aspect-ratio 9:16 --short-form --out output/final_short_portrait.mp4 --full --preset veryfast --voice auto
# --short-form does not choose an aspect ratio; --shorts selects 9:16 and allows any positive runtime up to 180 s.

# Portrait QA stills: inspect the crop/safe areas before encoding
python3 universal_toolbook/run_studio.py stills work/episode.json \
    --out-dir work/stills_portrait --width 1080 --height 1920
```

Generic short-form targets 40–90 seconds independently of aspect ratio. This guide's example
pair is a short 9:16 portrait cut and a long 16:9 landscape master; use `--short-form` only on the
short cut in this pairing. `--shorts` selects vertical 9:16 and accepts any positive runtime through
180 seconds (3 minutes).

`--voice auto` is required here: the Edge endpoint is unreachable, so the engine falls back to
the three installed Piper voices and reports what actually ran in `voice_backend`.

**Read `"voiced"` in the report, not just `"status"`.** If no backend could speak, the render
exits **3** with `"status": "COMPLETE_SILENT"` and a `"voice_diagnosis"` list naming what is
missing — the file would be subtitles and music only. `check` prints `offline_voiceover_ready`
so you can catch it before rendering; `--voice none` is the only way to ask for silence.

## 4. Read in this order

| # | File | Why |
| --- | --- | --- |
| 0 | [`docs/production-workflow/INDEX.md`](docs/production-workflow/INDEX.md) | the WHOLE pipeline: idea → script → film → publishing, and where each stage is documented |
| 1 | [`universal_toolbook/process/README.md`](universal_toolbook/process/README.md) | the procedure index and the seven-line pipeline (script → film) |
| 2 | [`universal_toolbook/process/01_INTAKE.md`](universal_toolbook/process/01_INTAKE.md) | script → scenes, timing budget, cast, BGM |
| 3 | [`universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md`](universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md) | how `work/episode.json` is written |
| 4 | [`universal_toolbook/process/03_RENDER_PIPELINE.md`](universal_toolbook/process/03_RENDER_PIPELINE.md) | exact commands, flags, verification |
| 5 | [`universal_toolbook/process/04_VISUAL_GEOMETRY.md`](universal_toolbook/process/04_VISUAL_GEOMETRY.md) | pixel rules that prevent overlaps and clipping |
| 6 | [`universal_toolbook/process/05_AUDIO.md`](universal_toolbook/process/05_AUDIO.md) | voices, pacing, BGM, foley, measurement |
| 7 | [`universal_toolbook/process/06_QA_GATE.md`](universal_toolbook/process/06_QA_GATE.md) | the definition of finished |
| 8 | [`universal_toolbook/process/08_LIMITS.md`](universal_toolbook/process/08_LIMITS.md) | what the engine does and does not do |
| — | [`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](universal_toolbook/01_TOOLBOOK_REFERENCE.md) | full schema: every field, action, environment, board |
| — | [`universal_toolbook/process/SESSION_PROMPT.md`](universal_toolbook/process/SESSION_PROMPT.md) | the contract to follow, if you are an agent |
| — | [`universal_toolbook/process/REPO_MAP.md`](universal_toolbook/process/REPO_MAP.md) | which folder stores what |

## 5. Five rules that are never optional

1. `validate` must print `warnings: []`.
2. Render full-resolution stills in the requested aspect ratio (landscape, portrait, or both) and **look at them** before any full render.
3. Film grain stays off.
4. Never overwrite an existing master — use a new filename and say so.
5. Report only numbers that came out of a file the run produced.

## 6. Check your work

```bash
python3 tools/check_docs.py            # every path quoted in the docs must exist
node tests/run_all_tests.js            # 60 actions, 12 hairstyles, 12 presets, IK drift
python3 tests/test_studio_pipeline.py  # pipeline + speech-lock checks
```

A finished run also drops text artifacts into `outputs/<film>/` — see
[`outputs/README.md`](outputs/README.md) and the worked example in
[`outputs/the_beacon_that_kept_time/NOTES.md`](outputs/the_beacon_that_kept_time/NOTES.md).
