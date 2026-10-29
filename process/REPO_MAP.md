# REPO MAP — what lives where, and what writes it

One page that answers "which part stores what". Committed sizes are approximate.

```
Universal_Animation_Toolbook/
│
├── run_studio.py                 the ONLY command you type (check|bgm-list|validate|stills|render|player)
├── requirements.txt              python deps: numpy, imageio-ffmpeg, edge-tts (+ piper-tts for offline voices)
├── package.json                  node canvas backend (@napi-rs/canvas | canvas) — optionalDependencies
├── package-lock.json
│
├── process/                      ★ HOW TO DO IT — the film-agnostic procedure
│   ├── README.md                    index + the seven-line pipeline
│   ├── SESSION_PROMPT.md            prompt to paste into a fresh session
│   ├── 01_INTAKE.md                 script → scenes, timing budget, cast, BGM
│   ├── 02_AUTHORING_EPISODE_JSON.md how the episode file is written
│   ├── 03_RENDER_PIPELINE.md        commands, flags, verification
│   ├── 04_VISUAL_GEOMETRY.md        subtitles/boards/spacing/pose pixel rules
│   ├── 05_AUDIO.md                  voices, pacing, BGM, foley, measurement
│   ├── 06_QA_GATE.md                definition of finished
│   ├── 07_TROUBLESHOOTING.md        symptom → cause → fix
│   └── REPO_MAP.md                  this file
│
├── templates/                    ★ WHERE A NEW FILM STARTS
│   └── episode_minimal.json         validated 2-scene episode that renders as-is
│
├── examples/                     finished episode specs (input data, not code)
│   ├── cel_two_inch_bridge_episode.json        8 scenes, cel, the cel film
│   ├── two_inch_bridge_episode.json            8 scenes, parchment
│   ├── red_umbrella_episode.json               longer cel drama
│   ├── discipline_vs_obsession_episode.json    long-form essay
│   └── minimal_*_template.json                 schema-only skeletons
│
├── engine/                       ★ THE RENDERER — where a frame is actually drawn
│   ├── video_renderer.js            frame compositor: camera, z-order, subtitles, chapters, grain switch
│   ├── episode.js                   timeline: beats → tracks, speech-driven retiming, cue resolution
│   ├── character_rig.js             bodies, faces, hair, accessories, IK, walk cycles
│   ├── motion_library.js            the 60 actions (walk, sit, point, hand off, …)
│   ├── environments.js              preset rooms + parametric settings (sky, weather, lighting, floor)
│   ├── world_props_and_boards.js    props, vehicles, and every board type
│   ├── parchment_ink_style.js       the alternative ink-on-paper look
│   ├── voice_engine.py              TTS, Edge→Piper fallback, word timings, per-line rendering
│   ├── audio_mixer.py               voice + BGM + foley → master_audio.wav, loudness
│   ├── bgm_library.py               reads the CC catalog, mood matching, credits
│   ├── font.js                      Poppins loading, text metrics
│   └── canvas_backend.js            node-canvas OR @napi-rs/canvas abstraction
│
├── assets/                       committed media inputs (≈15 MB)
│   ├── bgm/*.mp3                    7 Creative Commons tracks (~2.1 MB each)
│   ├── bgm/BGM_CATALOG.json         id, moods, keywords, licence, source URL for each track
│   ├── bgm/CREATIVE_COMMONS_LICENSES.md
│   └── Poppins-Regular.ttf, Poppins-Bold.ttf
│
├── tools/                        helper CLIs used by the procedure
│   ├── fetch_piper_voices.py        check/install offline voices (kept out of git)
│   ├── serve_deliverables.py        Range-capable static server (206) for handing over a master
│   ├── build_storyboard_svg.py      master → self-contained animated SVG (text-only delivery)
│   └── script_helper.py             verbatim-script fidelity check (validate --script)
│
├── tests/
│   ├── run_all_tests.js             JS regression: 60 actions, 12 hairstyles, 12 presets, IK, 0 px drift
│   └── test_studio_pipeline.py      python pipeline tests
│
├── config/studio_config.json     studio defaults (paths, fps, resolution)
│
├── outputs/                      ★ RESULTS OF FINISHED FILMS — text only, committed
│   ├── README.md                    the convention (one folder per film, no media)
│   └── two_inch_bridge_parchment/   worked example: chapters, report, validation, cues, NOTES.md
│
├── README.md                     one-page overview + where to start
├── 00_START_HERE.md              CLI surface and capabilities
├── 01_TOOLBOOK_REFERENCE.md      full JSON schema: every field, action, environment, board
└── MASTER_PROMPT.md / .txt       the director's brief to paste into an agent
```

## Which part stores what

| You want to change… | Edit | It is read by |
| --- | --- | --- |
| the story, lines, scenes, cast | `work/episode.json` (your copy of `templates/episode_minimal.json`) | everything |
| how a body looks / moves | `engine/character_rig.js`, `engine/motion_library.js` | the compositor |
| the room, sky, weather | `engine/environments.js` or the scene's `setting` | the compositor |
| a prop or a chart | `engine/world_props_and_boards.js`, or `props[]` / `boards[]` in the episode | the compositor |
| subtitle position, chapters, grain | `engine/video_renderer.js` | the compositor |
| voice choice, pacing, timings | `voices` / `dialogue[].pause_after` in the episode; `engine/voice_engine.py` for behaviour | audio pass |
| music, mix levels | `assets/bgm/*` + `bgm`/`bgm_gain` per scene; `engine/audio_mixer.py` | audio pass |
| the procedure itself | `process/*.md` | humans and agents |

## What is NOT in the repository (and where it comes from)

| Missing from git | Why | How it is obtained | Size here |
| --- | --- | --- | --- |
| `output/*.mp4`, `output/*.gif`, `output/*.webm` | renders are build artifacts | re-render from the episode spec | ~8 MB / 2 min |
| `work/stills/*.png` | QA frames, regenerable | `run_studio.py stills …` | ~0.4 MB/scene |
| `output/.work_<name>/` | chunk cache + `master_audio.wav` | created by `render` | tens of MB |
| `node_modules/` | npm install (has native binaries) | `npm install` | 67 MB |
| `.venv/` | python env | `pip install -r requirements.txt`, `pip install piper-tts` | 302 MB |
| `~/.cache/piper_voices/*.onnx` | 60 MB per voice, licence/size | `python3 tools/fetch_piper_voices.py install` | 181 MB (3 voices) |
| the `ffmpeg` binary | shipped inside the wheel | `pip install imageio-ffmpeg` | — |

Nothing else is required: fonts, music, code, docs and the schema are all committed.

## The data path, in one line each

1. `work/episode.json` → validated → **scenes, dialogue, beats, cues**
2. `engine/voice_engine.py` → one audio file per line + **real word timings**
3. `engine/episode.js` → retimes every scene to those timings → final track layout
4. `engine/video_renderer.js` → draws each frame (environment → props → actors → boards → subtitles)
5. `engine/audio_mixer.py` → voices + BGM + foley → `master_audio.wav`
6. `run_studio.py render` → chunks → concatenates → muxes audio → `output/*.mp4` + report JSON
7. `outputs/<film>/` → the text half of the result (chapters, report, validation, cues)
