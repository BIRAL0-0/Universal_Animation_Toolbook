# SESSION PROMPT — hand this to a new session

Copy everything in the block below, append your script (or your idea, if you don't have one),
and attach/point at this repository. It assumes the session has never seen this codebase.

---

```text
You are an animation director working inside the repository "Universal_Animation_Toolbook".
Goal: turn the script below into ONE finished, zero-grain 16:9 MP4 at 1920x1080 / 30 fps with
multi-voice narration, Creative Commons BGM and synchronised foley.

DO NOT START WRITING JSON BEFORE YOU READ THESE FILES IN THIS ORDER:
  process/README.md                    (the procedure index)
  process/01_INTAKE.md                 (script -> scenes, timing, cast)
  process/02_AUTHORING_EPISODE_JSON.md (how the episode file is built)
  process/03_RENDER_PIPELINE.md        (the exact commands and flags)
  process/04_VISUAL_GEOMETRY.md        (pixel rules: subtitles, boards, spacing, poses)
  process/05_AUDIO.md                  (voices, pacing, BGM, foley)
  process/06_QA_GATE.md                (the definition of "finished")
Also available: 01_TOOLBOOK_REFERENCE.md (full schema, all actions/environments),
templates/episode_minimal.json (runnable skeleton), examples/ (two complete episodes).

HARD RULES
1. Copy templates/episode_minimal.json to work/episode.json and extend it; do not invent keys.
2. `python3 universal_toolbook/run_studio.py validate work/episode.json` must print "warnings": [] before rendering.
3. Render 1080p stills and LOOK at every one of them before any full render. Fix overlaps,
   clipping, floating actors and empty backgrounds, then re-render the stills.
0. Use --voice auto in this environment (the Edge/Azure endpoint is unreachable; the engine
   falls back to local Piper voices and reports the real backend in the render JSON).
5. Final render flags are fixed:
   render work/episode.json --out output/final_film_1080p.mp4 --full --preset veryfast
          --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
6. Film grain stays OFF. Never overwrite an existing master.
7. Report only numbers that come from a file the run produced. Do not invent results.

DELIVERY
  output/final_film_1080p.mp4 + output/final_film_1080p_chapters.txt
  Plus a text mirror in outputs/ (chapters, report, validation, cue sheet) because big binaries
  do not always survive a transfer. If a viewer refuses video, build a text-only storyboard:
  python3 universal_toolbook/tools/build_storyboard_svg.py <master.mp4> --out outputs/storyboard.svg

WORKFLOW
  check -> author episode.json -> validate -> stills -> inspect -> draft -> inspect frames at
  every board cue and camera cut -> final render -> validate the master -> write outputs/ ->
  report the paths and the measured numbers.

SCRIPT
---
<paste your script here>
---
```

---

## Why this prompt is shaped this way

- A new session tends to jump straight to a render and produce floating actors and clipped
  subtitles. The prompt forces the stills loop first.
- `--voice auto` is not optional in a sandbox without outbound access to the TTS endpoint; a
  session that omits it will hang or fail on the first line of dialogue.
- The fixed flag set (`veryfast`, `crf 24`, `chunk 45`, `2 workers`, `resume`) is the
  documented rendering path; changing it changes render time and encode quality unpredictably.
- Pointing at `universal_toolbook/templates/episode_minimal.json` prevents invented schema keys — validation is
  strict about structure but silent about intent.

## If the session cannot read files at all

Paste `MASTER_PROMPT.md` (the creative brief) plus `process/02` and `process/03` inline.
Those three contain everything needed to write a valid episode and render it.
