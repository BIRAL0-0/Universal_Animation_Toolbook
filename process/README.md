# process/ — how this film was made, written as a prompt

Everything a future session needs to **reproduce this production or start the next one**,
without re-deriving decisions from scratch.

| File | Purpose |
| --- | --- |
| `PRODUCTION_PROMPT.md` | The complete, copy-pasteable brief + spec for generating this film (or a sequel) end to end. |
| `ENGINE_NOTES.md` | Every engine change made for this run, with the reason and the exact numbers. |
| `QA_CHECKLIST.md` | The visual/audio gate the render must pass before it is called done. |

## The 60-second version

```bash
python3 run_studio.py check
python3 run_studio.py validate work/episode.json          # expect warnings: []
python3 run_studio.py stills work/episode.json --out-dir work/stills --width 1920 --height 1080
#   -> inspect all 8 stills, fix framing/occlusion, repeat until clean
python3 run_studio.py render work/episode.json --out /tmp/draft/film_draft.mp4 \
  --draft --voice auto --workers 2 --chunk-sec 20
#   -> sample frames at every board cue_on and every camera cut, fix, repeat
python3 run_studio.py render work/episode.json --out output/final_film_1080p.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

`--voice auto` is mandatory in this sandbox: Azure/Edge TTS is unreachable
(`speech.platform.bing.com:443` refused), so the engine falls back to local Piper voices.

## Where things live

- `work/episode.json` — the authored episode spec (input of everything).
- `outputs/` — text-native artifacts (chapters, reports, validation, cue sheets). **This is the
  durable place for results**: media files are large binaries and may not survive a chat
  transfer, so anything reproducible-but-not-transferable gets summarised here.
- `output/` — actual render output (git-ignored, machine-local).
- `tools/serve_deliverables.py` — Range-capable static server used to hand the master to a
  browser (`python3 tools/serve_deliverables.py 8000 output`).
