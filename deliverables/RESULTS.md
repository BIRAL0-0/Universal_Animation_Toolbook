# deliverables/ — the durable channel for a run's results

A video may not survive a chat window, a viewer, or a preview pane, so a finished run puts its
result here **twice**: the master `.mp4` when it is small enough to keep in git, and every part
of the result that is text, so something useful always reaches the reader even when the video
cannot.

Keep it generic: one sub-folder per finished film.

```
deliverables/
  <film-slug>/
    the_<film>_<aspect>.mp4 the master (`_16x9` landscape or `_9x16` portrait; see the size rule below)
    chapters.txt        chapter timestamps + generated CC music credits
    report.json         resolution, fps, duration, voice_backend, BGM tracks, sfx count
    validation.json     {valid, frames, dimensions, fps, film_grain, voiced, warnings}
    cues.json           every synchronised foley/visual cue
    storyboard.svg      optional: the film as animated SVG (text, no video needed)
    NOTES.md            master path, byte size, SHA-256, exact rebuild command
```

For example, `two_inch_bridge_cel/` ships the master next to its text set. A folder with no `.mp4` is still a valid shape (text mirrors only);
the master is then rebuilt with the command recorded in that folder's `NOTES.md`.

## Rules

1. **One master, and only the master.** A film folder may carry its finished `.mp4`; it may not
   carry `runtime/work/` frames, `.work_*/` intermediates, `.gif` previews or `.webm` re-encodes. Keep the
   file under ~50 MB (git hosts warn there and reject past 100 MB): full-resolution 16:9 and 9:16
   masters have the same pixel count, and `--crf 24` runs about 8 MB per two minutes here, so this is easy to honour. Anything larger ships as text plus the rebuild
   command in `NOTES.md`.
2. Always record in `NOTES.md`:
   - the master's path, byte size and `sha256sum`;
   - the exact render command that produced it;
   - the episode spec it came from (path + commit);
   - `voice_backend` actually used (not the voices requested).
3. Never edit a report by hand — copy it from the render output verbatim.

## Producing the text set

```bash
FILM=your-film-slug
ASPECT=16x9                              # use 9x16 for portrait
OUT="deliverables/$FILM"
MASTER="runtime/renders/final_film_${ASPECT}.mp4"
STEM=${MASTER%.mp4}
mkdir -p "$OUT"
cp "$MASTER"                           "$OUT/the_${FILM}_${ASPECT}.mp4"  # optional, <50 MB
cp "${STEM}_chapters.txt"               "$OUT/chapters.txt"
cp "${STEM}_report.json"                 "$OUT/report.json"
cp "${STEM}_validation_report.json"      "$OUT/validation.json"
cp "${STEM}_visual_audio_cues.json"      "$OUT/cues.json"
python3 universal_toolbook/tools/build_storyboard_svg.py "$MASTER" --out "$OUT/storyboard.svg"
sha256sum "$MASTER"
```

## Getting the actual video to a human, in order of reliability

1. **Open the file in this repo.** `deliverables/two_inch_bridge_cel/the_two_inch_bridge_1080p.mp4`
   is 7.9 MB, so a git host renders or downloads it directly — no rebuild, no server.
2. **Rebuild it.** `python3 universal_toolbook/run_studio.py render <episode>.json --out <path>.mp4 --full
   --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto` — always works,
   no transfer involved.
3. **Serve it.** `python3 universal_toolbook/tools/serve_deliverables.py 8000 runtime/renders`,
   open the preview from inside the app (not a raw URL in an external tab). Range requests are
   supported, so seeking and downloads work.
4. **Wrap it.** `python3 universal_toolbook/run_studio.py player runtime/renders/final_film_16x9.mp4 --out runtime/renders/player.html`.
5. **Show the SVG storyboard** above — it renders where video is refused.
6. If none of those reach the reader, the text set in this folder plus the rebuild command is
   the deliverable.

## Historical note

Archived reports in this repository may quote the pre-2026-11-09 `output/`, `work/`, `cache/`
and `docs/production-workflow/` paths. Those strings are preserved as evidence of the original
run, not as current commands. `tools/check_docs.py` resolves them through its explicit historical
alias map; new procedures use `runtime/`, `projects/`, `deliverables/` and `docs/production/`.
