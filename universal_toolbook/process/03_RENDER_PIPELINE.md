# 03 — RENDER PIPELINE

Exact commands, in order, with the flags that are known to work. Anything you change here
changes render time and encode quality — change it deliberately, not accidentally.

```bash
python3 universal_toolbook/run_studio.py --help            # check | bgm-list | validate | stills | render | player
```

---

## Step 0 — environment

```bash
python3 universal_toolbook/run_studio.py check
```

Prints `status: OK`, the number of bundled BGM tracks, ffmpeg/font availability and the voice
backends it can reach. If it reports missing pieces it installs what it can. Do not proceed on
a non-`OK` status.

## Step 1 — validate the spec

```bash
python3 universal_toolbook/run_studio.py validate work/episode.json
```

Read the JSON it prints: `duration_sec`, `scene_count`, `settings_used`, `sound_events`,
`warnings`. **`warnings: []` is a gate** — fix every warning before rendering.
If a verbatim script was supplied, pass it too so word-for-word preservation is enforced:

```bash
python3 universal_toolbook/run_studio.py validate work/episode.json --script path/to/script.txt
```

## Step 2 — full-resolution stills in the delivery aspect ratio (the cheap QA loop)

```bash
# Render landscape QA stills for a 16:9 delivery
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_16x9 --width 1920 --height 1080

# Render portrait QA stills for a 9:16 delivery (same spec, no stretching)
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_9x16 --width 1080 --height 1920
```

One PNG per scene, named `<sceneId>_<environment>.png`. `--limit N` renders only the first N
scenes, which is handy while iterating. Inspect the stills in every requested output aspect ratio;
landscape camera pushes protect held props at the frame edge, while portrait framing follows the
active speaker or configured `portrait_focus`, includes held props, and uniformly fits nearby
narration-led groups; boards are repositioned inside the portrait safe area. Open umbrellas use a
136 px shaft so the canopy clears the holder's face; render bounds use that same geometry.

**Stills are sampled near the start of each scene**, so a board cued later in the scene will
NOT be in the still. That is expected; boards are verified from the draft instead (Step 3).

Look at every still (see `06_QA_GATE.md` for the checklist), fix, re-run. Two or three rounds
is normal and cheap; a full render with an overlap in it is neither.

## Step 3 — draft render (timing, boards, cuts, audio)

```bash
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out /tmp/draft/film_draft.mp4 \
  --draft --voice auto --workers 2 --chunk-sec 20
```

Exit code **3** with `"status": "COMPLETE_SILENT"` means the render did encode, but no voice
backend produced speech — `"voice_diagnosis"` names what is missing. Fix it and re-render rather
than inspecting a silent draft (see `05_AUDIO.md`).

`--draft` = 960×540 in landscape or 540×960 in portrait, with the same timeline. Use the aspect matching the requested master to check:

- every board at `cue_on + 1.5 s` → fully built, inside the safe band, not over a name tag;
- every camera cut at `cue_on + 2.5 s` → framing landed;
- subtitles: correct speaker, correct highlight, no clipping;
- audio: voices distinct, pauses not swallowing words, BGM under the narration.

Grab frames without re-encoding:

```bash
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -v error -ss 62.5 -i /tmp/draft/film_draft.mp4 -frames:v 1 -y /tmp/qa/t62.png
```

## Step 4 — master render

```bash
# Long-form 16:9 landscape master (no short-form duration gate)
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 \
  --out output/long_landscape.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto

# Short 9:16 portrait cut (generic inclusive 40–90 second gate)
python3 universal_toolbook/run_studio.py render work/short_episode.json --aspect-ratio 9:16 --short-form \
  --out output/short_portrait.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto

# For YouTube Shorts, --shorts selects 9:16 and accepts any positive runtime through 180 seconds.
python3 universal_toolbook/run_studio.py render work/short_episode.json --shorts \
  --out output/youtube_shorts.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

| Flag | Why this value |
| --- | --- |
| `--aspect-ratio 16:9` | 1920×1080 @ 30 fps landscape master; this remains the default |
| `--aspect-ratio 9:16` | 1080×1920 @ 30 fps portrait master; aspect-preserving subject crop, no stretch |
| `--short-form` | Strict inclusive 40–90 second final-duration check; does not select an aspect ratio |
| `--shorts` | YouTube Shorts profile: selects 9:16 and accepts any positive duration up to 180 seconds (3 minutes) |
| `--preset veryfast` | the documented encode path; slower presets blow the time budget for no visible gain on flat vector art |
| `--crf 24` | visually transparent on this art style, keeps files ~8 MB/min |
| `--chunk-sec 45` | chunk length for parallel workers; shorter = more overhead, longer = worse resume granularity |
| `--workers 2` | matches the CPU budget of the sandbox; more workers thrash |
| `--resume` | re-uses finished chunks in `output/.work_<name>/` — always leave it on |
| `--voice auto` | **required here**; Edge/Azure TTS is unreachable, so it falls back to local Piper |

The example delivery pair is a **long 16:9 landscape** and a **short 9:16 portrait**. Generic
`--short-form` remains aspect-independent; use a different pairing only when the delivery request
calls for it.

### What it writes

```
output/final_film_16x9.mp4                     the master
output/final_film_16x9_chapters.txt            chapters + auto-generated CC credits
output/final_film_16x9_report.json             resolution, fps, duration, voice_backend, BGM, sfx, credits
output/final_film_16x9_validation_report.json  {valid, frames, dimensions, fps, film_grain, warnings}
output/final_film_16x9_visual_audio_cues.json  every foley/visual cue
output/.work_final_film_16x9/master_audio.wav  the mixed audio (for measurement)
```

If you kill a render, re-run the **same command**: `--resume` picks the finished chunks up.
If you changed the episode, delete `output/.work_<name>/` first or you will mix old and new
frames.

## Step 5 — verify the master (not optional)

```bash
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
cat output/final_film_16x9_validation_report.json
"$FF" -hide_banner -i output/final_film_16x9.mp4 2>&1 | grep -E "Duration|Stream"
"$FF" -v error -i output/final_film_16x9.mp4 -f null - && echo FULL_DECODE_OK
python3 - <<'PY'
import wave, audioop, math
w = wave.open("output/.work_final_film_16x9/master_audio.wav", "rb")
d = w.readframes(w.getnframes())
print("channels", w.getnchannels(), "rate", w.getframerate(), "dur", round(w.getnframes()/w.getframerate(), 2))
print("peak dBFS", round(20*math.log10(audioop.max(d, w.getsampwidth())/32768.0), 2))
print("rms  dBFS", round(20*math.log10(max(audioop.rms(d, w.getsampwidth()),1)/32768.0), 2))
PY
```

`ffmpeg -af volumedetect` prints nothing in this environment — measure the WAV as above.

## Step 6 — deliver

- Master + chapters as agreed (default `output/final_film_16x9.mp4` and `…_chapters.txt`).
- Copy the text artifacts into `outputs/` (see `outputs/README.md`) so results survive a
  channel that can't carry video.
- Handing the video to a human who can't download binaries:

```bash
python3 universal_toolbook/tools/serve_deliverables.py 8000 output         # Range-capable static server
python3 universal_toolbook/run_studio.py player output/final_film_16x9.mp4 --out output/player.html
python3 universal_toolbook/tools/build_storyboard_svg.py output/final_film_16x9.mp4 --out outputs/storyboard.svg
```

The SVG storyboard is **text** — captions, cross-fades and stills inline — so it renders
anywhere, including viewers that refuse `mp4`.

## Timing expectations (this sandbox, 2 workers)

| Pass | 2-minute film |
| --- | --- |
| stills | ~2 s |
| draft (960×540) | ~50 s |
| master (1080p, veryfast, crf 24) | ~90 s |
