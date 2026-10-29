# 08 — LIMITS: what this engine does and does not do

Read this before promising a client, a manager, or yourself something the renderer cannot
deliver. Numbers below are measured in this environment, not estimated.

## Output

| Property | Value | Changeable? |
| --- | --- | --- |
| Resolution | 1920×1080 | **No** — the compositor is written for 16:9 at this size |
| Frame rate | 30 fps | No |
| Container / codec | MP4, H.264 High + AAC 44.1 kHz stereo | Yes, via ffmpeg flags |
| Film grain | off (asserted by the test suite) | Not exposed — this build is zero-grain by design |
| Aspect ratios | 16:9 only | 9:16 / 1:1 / 4:5 are **not supported** |

## Length and pace

| Case | Scenes | Scene length | How it is made |
| --- | --- | --- | --- |
| **Short form (default)** | 6–10 | **10–20 s** | the target for `01_INTAKE.md`; ~1:40–2:10 finished |
| Long form | 8–9 | 40–75 s | possible; `examples/discipline_vs_obsession_episode.json` is 9 scenes / 520 s declared |
| Very long | — | — | not proven; render time scales linearly and chunk resume becomes essential |

Runtime is set by the **speech**, not by the declared `duration` field: scenes are retimed to
the generated audio. Plan on `words ÷ 2.5` seconds per line plus pauses, then add ~1.3 s per
scene for lead-in/tail-out.

Measured on this machine (2 vCPU, `--workers 2`):

| Pass | 2-minute film | 8.5-minute film |
| --- | --- | --- |
| `check` | 2 s | 2 s |
| `stills` | ~2 s | ~3 s |
| draft render (960×540) | ~50 s | (not attempted) |
| master (1080p, `veryfast`, `crf 24`) | ~90 s | scale linearly, expect ~7 min |

## Voice

- **Offline (Piper): 3 voices** are installed here — `en_US-ryan-medium`, `en_US-amy-medium`,
  `en_GB-alan-medium`. That means **at most three distinguishable speakers** without
  downloading more (`universal_toolbook/tools/fetch_piper_voices.py install`).
- **Edge/Azure neural voices are unreachable** in this environment. The JSON keeps the
  requested Edge names; `--voice auto` maps them onto the local models and reports the real
  backend in `voice_backend`.
- **English only** with the installed models. Other languages need a matching Piper voice.
- No singing, no voice cloning, no emotion tags beyond rate/pitch.
- One audio file per line: very long lines (60+ words) produce a long unbreakable subtitle.

## Visual

- **Two characters per scene** is the practical maximum; three collides constantly at 1920.
- **60 actions**, 12 hairstyles, 18 accessories, 12 preset environments plus parametric
  settings — enough for interiors, streets, weather, dawn/dusk, but no crowd scenes, no
  vehicles other than the `passing_car` / `passing_bus` props.
- **No 3D**: this is 2.5D — flat characters, layered depth (`z`), camera zoom/pan only. No
  rotation, no perspective change, no character walking away from camera.
- **Lip sync is amplitude-based**, not phoneme-based: it reads as "talking", not as precise
  mouth shapes.
- **Props are a fixed library.** A bespoke object must be drawn in
  `universal_toolbook/engine/world_props_and_boards.js` and registered in
  `SUPPORTED_PROPS`.
- Boards are **screen-space** and limited to the supported board types; they cannot be
  animated internally (no chart draw-on sequences beyond `build_dur`).

## Audio

- BGM is **7 bundled Creative Commons tracks**; anything else must be a local file path and
  licensed by you. Credits are generated from the tracks actually used.
- Foley is **derived from scene events**, not from an audio library you can drop files into.
- Mix targets: peak −3…−1 dBFS, RMS −16…−19 dBFS. There is no per-line ducking beyond the
  fixed `bgm_gain`.

## Environment

- Requires **Node ≥ 18** with either `canvas` or `@napi-rs/canvas`, Python ≥ 3.9, and
  `ffmpeg` (supplied by `imageio-ffmpeg`).
- Rendering is **CPU only**; there is no GPU path.
- Approximate disk: `node_modules` 67 MB, python env ~300 MB, voices 181 MB, renders ~8 MB
  per 2 minutes.

## Things a reader will reasonably ask for and will not get

| Request | Reality |
| --- | --- |
| Vertical / square cut | Not supported — 16:9 only |
| 4K | Not supported |
| A specific real person's likeness or voice | Not supported |
| Precise lip sync to a supplied audio file | Not supported — speech is generated, not ingested |
| Crowds, traffic, complex sets | Not supported without extending the prop/environment libraries |
| Live-action plates or photo compositing | Possible as a `setting` backdrop image, not as an integrated scene |
