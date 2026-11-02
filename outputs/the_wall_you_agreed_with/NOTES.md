# The Wall You Agreed With — delivery notes

A 46-second vertical Short (1080x1920, 9:16, 30 fps), parchment-and-ink, narrated offline.

| | |
|---|---|
| master | `the_wall_you_agreed_with_1080x1920.mp4` |
| bytes | 6,383,920 (6.1 MB) |
| sha256 | `889886520b712e9b0d1a5c5eed7be58d2b048a7adb563ff191c601ed421f08ef` |
| video | H.264 High, yuv420p, 1080x1920, 30 fps, 1380 frames, 905 kb/s |
| audio | AAC-LC, 44.1 kHz stereo, 196 kb/s |
| runtime | 0:46.00 |
| voice | Piper `en_US-ryan-medium` (fully offline) |
| film grain | off |

Rebuild:

```bash
export PIPER_VOICE_DIR=/home/user/piper_voices NODE_PATH=/home/user/Universal_Animation_Toolbook/universal_toolbook/node_modules
python3 tools/build_wall_episode.py --portrait work/the_wall_you_agreed_with_episode_v.json
python3 universal_toolbook/run_studio.py render work/the_wall_you_agreed_with_episode_v.json \
  --out output/wall_short_1080x1920.mp4 --full --portrait --voice piper --bgm dynamic \
  --crf 20 --preset veryfast --chunk-sec 30 --workers 2
```

Drop `--portrait` for the 1920x1080 landscape cut — same story table, same timing.

## Measured (qa_report.json)

- full decode: **0 errors / 0 warnings**, 1380 frames
- true peak **-2.88 dBFS**, RMS -20.67 dBFS, **0 clipped samples**
- narration **-15.76 dBFS** median vs music bed **-34.57 dBFS** => **18.8 dB** separation
- speech 10.25 s across 6 lines; longest quiet run 2.05 s (the fade tail)

## Files

```
the_wall_you_agreed_with_1080x1920.mp4   the master
report.json / validation.json            render + renderer reports, verbatim
cues.json                                all synchronised foley events
qa_report.json                           measured decode/mix numbers
script.md                                per-scene text, narration, music
storyboard.svg                           the film as animated SVG (text, no player)
stills/S01..S06.jpg                      one frame per scene, 1080x1920
```
