# ENGINE NOTES — what changed for this run and why

Every edit below was made **after** looking at a rendered 1080p still or a draft frame that
showed the problem. Backups were taken to `/tmp/*.bak.<epoch>` before each edit.

---

## `engine/video_renderer.js` — subtitle lower-third lift

| | |
| --- | --- |
| Before | cel `centerY = 964 − (lines−1)*20` |
| After | cel `centerY = 930 − (lines−1)*20` |
| Why | One-row cards sat ~80 px too low; two-row cards clipped against the bottom safe edge on 1080. |

Parchment kept its own geometry, lifted the same way (`1002 → 962`, `*18`).

---

## `engine/environments.js` — three changes

### 1. `canyon_bridge` rebuilt (was a flat blue rectangle)

The chasm was a single `fillRect` with a gradient that got *lighter* toward camera, reading as
a blue band under the actors. Replaced with:

- jagged rock lips on both sides (seeded per-edge, so the cut never looks rectangular),
- depth gradient that is **darkest just under the far rim** and lifts only at the very bottom,
- a distant river thread deep in the gorge,
- rim light along both lips + a mist band pooling under the far edge,
- two suspension pylons with catenary cables and hangers, drawn *behind* the deck.

### 2. `drawFloorBase` — perspective floor sheen

Every cel scene ended in ~20 % of pure black under the cast. Added, clipped to the floor
rect: five depth bands, a vertical sheen fading from the floor line, and a wide radial pool
keyed to the trim colour. Keeps the lower third reading as ground, not as empty background.
This alone lifted S01/S02/S04/S05/S07 from "floating in a void" to "standing in a room".

### 3. (setting) S05 becomes a wet night road

`sky #071022 → #16304f`, `floor_color #132131` (was `#060a12`), `backdrop: mountains`,
`weather: rain`, two `streetlamp` props, `headlights`, `water_trail`. Previously the flood
scene was characters on black.

---

## `work/episode.json` — staging fixes (the bulk of the QA work)

1. **Subtitle overflow (S01).** Both actors sat at 0.30 / 0.68; a 55-character line ran under
   the right edge and clipped ("weeks." cut). Actors re-spaced and the line re-timed.
2. **Boards invisible or colliding.** Boards were sampled *before* their `cue_on` and placed
   at `y: 74, h: 210`, hitting the chapter strip and the name tags. Moved to
   `y: 104, h: 168` and `build_dur: 1.1`; the S02/S03/S04/S06/S07 panels are now clear of
   both.
3. **S06 pose bug.** `head_in_hands` defaulted to a *seated* rig on a standing actor, giving a
   floating squat. Swapped for `clench_fist`; the `books` prop (a rainbow stack that read as a
   chart) swapped for `framed_certificate`.
4. **S07 opener.** `sketch_desk` had the same seated-rig problem → `point_board`, facing the
   stat board.
5. **S05 set dressing** (see above) and **S08 backdrop** (park tree pulled inside the frame,
   signpost removed — it cropped to a bare pole).
6. **Short-line merge.** A one-word line ("Nothing.") merged with its neighbour into a
   two-row card that covered the actors' legs → rewritten as "The answer was nothing at all."
7. **Props visible through a moving camera.** A `wall_calendar` at `x: 0.075` was pushed
   off-frame by `focus_x: 0.36`; probe renders at 1080 located a working position
   (`x: 0.31, height_above_floor: 450, scale: 1.1`).

---

## `tools/serve_deliverables.py` (new)

The Python stdlib `http.server` does **not** answer `Range` requests, so no seek and no
reliable Safari playback. This is a ~120-line threaded static server that:

- serves a directory on `0.0.0.0:<port>` (preview proxies require `0.0.0.0`),
- answers `Range` with `206 Partial Content` + `Content-Range`,
- sets `video/mp4`, `image/*`, `text/*` types and `Accept-Ranges: bytes`.

Usage: `python3 tools/serve_deliverables.py 8000 output`.

---

## Known limits (do not re-litigate these)

- **Edge/Azure TTS is unreachable** from this sandbox (`speech.platform.bing.com:443`
  refused). `--voice auto` resolves the named Edge voices to local Piper models via an alias
  map. The render log's `voice_backend` confirms which voices actually ran.
- `@napi-rs/canvas@1.0.13` rejects `toBuffer('raw')` — do not try.
- PEP 668 blocks system pip; use `/home/user/.venv`.
- `ffmpeg -af volumedetect` prints nothing here — measure the master by parsing
  `master_audio.wav` with Python's `wave` + `audioop`.
- Large media (`*.mp4`, `*.gif`, `*.webm`) is git-ignored on purpose. Anything that must
  survive a chat transfer goes into `outputs/` as text, or gets regenerated from
  `work/episode.json`.
