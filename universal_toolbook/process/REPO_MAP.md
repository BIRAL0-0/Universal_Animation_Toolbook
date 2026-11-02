# REPO MAP — what lives where, and what writes it

Two clean halves: **`universal_toolbook/` is the production kit** (everything needed to render),
and the repository root holds **the films** — specs, tests, results. Nothing that a render needs
sits outside the toolbook, and nothing that is only a development aid sits inside it.

```
Universal_Animation_Toolbook/
│
├── universal_toolbook/           ★ THE PRODUCTION KIT (self-contained, copyable)
│   │
│   ├── run_studio.py                the ONLY command you type (check|bgm-list|validate|stills|render|player)
│   ├── requirements.txt             python deps: numpy, imageio-ffmpeg, edge-tts (+ piper-tts offline)
│   ├── package.json / package-lock  node canvas backend (@napi-rs/canvas | canvas)
│   ├── README.md                    1-page overview
│   ├── 00_START_HERE.md             CLI surface and capabilities
│   ├── 01_TOOLBOOK_REFERENCE.md     full JSON schema: every field, action, environment, board
│   ├── MASTER_PROMPT.md             the director's brief to paste into an agent
│   │
│   ├── process/                     ★ HOW TO DO IT — the film-agnostic procedure
│   │   ├── README.md                   index + the seven-line pipeline
│   │   ├── SESSION_PROMPT.md           prompt to paste into a fresh session
│   │   ├── 01_INTAKE.md                script → scenes, timing budget, cast, BGM
│   │   ├── 02_AUTHORING_EPISODE_JSON.md how the episode file is written
│   │   ├── 03_RENDER_PIPELINE.md       commands, flags, verification
│   │   ├── 04_VISUAL_GEOMETRY.md       subtitle/board/spacing/pose pixel rules
│   │   ├── 05_AUDIO.md                 voices, pacing, BGM, foley, measurement
│   │   ├── 06_QA_GATE.md               definition of finished
│   │   ├── 07_TROUBLESHOOTING.md       symptom → cause → fix
│   │   ├── 08_LIMITS.md                what the engine does / does not do
│   │   └── REPO_MAP.md                 this file
│   │
│   ├── templates/
│   │   └── episode_minimal.json     ★ validated 2-scene episode that renders as-is
│   │
│   ├── engine/                      ★ THE RENDERER — where a frame is actually drawn
│   │   ├── video_renderer.js           frame compositor: aspect-preserving output, camera, z-order, overlays
│   │   ├── render_layout.js             shared output geometry, viewport, and text-fit helpers
│   │   ├── portrait_framing.js          speaker-aware 9:16 crop and safe-area board placement
│   │   ├── episode.js                  timeline: beats → tracks, speech-driven retiming, cue resolution
│   │   ├── character_rig.js            bodies, faces, hair, accessories, IK, walk cycles
│   │   ├── motion_library.js           the 60 actions (walk, sit, point, hand off, …)
│   │   ├── environments.js             preset rooms + parametric settings (sky, weather, lighting, floor)
│   │   ├── world_props_and_boards.js   props, vehicles, every board type
│   │   ├── parchment_ink_style.js      the alternative ink-on-paper look
│   │   ├── voice_engine.py             TTS, Edge→Piper fallback, word timings, per-line rendering
│   │   ├── audio_mixer.py              voice + BGM + foley → master_audio.wav, loudness
│   │   ├── bgm_library.py              CC catalog, mood matching, credits
│   │   ├── font.js                     Poppins loading, text metrics
│   │   └── canvas_backend.js            node-canvas OR @napi-rs/canvas abstraction
│   │
│   ├── assets/                      committed media inputs (~15 MB)
│   │   ├── bgm/*.mp3                   7 Creative Commons tracks (~2.1 MB each)
│   │   ├── bgm/BGM_CATALOG.json        id, moods, keywords, licence, source URL
│   │   ├── bgm/CREATIVE_COMMONS_LICENSES.md
│   │   └── Poppins-Regular.ttf, Poppins-Bold.ttf
│   │
│   ├── tools/                       helper CLIs used by the procedure
│   │   ├── fetch_piper_voices.py       check/install offline voices (kept out of git)
│   │   ├── serve_deliverables.py       Range-capable static server (206) for handing over a master
│   │   ├── build_storyboard_svg.py     master → self-contained animated SVG (text-only delivery)
│   │   └── script_helper.py            verbatim-script fidelity check (validate --script)
│   │
│   └── config/studio_config.json    studio defaults (fps, resolution, grain off)
│
├── examples/                     reference episode specs — copy structure & pacing from these
│   ├── cel_two_inch_bridge_episode.json       8 scenes, cel, boards, rain set
│   ├── two_inch_bridge_episode.json           8 scenes, parchment, two-actor handoff
│   ├── red_umbrella_episode.json              long-form cel drama, weather, cast
│   ├── discipline_vs_obsession_episode.json   long-form cel essay
│   └── two_inch_bridge_fable_episode.json     parchment fable variant
│
├── tests/                        development only — NOT needed to render
│   ├── run_all_tests.js             60 actions, 12 hairstyles, 12 presets, IK, 0 px drift
│   ├── test_studio_pipeline.py      pipeline + speech-lock checks
│   └── fixtures/                   two minimal schema specs the JS suite loads
│
├── outputs/                      ★ RESULTS OF FINISHED FILMS — text only, committed
│   ├── README.md                    the convention (one folder per film, no media)
│   └── two_inch_bridge_parchment/   worked example: chapters, report, validation, cues, NOTES.md
│
├── tools/                        dev tooling (not needed to render)
│   └── check_docs.py                verifies every path quoted in the docs exists
│
├── output/                       renders (git-ignored)
├── work/                         your episode + QA stills (git-ignored)
├── START_HERE.md                 ★ first landing page: bootstrap + reading order + hard rules
└── README.md                     repo summary + quick start
```

## Which part stores what

| You want to change… | Edit | It is read by |
| --- | --- | --- |
| the story, lines, scenes, cast | `work/episode.json` (a copy of `universal_toolbook/templates/episode_minimal.json`) | everything |
| how a body looks / moves | `universal_toolbook/engine/character_rig.js`, `universal_toolbook/engine/motion_library.js` | the compositor |
| the room, sky, weather | `universal_toolbook/engine/environments.js` or the scene's `setting` | the compositor |
| a prop or a chart | `universal_toolbook/engine/world_props_and_boards.js`, or `props[]` / `boards[]` in the episode | the compositor |
| subtitle position, chapters, grain | `universal_toolbook/engine/video_renderer.js` | the compositor |
| voice choice, pacing, timings | `voices` / `dialogue[].pause_after`; behaviour in `universal_toolbook/engine/voice_engine.py` | audio pass |
| music, mix levels | `universal_toolbook/assets/bgm/*` + `bgm`/`bgm_gain`; `universal_toolbook/engine/audio_mixer.py` | audio pass |
| the procedure itself | `process/*.md` | humans and agents |
| what the docs claim exists | `python3 tools/check_docs.py` | CI and pre-push checks |

## Command paths

Run from the folder that contains `universal_toolbook/` and address the kit explicitly:

```bash
python3 universal_toolbook/run_studio.py check
python3 universal_toolbook/run_studio.py validate work/episode.json
python3 universal_toolbook/run_studio.py render examples/cel_two_inch_bridge_episode.json \
  --aspect-ratio 16:9 --out output/final_film_16x9.mp4 --full --preset veryfast --crf 24 \
  --chunk-sec 45 --workers 2 --resume --voice auto
```

Or `cd universal_toolbook` first and drop the prefix — it also works as a standalone folder.
Episode and output paths always resolve from your current directory, so `examples/`, `work/`
and `output/` are addressed from the repo root.

## What is NOT in the repository (and where it comes from)

| Missing | Why | How it is obtained | Size |
| --- | --- | --- | --- |
| `output/*.mp4`, posters, players | renders are build artifacts | re-render from the episode spec | ~8 MB / 2 min |
| `work/stills/*.png` | QA frames | `run_studio.py stills …` | ~0.4 MB/scene |
| `output/.work_<name>/` | chunk cache + `master_audio.wav` | created by `render` | tens of MB |
| `universal_toolbook/node_modules/` | npm install (native binaries) | `npm install --prefix universal_toolbook` | 67 MB |
| `.venv/` / system packages | python env | `pip install -r universal_toolbook/requirements.txt` + `piper-tts` | ~300 MB |
| `~/.cache/piper_voices/*.onnx` | ~60 MB per voice | `python3 universal_toolbook/tools/fetch_piper_voices.py install` | 181 MB (3 voices) |
| the `ffmpeg` binary | shipped inside the wheel | `pip install imageio-ffmpeg` | — |

Everything a render needs at runtime — code, fonts, music, schema, procedure, template — is
committed inside `universal_toolbook/`.

## The data path, in one line each

1. `work/episode.json` → validated → **scenes, dialogue, beats, cues**
2. `universal_toolbook/engine/voice_engine.py` → one audio file per line + **real word timings**
3. `universal_toolbook/engine/episode.js` → retimes every scene to those timings → final track layout
4. `universal_toolbook/engine/video_renderer.js` → draws each frame (environment → props → actors → boards → subtitles)
5. `universal_toolbook/engine/audio_mixer.py` → voices + BGM + foley → `master_audio.wav`
6. `run_studio.py render` → chunks → concatenates → muxes audio → `output/*.mp4` + report JSON
7. `outputs/<film>/` → the text half of the result (chapters, report, validation, cues)
