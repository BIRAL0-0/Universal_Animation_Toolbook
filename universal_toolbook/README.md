# Universal Animation Toolbook

AI-agnostic 16:9 animation, neural voiceover and Creative Commons music pipeline.
Give any AI agent this repo plus a script, and it renders a zero-grain `1920×1080 @ 30fps` MP4.

**Start here → [`00_START_HERE.md`](00_START_HERE.md)** · full JSON schema → [`01_TOOLBOOK_REFERENCE.md`](01_TOOLBOOK_REFERENCE.md) · agent brief → [`MASTER_PROMPT.md`](MASTER_PROMPT.md)

**New session with a script and no idea what to do? → [`process/README.md`](process/README.md).**
That folder is the film-agnostic production procedure (intake → authoring → rendering → QA),
and [`process/SESSION_PROMPT.md`](process/SESSION_PROMPT.md) is the prompt to paste into it.
Start from the runnable skeleton [`universal_toolbook/templates/episode_minimal.json`](templates/episode_minimal.json).

## Quick start

```bash
python3 universal_toolbook/run_studio.py check                 # node, python, ffmpeg, fonts, BGM
npm install --prefix universal_toolbook      # 2D canvas backend (node-canvas or @napi-rs/canvas)
pip install -r universal_toolbook/requirements.txt   # neural voiceover + audio mixing
python3 universal_toolbook/run_studio.py render work/episode.json --out output/film.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

Runs fully offline when `edge-tts` cannot reach its endpoint: install `piper-tts`, drop a couple of
`.onnx` voices into `~/.cache/piper_voices` (see `tools/fetch_piper_voices.py`), and the engine falls
back to local neural voices automatically.
