# two_inch_bridge_cel — the finished master, shipped in the repo

Unlike a text-mirrors-only folder, this one carries the actual
`the_two_inch_bridge_1080p.mp4`. Video usually cannot cross a chat window or a preview pane, and
a "film" folder with no film in it is a poor answer to "where is the video" — so the master is
committed here, at 7.9 MB, well inside what a git host serves without complaint.

| File | Contents |
| --- | --- |
| `the_two_inch_bridge_1080p.mp4` | **the master** — 1920×1080, 30 fps, H.264 + AAC, 102.9 s |
| `chapters.txt` | 8 chapter timestamps + auto-generated Creative Commons music credits |
| `report.json` | resolution, fps, duration, scene count, voice backend, BGM tracks, sfx count |
| `validation.json` | `{valid, frames, dimensions, fps, film_grain, voiced, warnings}` |
| `cues.json` | every synchronised foley/visual cue |
| `storyboard.svg` | the film as animated SVG, for viewers that refuse video |

## The master, measured

| Property | Value |
| --- | --- |
| Style | `cel` — flat ink, paper-cel shading |
| Spec | `examples/cel_two_inch_bridge_episode.json` |
| Resolution / fps | 1920×1080 / 30 |
| Duration | 102.914 s (3087 frames) |
| Size | 8,305,274 B (7.92 MB) |
| `sha256` | `a61dd48ec6c829ebf0cad49f7694b23136811d821bad45bd6d5cce931cabb164` |
| `validation.json` | `valid: true`, `film_grain: false`, `voiced: true`, `warnings: []` |
| Full decode | `ffmpeg -v error -i … -f null -` prints nothing |
| `voice_backend` | `piper-offline:en_GB-alan-medium,en_US-amy-medium,en_US-ryan-medium` |
| Cast | NIA → amy, OKORO → alan, narrator → ryan (three audibly distinct speakers) |
| BGM | 4 CC tracks scored per scene, credits appended to `chapters.txt` |
| Foley | 28 synchronised sound cues |

The delivered film this reproduces was 102.915 s / 8,309,102 B; the rebuild lands within 1 ms of
the same timeline, which is the point of committing the spec rather than the binary alone.

## Rebuild it exactly

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r universal_toolbook/requirements.txt piper-tts
npm install --prefix universal_toolbook
python3 universal_toolbook/tools/fetch_piper_voices.py install          # or --github <owner>/<repo>
python3 universal_toolbook/run_studio.py check                          # offline_voiceover_ready: true
python3 universal_toolbook/run_studio.py validate examples/cel_two_inch_bridge_episode.json
python3 universal_toolbook/run_studio.py render examples/cel_two_inch_bridge_episode.json \
  --out output/final_film_1080p.mp4 --full --preset veryfast \
  --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

A render that reports `"voiced": false` (or exits 3 with `COMPLETE_SILENT`) has no narration —
install the voices before shipping it.

## Chapters

```
00:00 Kessa Chasm | Twelve Weeks
00:13 The Shortcut | Two Inches
00:24 Ahead of Schedule | Too Fast
00:36 Inspection | Check It Again
00:48 June | The Deck Sings
00:59 The Rule | Margin
01:14 Rebuild | Margin Restored
01:26 August | The Crossing
```
