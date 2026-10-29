# QA CHECKLIST — the gate a render must pass

Run top to bottom. Nothing is "done" until every box is ticked **on a real rendered frame**,
not on the JSON.

## 0. Pre-flight
- [ ] `run_studio.py check` → `status: OK`, BGM tracks listed, voice backend reported
- [ ] `validate work/episode.json` → `warnings: []`, expected scene count and duration
- [ ] `bgm_tracks_available ≥ 4`, `smoke_bgm_mode: catalog_cc` (or `dynamic`)

## 1. 1080p stills (anatomy, occlusion, subtitle, framing)
```bash
python3 run_studio.py stills work/episode.json --out-dir work/stills --width 1920 --height 1080
```
For **every** still:
- [ ] No limb enters a head, torso, or another actor's silhouette
- [ ] No actor floats: shoes touch `FLOOR_Y` (855) or a chair/desk the pose expects
- [ ] Seated rig only on seated poses (`head_in_hands`, `sketch_desk`, `sit_desk_type`, …)
- [ ] Name tags clear of boards, props and the chapter strip
- [ ] Subtitle card clear of faces and props; no text touching the 5 % edge
- [ ] Nothing cropped by the frame edge (props, tree, calendar, clock)
- [ ] Environment is not a flat black field; floor has ground or a set dressing
- [ ] Board (if any) is inside `y ≈ 104 … 272`, not over a tag or a face

## 2. Draft pass (timing, boards, cuts)
```bash
python3 run_studio.py render work/episode.json --out /tmp/draft/film_draft.mp4 \
  --draft --voice auto --workers 2 --chunk-sec 20
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -v error -ss <t> -i /tmp/draft/film_draft.mp4 -frames:v 1 -y /tmp/qa/t.png
```
- [ ] For each board: sample `cue_on + 1.5 s` → panel fully built, populated, inside safe band
- [ ] For each camera cut: sample `cue_on + 2.5 s` → framing lands, nothing exits frame
- [ ] No frame where a subtitle is missing *while speech is audible*
- [ ] No two-row card unless deliberate; short lines don't merge with the next line
- [ ] Draft duration ≈ master duration (a mismatch means a retiming bug — investigate)

## 3. Final master
```bash
python3 run_studio.py render work/episode.json --out output/final_film_1080p.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```
- [ ] `output/final_film_1080p_validation_report.json` → `valid: true`, `film_grain: false`,
      `warnings: []`, `frames == round(duration*30)`
- [ ] `ffprobe` → 1920×1080, 30 fps, h264 + aac
- [ ] Full decode: `ffmpeg -v error -i out.mp4 -f null -` prints nothing
- [ ] Audio: parse `master_audio.wav` with `wave` → peak ≤ −1 dBFS, RMS ≈ −16 … −19 dBFS
- [ ] Spot-check 10+ frames across the timeline (start, each scene head, each board, ending)
- [ ] Chapters file exists, timestamps inside duration, credits block present
- [ ] Distinct voices verified from `voice_backend` in the report (not the JSON intent)

## 4. Delivery
- [ ] `outputs/` updated with the new chapters / reports / cue sheet (text survives transfer)
- [ ] Nothing large committed to git (`*.mp4`, `*.gif`, `*.webm` stay ignored)
- [ ] Never overwrite a previous master; use a new filename and say so
