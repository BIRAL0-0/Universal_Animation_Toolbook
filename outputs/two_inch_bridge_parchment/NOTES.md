# two_inch_bridge_parchment — worked example of a completed run

This folder is the reference for the `outputs/` convention: text-only artifacts of one
finished film, so something usable survives a channel that cannot carry an `.mp4`.

| File | Contents |
| --- | --- |
| `chapters.txt` | 8 chapter timestamps + auto-generated Creative Commons music credits |
| `report.json` | resolution, fps, duration, scene count, voice backend, BGM tracks, sfx count |
| `validation.json` | `{valid, frames, dimensions, fps, film_grain, warnings}` |
| `cues.json` | every synchronised foley/visual cue |

## The master

Not stored here (video is git-ignored). Rebuild it from the spec:

```bash
python3 universal_toolbook/run_studio.py check
python3 universal_toolbook/run_studio.py validate examples/two_inch_bridge_episode.json
python3 universal_toolbook/run_studio.py render examples/two_inch_bridge_episode.json \
  --out output/two_inch_bridge_1080p.mp4 --full --preset veryfast \
  --crf 21 --chunk-sec 30 --workers 3 --voice auto
```

## Measured result of this run

| Property | Value |
| --- | --- |
| Style | `parchment` (warm kraft paper, hand-inked stick figures) |
| Resolution / fps | 1920×1080 / 30 |
| Duration | 107.089 s · 8 scenes |
| Voice backend | `piper-offline:en_GB-alan-medium,en_US-ryan-medium` (Edge endpoint unreachable) |
| BGM | `reflective_piano` family — "Where Stars Fall" (Scott Buckley, CC BY 4.0), "Softly" (Loyalty Freak Music, CC0 1.0) |
| Film grain | off |

## Chapters

```
00:00  Two Inches | Short of Safe
00:18  Nine Days | The Invisible Part
00:29  June | The River Rises
00:41  Inspection | Two Inches
00:53  The Master's Rule | Margin
01:07  Twelve Weeks | Rebuilt
01:18  April | The Crossing
01:31  Every Life | Is a Bridge
```

## Notes

- Two voices were available offline for this run (alan, ryan), so the cast shares one Piper
  model between two characters. For a new film, install a third voice
  (`python3 universal_toolbook/tools/fetch_piper_voices.py install`) or pitch-shift the second character — see
  `universal_toolbook/process/05_AUDIO.md`.
- `crf 21 --chunk-sec 30 --workers 3` was used here; the current documented default is
  `--crf 24 --chunk-sec 45 --workers 2`, which is faster and visually equivalent on this art.
