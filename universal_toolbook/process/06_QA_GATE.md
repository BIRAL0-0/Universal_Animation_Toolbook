# 06 — QA GATE

The definition of "finished". Every box is ticked **on a rendered frame**, never on the JSON.

## 0 — Pre-flight
- [ ] `mkdir -p work` has been run (fresh clones have no `work/`)
- [ ] `python3 tools/check_docs.py` → every documented path resolves
- [ ] `python3 universal_toolbook/run_studio.py check` → `status: OK`
- [ ] `validate work/episode.json` → `warnings: []`
- [ ] `duration_sec`, `scene_count`, `sound_events` match the plan
- [ ] If a verbatim script was supplied: validated against it, 100 % preserved

## 1 — Full-resolution stills — anatomy, occlusion, subtitles, framing

Render and inspect every requested output aspect ratio: 1920×1080 for 16:9 and/or 1080×1920 for 9:16. Portrait framing may crop a non-focused actor; it must keep the intended subject and critical graphics visible.

For **each** still:

- [ ] Limbs don't enter heads, torsos or another actor's silhouette
- [ ] Nobody floats: shoes on the floor line (y 855) or on the furniture their pose expects
- [ ] Seated poses only on seated beats, with a desk/chair under them
- [ ] Name tags clear of boards, props and the chapter strip
- [ ] Subtitle card clear of faces and props; no text touching the target aspect's safe margins
- [ ] No unintended crops of focal characters or critical graphics; portrait may crop a distant secondary actor
- [ ] Background is not an empty black field; floor has ground or set dressing
- [ ] Character colours read apart: two figures are distinguishable at thumbnail size
- [ ] Any board fits its requested viewport and is not over a tag or a face

## 2 — Draft — timing, boards, cuts

```bash
# Long landscape draft (no short-form duration gate)
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out /tmp/draft/film_draft.mp4 \
  --draft --voice auto --workers 2 --chunk-sec 20
# Short portrait draft (generic inclusive 40–90 s gate)
python3 universal_toolbook/run_studio.py render work/short_episode.json --aspect-ratio 9:16 --short-form \
  --out /tmp/draft/short_portrait.mp4 --draft --voice auto --workers 2 --chunk-sec 20
# --short-form itself stays aspect-independent; --shorts selects 9:16 up to 180 s (3 minutes).
```

- [ ] For every board: frame at `cue_on + 1.5 s` → panel fully built, populated, in-band
- [ ] For every camera cut: frame at `cue_on + 2.5 s` → new framing landed, nothing exits
- [ ] No frame with audible speech and no subtitle
- [ ] No two-row card unless deliberate; no one-word line merged into its neighbour
- [ ] Speaker labels correct (a line attributed to the wrong character is visible in the card)
- [ ] `status` is `COMPLETE` (not `COMPLETE_SILENT`) and the process exited 0
- [ ] Report says `"voiced": true`; a `false` here means the film has no narration — stop
- [ ] Voices are audibly distinct; no line is truncated
- [ ] BGM sits under the narration (no pumping, no dropouts at scene joins)
- [ ] Draft duration ≈ planned duration; a big mismatch means a retiming problem

## 3 — Master

```bash
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out output/final_film_16x9.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

- [ ] `<film_stem>_validation_report.json` (e.g. `final_film_16x9_validation_report.json` or `final_film_9x16_validation_report.json`) → `valid: true`, `film_grain: false`, `voiced: true`, `warnings: []`, `frames ≈ duration × 30`
- [ ] `ffprobe` → requested dimensions (1920×1080 landscape or 1080×1920 portrait), 30 fps, h264 + aac
- [ ] `ffmpeg -v error -i out.mp4 -f null -` prints nothing (full decode)
- [ ] Audio peak ≤ −1 dBFS, RMS −16 … −19 dBFS (parse `master_audio.wav`)
- [ ] Spot-check ≥ 10 frames across the timeline: start, each scene head, each board, ending
- [ ] Chapters file exists, timestamps inside the duration, CC credits present
- [ ] `voice_backend` in the report lists every distinct voice you intended

## 4 — Delivery
- [ ] New filename; nothing overwritten
- [ ] Text artifacts copied to `outputs/` (chapters, report, validation, cue sheet)
- [ ] No large media committed (`*.mp4`, `*.gif`, `*.webm` stay git-ignored)
- [ ] Final message states the measured numbers and the exact paths — nothing invented
