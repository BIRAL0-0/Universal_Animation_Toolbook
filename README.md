# Universal Animation Toolbook

AI-agnostic 16:9 animation, neural voiceover and Creative Commons music pipeline.
Give any AI agent this repo plus a script, and it renders a zero-grain `1920×1080 @ 30fps` MP4.

**Start here → [`00_START_HERE.md`](00_START_HERE.md)** · full JSON schema → [`01_TOOLBOOK_REFERENCE.md`](01_TOOLBOOK_REFERENCE.md) · agent brief → [`MASTER_PROMPT.md`](MASTER_PROMPT.md)

## Sample output

[`examples/two_inch_bridge_episode.json`](examples/two_inch_bridge_episode.json) — *“The Two-Inch Bridge”*,
a 1:47 hand-inked parchment short, was rendered from that single spec file:

```bash
python3 run_studio.py render examples/two_inch_bridge_episode.json \
    --out output/the_two_inch_bridge_1080p.mp4 --full --preset veryfast \
    --crf 21 --chunk-sec 30 --workers 3
```

## Quick start

```bash
python3 run_studio.py check                 # node, python, ffmpeg, fonts, BGM
npm install                                 # 2D canvas backend (node-canvas or @napi-rs/canvas)
pip install edge-tts imageio-ffmpeg numpy   # neural voiceover + audio mixing
python3 run_studio.py render my_episode.json --out output/my_film.mp4 --full
```

Runs fully offline when `edge-tts` cannot reach its endpoint: install `piper-tts`, drop a couple of
`.onnx` voices into `~/.cache/piper_voices` (see `tools/fetch_piper_voices.py`), and the engine falls
back to local neural voices automatically.
