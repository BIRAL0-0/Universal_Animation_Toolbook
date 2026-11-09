# TOOLS AND MODELS — the complete inventory

**Status: IMPLEMENTED.** Everything below exists in this repository and was verified here.
Nothing on this page is planned — for that, see [`FUTURE_DEVELOPMENT.md`](FUTURE_DEVELOPMENT.md).

---

## 1. AI models & external services actually used

| Model / service | Used for | Access | Notes |
| --- | --- | --- | --- |
| **Edge/Azure neural TTS** (via the `edge-tts` Python library) | Voiceover (cloud) | No API key; endpoint `speech.platform.bing.com:443` | Word-boundary timestamps. Unreachable in restricted sandboxes — the per-line fallback below is the designed path. |
| **Piper** (`piper-tts` + `.onnx` voice models) | Voiceover (offline) | Local models in `PIPER_VOICE_DIR` → `~/.cache/piper_voices` → `assets/voices/` | 3 default voices (ryan/amy/alan, all English medium). Fetched by `universal_toolbook/tools/fetch_piper_voices.py` from Hugging Face, a GitHub mirror, or a local directory. |
| **espeak-ng** (optional, OS TTS) | Last-resort voiceover | System binary | Robotic; `--voice offline`. |
| **Node canvas backends** — `@napi-rs/canvas` **or** `node-canvas` | Frame drawing | npm (`optionalDependencies` in `universal_toolbook/package.json`) | `universal_toolbook/engine/canvas_backend.js` picks whichever resolves; neither requires the other. |
| **ffmpeg** (via `imageio-ffmpeg`) | Encoding, concat, mux | pip wheel bundles the binary | No system ffmpeg needed. |
| **The directing AI** — a human or an AI coding agent operating this repository | Stages 1–7, 9, 13 (research, writing, authoring, prep) | — | There is **no LLM API call inside the engine.** The "AI" of this pipeline is the agent following the docs; the engine itself is deterministic code. |

**Deliberately absent (do not assume):** no image-generation model, no video-generation
model, no voice-cloning, no music-generation model, no YouTube/Google APIs, no analytics
API. Music is a fixed CC catalog (+ user-supplied files); "generation" of visuals is
deterministic rendering of the episode spec.

## 2. The CLI surface (the one command you type)

`python3 universal_toolbook/run_studio.py <subcommand>`:

| Subcommand | What it does | Key flags |
| --- | --- | --- |
| `check` | Environment probe: node, canvas backend, ffmpeg, fonts, BGM count, edge-tts library, offline-voice readiness; auto-installs what it can | — |
| `bgm-list` | Lists bundled CC tracks (id, moods, keywords, licence, source) | — |
| `validate` | Compiles the spec; prints duration, scenes, settings, sound events, **warnings**; optional verbatim-script fidelity | `--script <file>` |
| `stills` | Full-resolution PNG per scene for visual QA | `--out-dir`, `--width`, `--height`, `--limit` |
| `render` | The whole Stage 8–11 pipeline (voice → retiming → chunks → mix → mux → reports) | see [`VIDEO_ASSEMBLY.md`](VIDEO_ASSEMBLY.md) §11.4 |
| `player` | Self-contained HTML5 player + download wrapper (re-encodes large masters to fit) | `--out`, `--max-mb` |

## 3. Kit helper tools (`universal_toolbook/tools/`)

| Tool | Purpose | When |
| --- | --- | --- |
| `fetch_piper_voices.py` | `check` / `install` offline voices (Hugging Face, `--github`, `--from-dir`, `--dry-run`) | Setup; when more than 3 voices are needed |
| `script_helper.py` | `parse` (raw script → beat-aligned scene skeleton + duration estimate + BGM rec) and `verify` (token-level script fidelity) | Stages 5–6 |
| `serve_deliverables.py` | Range-capable (206) static file server for handing over a master | Delivery |
| `build_storyboard_svg.py` | Master → self-contained animated SVG (stills + captions + cross-fades; text-only delivery) | Delivery where video is refused |

## 4. Dev/QA tools (repository root `tools/`)

| Tool | Purpose | When |
| --- | --- | --- |
| `check_docs.py` | Verifies every repository path quoted in every markdown doc resolves (CI-enforced) | Every docs change; CI |
| `check_workflows.py` | Lints `.github/workflows/*.yml` (CI-enforced) | Workflow edits; CI |
| `validate_specs.py` | Validates template + every `examples/` spec, fails on warnings | CI; after engine changes |
| `audio_report.py` | Measures the finished mix from PCM: peak, loudness, narration-vs-bed separation, silence gaps, clipping (`<master_audio.wav> <vo_manifest.json>`) | Stage 12 |
| `subtitle_check.py` | Three sync checks against the compiled episode + voice manifest (`<work_dir>`; verdict PASS/FAIL) | Stage 12 |
| `mix_probe.py` | Narration-vs-bed separation without rendering any video (`<episode.json> <work_dir>`; verdict PASS/RECHECK) | Tuning `bgm_gain` |
| `make_poster.js` | 1920×1080 poster from a real hero frame + stills contact sheet, in house style | Stage 13 (thumbnail source) |
| `serve_downloads.py` | Threaded, Range-capable download server for `downloads/` | Delivery |
| `build_wall_episode.py` | Worked example of **programmatic episode authoring** — one constants table emits the full JSON (landscape + portrait re-blocks) | Template for building a film from numbers instead of hand-JSON |

## 5. Engine components (`universal_toolbook/engine/`)

| Module | Role in the pipeline |
| --- | --- |
| `voice_engine.py` | Stage 8–10: TTS backends + fallback, dead-air compaction, word timings, speech-locked alignment, scene stitching |
| `episode.js` | Timeline compile: beats → tracks, retiming, cue resolution, `formatYouTubeChapters` |
| `video_renderer.js` | Frame compositor: aspect-preserving output, camera, z-order, boards, subtitles |
| `character_rig.js` | Bodies, faces, hair, accessories, IK, walk cycles |
| `motion_library.js` | The 60 actions |
| `environments.js` | 12 preset rooms + parametric settings |
| `world_props_and_boards.js` | Props, vehicles, every board type (`SUPPORTED_PROPS` registry) |
| `parchment_ink_style.js` | The ink-on-paper style (dispatches project set extensions) |
| `beacon_harbor.js`, `impossible_wall.js` | Project-specific set extensions (pattern examples for new sets) |
| `portrait_framing.js` | 9:16 subject-aware crop, safe-area board placement, group zoom |
| `render_layout.js` | Shared output geometry / viewport / text-fit helpers |
| `canvas_backend.js` | node-canvas ↔ @napi-rs/canvas shim |
| `font.js` | Poppins loading, text metrics |
| `audio_mixer.py` | Stage 11: BGM + ambience + foley + narration → `master_audio.wav`; mux |
| `bgm_library.py` | CC catalog, mood scoring, seamless looping, credits |

## 6. Tests & CI

| Item | Covers |
| --- | --- |
| `tests/run_all_tests.js` | 60 actions, 12 hairstyles, 18 accessories, 12 presets, dual-actor IK (0 px bone stretch, 0 px foot slip), subtitle glow, dual-actor builds |
| `tests/test_studio_pipeline.py` | Pipeline + speech-lock behaviour (Python side) |
| `tests/fixtures/` | Minimal schema specs the JS suite loads |
| `.github/workflows/verify.yml` | Four jobs: **docs** (paths resolve, workflows lint), **specs** (every spec validates), **engine-tests** (both suites), **render-smoke** (stills + silent draft + the "voiceless render must fail loudly" test) |

## 7. Configuration files

| File | What it sets |
| --- | --- |
| `universal_toolbook/config/studio_config.json` | `fps: 30`, `width` + `height`: 1920×1080, `film_grain: false`, `subtitles_default: "cinema"`, `bgm_default: "auto"`, `voice_default`, `channel_name` |
| `universal_toolbook/assets/bgm/BGM_CATALOG.json` | The 7 CC tracks: id, moods, keywords, licence, source URL |
| `universal_toolbook/requirements.txt` | Python deps: numpy, imageio-ffmpeg, edge-tts (piper-tts added separately for offline) |
| `universal_toolbook/package.json` | `@napi-rs/canvas` + `canvas` as optionalDependencies |
| Environment variables | `PIPER_VOICE_DIR` (voice model dir override), `NODE_PATH` (only when node_modules lives outside the kit) |

Full setup: [`CONFIGURATION_AND_SETUP.md`](CONFIGURATION_AND_SETUP.md).
