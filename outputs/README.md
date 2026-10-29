# outputs/ — the durable channel for a run's results

A video may not survive a chat window, a viewer, or a preview pane, so a finished run puts its
result here **twice**: the master `.mp4` when it is small enough to keep in git, and every part
of the result that is text, so something useful always reaches the reader even when the video
cannot.

Keep it generic: one sub-folder per finished film.

```
outputs/
  <film-slug>/
    the_<film>_1080p.mp4 the master, ~8 MB at 1080p/crf 24 (see the size rule below)
    chapters.txt        chapter timestamps + generated CC music credits
    report.json         resolution, fps, duration, voice_backend, BGM tracks, sfx count
    validation.json     {valid, frames, dimensions, fps, film_grain, voiced, warnings}
    cues.json           every synchronised foley/visual cue
    storyboard.svg      optional: the film as animated SVG (text, no video needed)
    NOTES.md            master path, byte size, SHA-256, exact rebuild command
```

Two folders show both shapes: `two_inch_bridge_cel/` ships the master next to its text set,
`two_inch_bridge_parchment/` is the text-only variant for a cut whose binary was not kept.

## Rules

1. **One master, and only the master.** A film folder may carry its finished `.mp4`; it may not
   carry `work/` frames, `.work_*/` intermediates, `.gif` previews or `.webm` re-encodes. Keep the
   file under ~50 MB (git hosts warn there and reject past 100 MB): 1080p at `--crf 24` runs about
   8 MB per two minutes, so this is easy to honour. Anything larger ships as text plus the rebuild
   command in `NOTES.md`.
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
cp output/final_film_1080p.mp4                       "$OUT/the_two_inch_bridge_1080p.mp4"  # optional, <50 MB
cp output/final_film_1080p_chapters.txt              "$OUT/chapters.txt"
cp output/final_film_1080p_report.json               "$OUT/report.json"
cp output/final_film_1080p_validation_report.json    "$OUT/validation.json"
cp output/final_film_1080p_visual_audio_cues.json    "$OUT/cues.json"
python3 universal_toolbook/tools/build_storyboard_svg.py output/final_film_1080p.mp4 --out "$OUT/storyboard.svg"
sha256sum output/final_film_1080p.mp4
```

## Getting the actual video to a human, in order of reliability

1. **Open the file in this repo.** `outputs/two_inch_bridge_cel/the_two_inch_bridge_1080p.mp4`
   is 7.9 MB, so a git host renders or downloads it directly — no rebuild, no server.
2. **Rebuild it.** `python3 universal_toolbook/run_studio.py render <episode>.json --out <path>.mp4 --full
   --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto` — always works,
   no transfer involved.
3. **Serve it.** `python3 universal_toolbook/tools/serve_deliverables.py 8000 output`, open the preview from
   inside the app (not a raw URL in an external tab). Range requests are supported, so seeking
   and downloads work.
4. **Wrap it.** `python3 universal_toolbook/run_studio.py player output/final_film_1080p.mp4 --out output/player.html`.
5. **Show the SVG storyboard** above — it renders where video is refused.
6. If none of those reach the reader, the text set in this folder plus the rebuild command is
   the deliverable.
