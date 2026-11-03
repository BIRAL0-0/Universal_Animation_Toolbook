# Universal Animation Toolbook

AI-agnostic 16:9 landscape and 9:16 portrait animation, neural voiceover and Creative Commons music pipeline.
Give any AI agent this repo plus a script, and it can render zero-grain `1920×1080` or `1080×1920` MP4s at 30fps without stretching the artwork.

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
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out output/film_16x9.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

Runs fully offline when `edge-tts` cannot reach its endpoint: install `piper-tts`, drop a couple of
`.onnx` voices into `~/.cache/piper_voices` (see `tools/fetch_piper_voices.py`), and the engine falls
back to local neural voices automatically.

## Output aspect ratios

Reuse the same episode JSON and choose its delivery size at render time. The example delivery
pair here is a long 16:9 landscape film and a 40–90 second 9:16 portrait cut. Generic
`--short-form` enforces that duration range without selecting an aspect ratio; other pairings remain
available when requested. `--shorts` selects the vertical 9:16 profile and accepts any positive
final runtime up to 180 seconds (3 minutes).

```bash
# Long-form landscape (no short-form duration gate)
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out output/long_landscape.mp4 --full
# Short portrait (generic inclusive 40–90 second gate)
python3 universal_toolbook/run_studio.py render work/short_episode.json --aspect-ratio 9:16 --short-form --out output/short_portrait.mp4 --full
# Vertical YouTube Shorts profile
python3 universal_toolbook/run_studio.py render work/short_episode.json --shorts --out output/youtube_shorts.mp4 --full
```

Portrait crops ease toward the active speaker when available; use scene `portrait_focus` or
`portrait_focus_x` fields to direct framing. The renderer uses uniform scaling and safe-area
layout, not independent width/height stretching.
