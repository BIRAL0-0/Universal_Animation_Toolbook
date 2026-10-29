# REPO MAP — what lives where, and what writes it

The whole engine is one self-contained folder: **`universal_toolbook/`**. Nothing else is
required to render a film, and the folder can be copied out on its own.

```
universal_toolbook/
│
├── run_studio.py                 the ONLY command you type (check|bgm-list|validate|stills|render|player)
├── requirements.txt              python deps: numpy, imageio-ffmpeg, edge-tts (+ piper-tts offline)
├── package.json / package-lock   node canvas backend (@napi-rs/canvas | canvas)
├── README.md                     1-page overview
├── 00_START_HERE.md              CLI surface and capabilities
├── 01_TOOLBOOK_REFERENCE.md      full JSON schema: every field, action, environment, board
├── MASTER_PROMPT.md              the director's brief to paste into an agent
│
├── process/                      ★ HOW TO DO IT — the film-agnostic procedure
│   ├── README.md                    index + the seven-line pipeline
│   ├── SESSION_PROMPT.md            prompt to paste into a fresh session
│   ├── 01_INTAKE.md                 script → scenes, timing budget, cast, BGM
│   ├── 02_AUTHORING_EPISODE_JSON.md how the episode file is written
│   ├── 03_RENDER_PIPELINE.md        commands, flags, verification
│   ├── 04_VISUAL_GEOMETRY.md        subtitle/board/spacing/pose pixel rules
│   ├── 05_AUDIO.md                  voices, pacing, BGM, foley, measurement
│   ├── 06_QA_GATE.md                definition of finished
│   ├── 07_TROUBLESHOOTING.md        symptom → cause → fix
│   └── REPO_MAP.md                  this file
│
├── templates/
│   └── episode_minimal.json         ★ validated 2-scene episode that renders as-is
│
├── engine/                       ★ THE RENDERER — where a frame is actually drawn
│   ├── video_renderer.js            frame compositor: camera, z-order, subtitles, chapters, grain switch
│   ├── episode.js                   timeline: beats → tracks, speech-driven retiming, cue resolution
│   ├── character_rig.js             bodies, faces, hair, accessories, IK, walk cycles
│   ├── motion_library.js            the 60 actions (walk, sit, point, hand off, …)
│   ├── environments.js              preset rooms + parametric settings (sky, weather, lighting, floor)
│   ├── world_props_and_boards.js    props, vehicles, every board type
│   ├── parchment_ink_style.js       the alternative ink-on-paper look
│   ├── voice_engine.py              TTS, Edge→Piper fallback, word timings, per-line rendering
│   ├── audio_mixer.py               voice + BGM + foley → master_audio.wav, loudness
│   ├── bgm_library.py               CC catalog, mood matching, credits
│   ├── font.js                      Poppins loading, text metrics
│   └── canvas_backend.js            node-canvas OR @napi-rs/canvas abstraction
│
├── assets/
│   ├── bgm/*.mp3                    7 Creative Commons tracks (~2.1 MB each)
│   ├── bgm/BGM_CATALOG.json         id, moods, keywords, licence, source URL
│   ├── bgm/CREATIVE_COMMONS_LICENSES.md
│   └── Poppins-Regular.ttf, Poppins-Bold.ttf
│
├── tools/
│   ├── fetch_piper_voices.py        check/install offline voices (kept out of git)
│   ├── serve_deliverables.py        Range-capable static server (206) for handing over a master
│   ├── build_storyboard_svg.py      master → self-contained animated SVG (text-only delivery)
│   └── script_helper.py             verbatim-script fidelity check (validate --script)
│
└── config/studio_config.json     studio defaults (fps, resolution, grain off)
```

## Which part stores what

| You want to change… | Edit | It is read by |
| --- | --- | --- |
| the story, lines, scenes, cast | `work/episode.json` (a copy of `templates/episode_minimal.json`) | everything |
| how a body looks / moves | `engine/character_rig.js`, `engine/motion_library.js` | the compositor |
| the room, sky, weather | `engine/environments.js` or the scene's `setting` | the compositor |
| a prop or a chart | `engine/world_props_and_boards.js`, or `props[]` / `boards[]` in the episode | the compositor |
| subtitle position, chapters, grain | `engine/video_renderer.js` | the compositor |
| voice choice, pacing, timings | `voices` / `dialogue[].pause_after`; behaviour in `engine/voice_engine.py` | audio pass |
| music, mix levels | `assets/bgm/*` + `bgm`/`bgm_gain`; `engine/audio_mixer.py` | audio pass |
| the procedure itself | `process/*.md` | humans and agents |

## Where a film lives (outside the toolbook)

The toolbook only produces files; the film data and results sit next to it:

| Path | Holds | In git? |
| --- | --- | --- |
| `work/episode.json` | the episode you are authoring | no (scratch) |
| `work/stills/` | QA stills | no |
| `output/<name>.mp4` | renders, chapters, report JSON | no (build artifacts) |
| `outputs/<film>/` | text-only results of a finished film: chapters, report, validation, cues, notes | yes |

## Command paths

Run from the folder that contains `universal_toolbook/` and address the toolbook explicitly:

```bash
python3 universal_toolbook/run_studio.py check
python3 universal_toolbook/run_studio.py validate work/episode.json
```

Or `cd universal_toolbook` first and drop the prefix — `run_studio.py` resolves its own
`engine/`, `assets/` and `config/` relative to itself, so the folder also works standalone.
Episode and output paths always resolve from your current directory.

## What is NOT in the toolbook (and where it comes from)

| Missing | Why | How it is obtained | Size |
| --- | --- | --- | --- |
| `node_modules/` | npm install, native binaries | `npm install --prefix universal_toolbook` | 67 MB |
| `.venv/` or system packages | python env | `pip install -r universal_toolbook/requirements.txt` + `piper-tts` | ~300 MB |
| `~/.cache/piper_voices/*.onnx` | ~60 MB per voice | `python3 universal_toolbook/tools/fetch_piper_voices.py install` | 181 MB (3 voices) |
| the `ffmpeg` binary | shipped inside the wheel | `pip install imageio-ffmpeg` | — |

Everything the renderer needs at runtime — code, fonts, music, the schema, the procedure —
is inside `universal_toolbook/` and committed.

## The data path, in one line each

1. `work/episode.json` → validated → **scenes, dialogue, beats, cues**
2. `engine/voice_engine.py` → one audio file per line + **real word timings**
3. `engine/episode.js` → retimes every scene to those timings → final track layout
4. `engine/video_renderer.js` → draws each frame (environment → props → actors → boards → subtitles)
5. `engine/audio_mixer.py` → voices + BGM + foley → `master_audio.wav`
6. `run_studio.py render` → chunks → concatenates → muxes audio → `output/*.mp4` + report JSON
7. `outputs/<film>/` → the text half of the result (chapters, report, validation, cues)
