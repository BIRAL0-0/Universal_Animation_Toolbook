# The Beacon That Kept Time — delivery notes

A fable, ~1:47, parchment-and-ink, voiced and scored entirely offline on this machine.

## The master

| | |
|---|---|
| path | `output/final_film_1080p.mp4` (also copied here) |
| bytes | 28,134,104 (26.8 MB) |
| sha256 | `b59b734c7b5206dfbdb4a8491e7bfc3939784507c8010d8723c3c48cdc992de5` |
| video | H.264 High, yuv420p, 1920×1080, 30 fps, 1891 kb/s, 3220 frames |
| audio | AAC-LC, 44.1 kHz stereo, 196 kb/s |
| duration | 107.33 s (1:47.3) |
| film grain | off (studio config default, unchanged) |

Exact command that produced it:

```bash
export PIPER_VOICE_DIR=/home/user/piper_voices NODE_PATH=/home/user/canvaslibs
python3 universal_toolbook/run_studio.py render examples/the_beacon_that_kept_time_episode.json \
  --out output/final_film_1080p.mp4 --full --voice piper --bgm dynamic \
  --crf 21 --preset veryfast --chunk-sec 30 --workers 2
```

Episode spec: `examples/the_beacon_that_kept_time_episode.json` (identical copy of
`work/the_beacon_that_kept_time_episode.json`, the file the render actually consumed), authored on
top of commit `c00a0c8`.

`voice_backend` actually used (from the render report, not the request):
`piper-offline:en_GB-alan-medium,en_US-amy-medium,en_US-ryan-medium`.
Narrator `en_US-ryan-medium`, Anya `en_US-amy-medium`, Mara `en_GB-alan-medium`.

## What is in this folder

```
the_beacon_that_kept_time_1080p.mp4   the master
chapters.txt                          YouTube chapter timestamps + generated CC credits
report.json                           render report, verbatim
validation.json                       renderer validation report, verbatim
cues.json                             all 28 synchronised foley events
qa_report.json                        my own measured probe results (mix, subtitles, decode)
script.md                             the produced script: scene starts, every line, board cues
storyboard.svg                        the film as animated SVG (text + base64 stills, no player)
poster.png                            1920×1080 key art, composited from a real frame at 00:45.6
contact_sheet.png                     all eight scenes on one plate
stills/S01..S08.jpg                   full-quality scene stills (1920×1080)
```

QA probes live in the repo as reusable tools, not one-off shell:

```bash
python3 tools/audio_report.py   output/.work_final_film_1080p/master_audio.wav \
                                output/.work_final_film_1080p/vo_manifest.json
python3 tools/mix_probe.py      examples/the_beacon_that_kept_time_episode.json \
                                output/.work_final_film_1080p
python3 tools/subtitle_check.py output/.work_final_film_1080p
NODE_PATH=/home/user/canvaslibs node tools/make_poster.js /tmp/hero.png /tmp/poster \
  work/stills_beacon/S0{1,2,3,4,5,6,7,8}_custom.png
```

`tools/` versions are the maintained copies; `work/` holds only this episode's scratch state.

## Source files changed

| file | change |
|---|---|
| `universal_toolbook/engine/beacon_harbor.js` | **new**, 1483 lines: the harbor set — lighthouse + lantern, shutter/lens mechanism, keeper's wheel, fishing boats, fog banks, channel markers, breakwater, oil flask, workbench, quay/riveted rail, two backdrops (harbor + lantern room), and `keeperGate()` (the 4.4 s three-sweeps-then-pause cycle the story turns on) |
| `universal_toolbook/engine/parchment_ink_style.js` | +33 lines: harbor backdrops dispatched from the parchment environment pass, and `faceAnim` (amplitude/viseme ink mouth) in the stick-figure head |
| `universal_toolbook/engine/video_renderer.js` | +5 lines: pass `faceAnim` through to the figure, gated on `actorIsSpeaking` so only a character's own lines move their mouth |
| `universal_toolbook/engine/world_props_and_boards.js` | +12 lines: require `beacon_harbor`, extend `SUPPORTED_PROPS` to 39, dispatch beacon props in `drawWorldProp` |
| `examples/the_beacon_that_kept_time_episode.json` | **new**, the episode spec (also picks up `tools/validate_specs.py` coverage automatically) |

Nothing else in the engine was edited. `git diff --stat` on the three touched files: 50 insertions.

## Rebuilding the stills / poster

```bash
python3 universal_toolbook/run_studio.py stills examples/the_beacon_that_kept_time_episode.json \
  --out-dir work/stills_beacon --width 1920 --height 1080
```
