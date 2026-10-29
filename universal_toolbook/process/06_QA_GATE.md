# 06 — QA GATE

The definition of "finished". Every box is ticked **on a rendered frame**, never on the JSON.

## 0 — Pre-flight
- [ ] `mkdir -p work` has been run (fresh clones have no `work/`)
- [ ] `python3 tools/check_docs.py` → every documented path resolves
- [ ] `python3 universal_toolbook/run_studio.py check` → `status: OK`
- [ ] `validate work/episode.json` → `warnings: []`
- [ ] `duration_sec`, `scene_count`, `sound_events` match the plan
- [ ] If a verbatim script was supplied: validated against it, 100 % preserved

## 1 — 1080p stills — anatomy, occlusion, subtitles, framing

For **each** still:

- [ ] Limbs don't enter heads, torsos or another actor's silhouette
- [ ] Nobody floats: shoes on the floor line (y 855) or on the furniture their pose expects
- [ ] Seated poses only on seated beats, with a desk/chair under them
- [ ] Name tags clear of boards, props and the chapter strip
- [ ] Subtitle card clear of faces and props; no text touching the outer 5 %
- [ ] Nothing cropped by the frame edge (props, trees, clocks, calendars)
- [ ] Background is not an empty black field; floor has ground or set dressing
- [ ] Character colours read apart: two figures are distinguishable at thumbnail size
- [ ] Any board is inside y ≈ 104 … 272 and not over a tag or a face

## 2 — Draft — timing, boards, cuts

```bash
python3 universal_toolbook/run_studio.py render work/episode.json --out /tmp/draft/film_draft.mp4 \
  --draft --voice auto --workers 2 --chunk-sec 20
```

- [ ] For every board: frame at `cue_on + 1.5 s` → panel fully built, populated, in-band
- [ ] For every camera cut: frame at `cue_on + 2.5 s` → new framing landed, nothing exits
- [ ] No frame with audible speech and no subtitle
- [ ] No two-row card unless deliberate; no one-word line merged into its neighbour
- [ ] Speaker labels correct (a line attributed to the wrong character is visible in the card)
- [ ] Voices are audibly distinct; no line is truncated
- [ ] BGM sits under the narration (no pumping, no dropouts at scene joins)
- [ ] Draft duration ≈ planned duration; a big mismatch means a retiming problem

## 3 — Master

```bash
python3 universal_toolbook/run_studio.py render work/episode.json --out output/final_film_1080p.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

- [ ] `final_film_1080p_validation_report.json` → `valid: true`, `film_grain: false`,
      `warnings: []`, `frames ≈ duration × 30`
- [ ] `ffprobe` → 1920×1080, 30 fps, h264 + aac
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
