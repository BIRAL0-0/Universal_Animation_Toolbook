# 07 — TROUBLESHOOTING

Every entry here was hit in practice. Symptom → cause → fix.

## Render / encode

**Render hangs or fails on the first line of dialogue**
Edge/Azure TTS is unreachable (`speech.platform.bing.com:443` refused). Use `--voice auto`
(or `--voice piper`). Check `python3 universal_toolbook/tools/fetch_piper_voices.py check` first; it should say
`offline_voiceover_ready: true` with ≥ 2 voices.

**The render finished fast but the film is silent (status `COMPLETE_SILENT`, exit 3)**
No backend synthesized anything: Piper and its `.onnx` voices are missing on this machine and
Edge is unreachable, so the engine wrote subtitles + music only. Read `"voice_diagnosis"` in
`<film>_report.json` — it names the missing package or model directory. Fix with
`pip install piper-tts` then `python3 universal_toolbook/tools/fetch_piper_voices.py install`
(add `--github <owner>/<repo> --github-path <dir>` when huggingface.co is unreachable but
github.com is not — see `05_AUDIO.md` for a concrete repository), and re-render. `--voice none` (intentional silence) and `--allow-silent` (accepted silence) are
the only ways a silent master reports `COMPLETE`.

**A re-render mixes old and new frames**
`--resume` is reusing chunks from a previous, different episode. Delete
`output/.work_<name>/` and render again.

**Render is far slower than the estimate**
Wrong preset (anything not `veryfast`), `--workers` > 2 on a 2-vCPU box, or `--chunk-sec` too
short (chunk setup dominates). Use `--preset veryfast --crf 24 --chunk-sec 45 --workers 2`.

**Draft `duration_sec` in chunk logs doesn't match the master duration**
Chunk logs report the *audio bed* length for the chunk's BGM slice, not the film duration.
Trust `final_film_1080p_validation_report.json` (`frames` × `fps`) instead.

## Visual

**Character renders in flat blue / no face**
`cast` entry is missing `color` (body colour) or `eyes: true`. Add both.

**Actor floats in a squat**
A seated-rig action (`head_in_hands`, `sketch_desk`, `sit_desk_type`, `gather_pages`) used on a
standing actor. Pass `"seated": false` or switch to a standing action. See `04_VISUAL_GEOMETRY.md`.

**Subtitle clipped at the right edge**
Both actors sit mid-frame and the line is long. Move the pair outward (0.42 / 0.68) and keep
lines ≤ 46 characters.

**Subtitle card covers the actors' legs**
Two-row card (a long line, or a one-word line merged with the next). Split the line, or rewrite
the one-word entry as a full sentence.

**Board never appears**
`cue_on` phrase is not spoken verbatim anywhere in the scene. Quote the dialogue exactly,
including punctuation-insensitive spelling. Verify at `cue_on + 1.5 s` in the draft.

**Board appears for only the last two seconds**
It is cued on the final phrase of the scene. Cue it on the line that motivates the graphic.

**Board is an empty translucent panel**
`build_dur` too long (keep ≤ 1.2) or you sampled before the build finished.

**Board collides with the chapter strip / name tags**
Wrong band: use `y: 104, h: 168`. `y: 74` hits the chapter card, `h: 210` hits the tags.

**Prop is missing**
Either it is behind an actor (move `x`, or set `z` positive) or the camera pushed it off-frame
(`focus_x` shifts the frame — a prop at `x: 0.075` can vanish under `focus_x: 0.36`).

**Everything is too dark / floor is pure black**
Add a backdrop/weather in the setting, or a prop that carries the room. `drawFloorBase` adds a
sheen and depth bands, but a scene with no set dressing still reads empty.

**Two characters look identical**
Same `build` + similar `color`. Vary build, `scale`, silhouette (coat/bag), and light vs dark.

## Audio

**Two characters sound the same**
Too few distinct voices, or `voice_backend` shows one model. Assign different voices/rates;
mix accents (US + GB).

**Words are clipped or overlaps feel rushed**
`pause_after` below 0.22 s, or lines too dense for the scene. Raise to 0.3 s and lengthen the
scene.

**Music drowns the narration**
`bgm_gain` above 0.92. Use 0.86–0.92.

**`ffmpeg -af volumedetect` prints nothing**
Known: it does not report in this build. Measure `master_audio.wav` with Python (`wave` +
`audioop`) — see `03_RENDER_PIPELINE.md`.

## Tooling / environment

**`pip install` refused (PEP 668)**
Use the project venv: `/home/user/.venv/bin/python`, not the system interpreter.

**`@napi-rs/canvas` errors on `toBuffer('raw')`**
Not supported in 1.0.13. The engine uses `toBuffer('image/png')` / the node-canvas path instead.

**`validate --help` throws an argparse traceback**
Cosmetic: the sub-parsers don't accept `--help`. Run without it; it validates normally.

**Delivery: viewer/dev preview can't show or download the MP4**
Handing a binary to a human is the hard part, not the render. In order of reliability:

1. `python3 universal_toolbook/tools/serve_deliverables.py 8000 output` — Range-capable (`206`) static server;
   open the page from inside the app, not from a raw URL in another browser tab.
2. `python3 universal_toolbook/run_studio.py player output/final_film_1080p.mp4 --out output/player.html` —
   self-contained HTML5 player with a download wrapper.
3. `python3 universal_toolbook/tools/build_storyboard_svg.py <master> --out outputs/storyboard.svg` — the film as
   a **text** SVG (stills + captions + cross-fades); renders where video is refused.
4. Write the text artifacts into `outputs/` so at minimum the chapters, report and cue sheet
   reach the reader, and state the rebuild command for the video.

Note: the Python stdlib `http.server` does **not** answer `Range` requests — video seeking and
some browsers fail against it. Use `universal_toolbook/tools/serve_deliverables.py`.
