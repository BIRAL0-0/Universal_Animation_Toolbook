# outputs/ — the durable channel for a run's results

Video is a large binary and does not always survive a chat, a viewer, or a preview pane. This
folder is where a finished run puts the parts of its result that **are text**, so something
useful always reaches the reader even when the `.mp4` cannot.

Keep it generic: one sub-folder per finished film.

```
outputs/
  <film-slug>/
    chapters.txt        chapter timestamps + generated CC music credits
    report.json         resolution, fps, duration, voice_backend, BGM tracks, sfx count
    validation.json     {valid, frames, dimensions, fps, film_grain, warnings}
    cues.json           every synchronised foley/visual cue
    storyboard.svg      optional: the film as animated SVG (text, no video needed)
    NOTES.md            master path, SHA-256, exact rebuild command, what changed
```

## Rules

1. **Text only.** No `*.mp4`, `*.gif`, `*.webm` — those stay in the git-ignored `output/` and
   are regenerated from the episode JSON. Media patterns are already in `.gitignore`.
2. Always record in `NOTES.md`:
   - the master's path, byte size and `sha256sum`;
   - the exact render command that produced it;
   - the episode spec it came from (path + commit);
   - `voice_backend` actually used (not the voices requested).
3. Never edit a report by hand — copy it from the render output verbatim.

## Producing the text set

```bash
OUT=outputs/<film-slug>
mkdir -p "$OUT"
cp output/final_film_1080p_chapters.txt              "$OUT/chapters.txt"
cp output/final_film_1080p_report.json               "$OUT/report.json"
cp output/final_film_1080p_validation_report.json    "$OUT/validation.json"
cp output/final_film_1080p_visual_audio_cues.json    "$OUT/cues.json"
python3 tools/build_storyboard_svg.py output/final_film_1080p.mp4 --out "$OUT/storyboard.svg"
sha256sum output/final_film_1080p.mp4
```

## Getting the actual video to a human, in order of reliability

1. **Rebuild it.** `python3 run_studio.py render <episode>.json --out <path>.mp4 --full
   --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto` — always works,
   no transfer involved.
2. **Serve it.** `python3 tools/serve_deliverables.py 8000 output`, open the preview from
   inside the app (not a raw URL in an external tab). Range requests are supported, so seeking
   and downloads work.
3. **Wrap it.** `python3 run_studio.py player output/final_film_1080p.mp4 --out output/player.html`.
4. **Show the SVG storyboard** above — it renders where video is refused.
5. If none of those reach the reader, the text set in this folder plus the rebuild command is
   the deliverable.
