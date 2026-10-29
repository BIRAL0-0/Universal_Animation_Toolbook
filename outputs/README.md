# outputs/ — durable, text-native results

Video is a large binary: it does not always survive a chat transfer or a preview pane. This
folder is the **reliable channel**. Downloadable media is either produced on demand or left in
the git-ignored `output/` directory — everything that *can* be represented as text is
committed here instead.

## Contents

| File | What it is |
| --- | --- |
| `final_film_1080p_chapters.txt` | 8 YouTube-style chapter timestamps + the Creative Commons music credits. |
| `final_film_1080p_report.json` | Full render report: resolution, fps, duration, scene count, voice backend, BGM tracks and credits, sfx count, output paths. |
| `final_film_1080p_validation_report.json` | Machine gate: `valid`, `frames`, `dimensions`, `fps`, `film_grain`, `warnings`. |
| `final_film_1080p_visual_audio_cues.json` | 28 synchronised foley/visual cue entries. |

## The master itself

| Property | Value |
| --- | --- |
| Path (local, git-ignored) | `output/final_film_1080p.mp4` |
| Size | 8,309,102 bytes |
| SHA-256 | `71a82c99ad9fb2425afc3273f1671c41ec651658978eb46d03f4b3674a45f4b9` |
| Format | 1920×1080 · 30 fps · 3087 frames · 102.915 s · H.264 High + AAC 44.1 kHz stereo |
| Grain | none |
| Audio | peak −2.87 dBFS · RMS −17.4 dBFS |

Rebuild it byte-for-byte-close from the spec at any time:

```bash
python3 run_studio.py check
python3 run_studio.py validate work/episode.json
python3 run_studio.py render work/episode.json --out output/final_film_1080p.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

(Numbers will match; byte-level hashes will not, because encoder threads and the Piper voice
models are not deterministic across machines.)

## Getting the video out, in order of reliability

1. **Regenerate** locally with the command above — always works, needs no transfer.
2. **Serve it**: `python3 tools/serve_deliverables.py 8000 output`, then open the preview from
   inside Arena (not in an external browser tab) — the page has 1080p / 720p download buttons.
3. **Workspace files**: `work/deliverables/` holds `final_film_1080p.mp4`,
   `final_film_720p_compact.mp4`, `preview_clip.gif`, `full_film_preview_560.gif` and
   `film_storyboard.svg` (a self-contained animated SVG — text, no binary needed).
4. **Text-only fallback**: `film_storyboard.svg` and `outputs/final_film_1080p_visual_audio_cues.json`
   describe the film frame by frame without a single media byte.

## Chapters

```
00:00  Kessa Chasm | Twelve Weeks
00:13  The Shortcut | Two Inches
00:24  Ahead of Schedule | Too Fast
00:36  Inspection | Check It Again
00:48  June | The Deck Sings
00:59  The Rule | Margin
01:14  Rebuild | Margin Restored
01:26  August | The Crossing
```

## Music (Creative Commons)

- "Where Stars Fall" — Scott Buckley (CC BY 4.0)
- "Softly" — Loyalty Freak Music (CC0 1.0 Public Domain)
- "The Distant Sun (Monomyth 1)" — Scott Buckley (CC BY 4.0)
- "The Restoration (Monomyth 12)" — Scott Buckley (CC BY 4.0)
