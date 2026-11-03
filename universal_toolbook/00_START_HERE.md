# Universal Animation Toolbook v3 (16:9 Landscape & 9:16 Portrait Video Engine)

A clean, modular, AI-agnostic animation and audio production engine designed to run inside **any AI coding/agent workspace** or locally via **Node.js + Python**.

Provide **any AI** with:
1. `Universal_Animation_Toolbook.zip`
2. The prompt in `MASTER_PROMPT.md`
3. Your script or story topic

The AI autonomously designs **custom characters (with hairstyles, articulated hands, grounded shoes, and biomechanical posture)**, **unified z-depth environments & furniture/vehicle occlusion**, **speech-locked 2D camera cuts & visual charts**, **multi-cast neural voiceover with dead-air compaction**, **non-flickering glowing subtitles**, **sidechain-ducked Creative Commons BGM**, and **synchronized foley SFX**, rendering a **zero-grain `1920x1080` landscape or `1080x1920` portrait (`30 fps`) `.mp4`**. Portrait output uses subject-aware framing and safe-zone layout; it never stretches the art.

---

## Core V3 Capabilities

- **Dual Visual Style Engines**:
  1. **Atmospheric Cinema Cel Style (`style: "cel"` / `"glossy"` / `"flat"`)** — Expressive characters with curved thoracic spine posture (`-1.0..+1.0`), tapered limbs, articulated wrists & expressive hands (`relaxed`, `open`, `point`, `fist`, `grip`, `clasp`, `embrace`), grounded shoes with heel-toe roll, 12 hairstyles (`hair`, `hair_color`), neck/ear/nose/iris/catchlight micro-details, 7 body builds, and 18 accessories.
  2. **Warm Parchment & Hand-Inked Stick Style (`parchment_*` backdrops or `style: "parchment"`)** — Aged cream/kraft paper canvas with soft sepia vignette, curved-spine charcoal-ink stick figures with forearm-aligned hands + thumb loops, pitched shoes, expressive cartoon acting, and bold black + crimson typography.
- **Unified Z-Depth Occlusion & Dual-Actor Choreography (60 Actions)**:
  - **Paired World-Space Interactions**: Standing `hug` & `hug_kneel` render via 3-pass interleaved limb occlusion (`back_arm -> bodies -> front_arm`); `handshake`, `high_five`, and `handoff` lock palms to the exact world-space midpoint; listeners naturally track the active speaker's eye-line.
  - **Automatic Two-Plane Furniture Occlusion**: Seated/lectern characters (`desk`, `clean_desk`, `messy_desk`, `cafe_table`, `judge_table`, `podium`) automatically tuck knees/thighs behind tabletops while rendering typing/gesturing hands cleanly on top of the surface.
  - **Multi-Lane Moving Vehicles**: `passing_car` and `passing_bus` support `lane: "back" | "front"` (or numeric `z`) to sweep behind or in front of sidewalk characters with rotating wheel spokes and headlights.
  - **Biomechanical Locomotion**: Directional `walk`, true airborne `run` (`airLift`), tread-locked IK `climb_stairs` / `descend_stairs`, 4-phase `jump`, `trip_stumble`, and `fall_down` (`0.000px` bone stretch, `0.000px` stance foot slip).
- **Natural Voice Pacing, Speech-Locked Boards & Speech-Locked Camera Cuts**:
  - `voice_engine.py` synthesizes multi-cast `edge-tts` dialogue at crisp conversational pace (`+2%` default), compacts sluggish mid-sentence TTS silences while preserving exact `WordBoundary` sync, and snaps both `board` (`cue_on` / `hide_on` / smart auto-hide) and `camera_shots` (`cue_on` / `end_on`) to exact spoken phrases.
- **Non-Flickering Cinema Subtitles & Multi-Word Keyword Highlights**:
  - Supports single-word and **multi-word phrase** `accent_words` (`"9 PM"`, `"no excuses"`), clean speaker pill badges (`DANIEL:`), gap-bridged active-word golden/accent glow capsules (zero `strokeText` smear, zero inter-word strobe), and persistent keyword underlines.
- **Bundled Creative Commons BGM Library (`assets/bgm/`)**: 7 normalized stereo MP3 tracks (`CC0` & `CC BY 4.0`) with automatic mood scoring, dynamic multi-act switching, and automatic license attribution in `*_chapters.txt`.
- **Offline Neural Fallback Voiceover (`piper-tts`)**: when the Edge neural endpoint is unreachable (air-gapped sandbox, CI runner, offline edit bay) any line the cloud backend cannot voice is synthesized locally by Piper from `.onnx` voices, with syllable-weighted word timings snapped to real silence→voicing transitions so glowing subtitles, lip-sync and board `cue_on` snaps stay locked. Edge voice ids map automatically (`en-US-GuyNeural` → `en_US-ryan-medium`, `en-US-JennyNeural` → `en_US-amy-medium`, `en-US-ChristopherNeural` → `en_GB-alan-medium`).
- **Portable Canvas Backend**: renders through `node-canvas` **or** `@napi-rs/canvas` (`engine/canvas_backend.js`), so a Cairo-free / slim container works with zero code changes (`npm install` now treats both as optional).
- **Screen-Space Graphics Boards**: in-world boards are clamped to safe zones in *screen* space, so they stay put and never clip off-frame while the 2.5D camera pushes and pans behind them.

---

## Quick CLI Commands

```bash
# 1. Verify Node, Python, fonts, FFmpeg, and bundled BGM tracks (auto-installs missing deps)
python3 universal_toolbook/run_studio.py check

# 2. List bundled Creative Commons BGM tracks & mood keywords
python3 universal_toolbook/run_studio.py bgm-list

# 3. Validate an episode JSON specification (and optional verbatim script match)
cp universal_toolbook/templates/episode_minimal.json work/episode.json
python3 universal_toolbook/run_studio.py validate work/episode.json

# 4. Render QA stills in the requested output aspect ratio before encoding
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_landscape --width 1920 --height 1080 --limit 8
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_portrait --width 1080 --height 1920 --limit 8

# 5. Render the long 16:9 landscape master @ 30fps (no short-form gate)
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out output/final_landscape.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume

# 5b. Render the short 9:16 portrait cut with the inclusive 40–90 s gate
python3 universal_toolbook/run_studio.py render work/short_episode.json --aspect-ratio 9:16 --short-form --out output/final_short_portrait.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume
# The generic gate does not choose an aspect ratio; --shorts selects 9:16 and allows any positive runtime up to 180 s.

# 6. Offline neural voices (only needed when the Edge endpoint is unreachable)
pip install piper-tts
python3 universal_toolbook/tools/fetch_piper_voices.py check
python3 universal_toolbook/tools/fetch_piper_voices.py install --from-dir /path/to/piper_voices

# 7. Reference films: complete episode specs to copy structure and pacing from
python3 universal_toolbook/run_studio.py validate examples/cel_two_inch_bridge_episode.json
python3 universal_toolbook/run_studio.py render examples/cel_two_inch_bridge_episode.json \
    --out output/final_film_16x9.mp4 --aspect-ratio 16:9 --full --preset veryfast --crf 24 \
    --chunk-sec 45 --workers 2 --resume --voice auto
```

Generic short-form targets 40–90 seconds, independently of aspect ratio. In this guide's example
pair, `--short-form` is combined with `--aspect-ratio 9:16` for the short portrait; the long
landscape master uses 16:9 without the duration gate. `--shorts` selects vertical 9:16 and accepts
any positive duration up to 180 seconds (3 minutes).

## Where to start a new film

`universal_toolbook/templates/episode_minimal.json` — a validated 2-scene episode that renders
as-is. Copy it to `work/episode.json`, replace the story, and build up from there.

## Reference films (`examples/`)

Complete, working specs — the fastest way to learn the pacing and JSON shape:

| Spec | Style | Shows |
| --- | --- | --- |
| `examples/cel_two_inch_bridge_episode.json` | cel | 8 scenes, notebook + stat boards, rain setting, speech-locked cuts |
| `examples/two_inch_bridge_episode.json` | parchment | 8 scenes, ink-stick cast, 7 backdrops, two-actor `handoff` |
| `examples/red_umbrella_episode.json` | cel | night-city weather, umbrellas, multi-character cast |
| `examples/discipline_vs_obsession_episode.json` | cel | long-form essay pacing, phone cards, per-act BGM |

See `01_TOOLBOOK_REFERENCE.md` for the complete V3 JSON specification.
