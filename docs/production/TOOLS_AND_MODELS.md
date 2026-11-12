# TOOLS AND MODELS — the complete inventory

**Status: IMPLEMENTED.** Everything below exists in this repository and was verified here.
Nothing on this page is planned — for that, see [`../development/ROADMAP.md`](../development/ROADMAP.md).

---

## 1. AI models & external services actually used

| Model / service | Used for | Access | Notes |
| --- | --- | --- | --- |
| **Kokoro-82M** (int8 ONNX via `kokoro-onnx` / ONNX Runtime) — **default voiceover engine** | Voiceover (self-hosted, offline) | CPU, ~0.7 GB RAM; weights in `runtime/cache/tts/` (92.4 MB + 5.8 MB) | 11 voices, 24 kHz, completely free & local. Weights fetched from a pinned GitHub git-blob (Hugging Face and GitHub release assets are unreachable in this sandbox) — see `TTS_SETUP.md`. No native word boundaries in this export → energy-refined timings (see `TTS_ARCHITECTURE.md` §2). |
| **Edge/Azure neural TTS** (via the `edge-tts` Python library) | Voiceover (cloud, fallback only) | No API key; endpoint `speech.platform.bing.com:443` | Word-boundary timestamps. Not self-hosted / not guaranteed free; unreachable in restricted sandboxes, so it is no longer the default — retained behind `--voice edge`. |
| **Piper** (`piper-tts` + `.onnx` voice models) | Voiceover (offline, fast fallback) | Local models in `PIPER_VOICE_DIR` → `~/.cache/piper_voices` → `assets/voices/` | 2 default voices (ryan/alan, English medium). Fetched by `universal_toolbook/tools/fetch_piper_voices.py` from a GitHub mirror (default in this sandbox) or a local directory. Native phoneme alignments → real word timings. |
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
| `render` | The whole Stage 8–11 pipeline (voice → retiming → chunks → mix → mux → reports) | `--voice auto\|kokoro\|edge\|piper\|offline\|none` | see [`VIDEO_ASSEMBLY.md`](VIDEO_ASSEMBLY.md) §11.4 |
| `player` | Self-contained HTML5 player + download wrapper (re-encodes large masters to fit) | `--out`, `--max-mb` |

**Standalone TTS commands** (generate narration outside a render — see
[`TTS_SETUP.md`](TTS_SETUP.md)):

| Command | What it does |
| --- | --- |
| `python3 universal_toolbook/setup_tts.py [--check]` | One-time, idempotent setup: packages + Kokoro weights (SHA-256) + Piper voices + verify |
| `python3 universal_toolbook/generate_voiceover.py --input script.txt\|scenes.json [--voice V] [--engine kokoro\|piper\|edge] [--speed 1.0] [--out DIR]` | The single generation command: segments → per-segment WAV/MP3 + processed output in `final` + resumable `manifest.json` |
| `python3 universal_toolbook/process_audio.py <wav\|dir> [--resample-rate N] [--normalize-rms DB] [--limit DB]` | Reusable processing (resample/normalize/limit), originals preserved |
| `python3 universal_toolbook/validate_audio.py <wav\|dir\|job>` | Corruption / silence / clipping / duration / ordering checks |

## 3. Kit helper tools (`universal_toolbook/tools/`)

| Tool | Purpose | When |
| --- | --- | --- |
| `fetch_piper_voices.py` | `check` / `install` offline Piper voices (Hugging Face, `--github`, `--from-dir`, `--dry-run`) | Setup; when more Piper voices are needed (2 by default). Kokoro weights are handled by `setup_tts.py`, not this tool. |
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
| `serve_downloads.py` | Threaded, Range-capable download server for `deliverables/the_wall_you_agreed_with/` | Delivery |
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
| `beacon_harbor.js`, `impossible_wall.js`, `bamboo_grove.js` | Project-specific set extensions (pattern examples for new sets). `bamboo_grove.js` also shows a parametric backdrop staying inside the 9:16 crop. |
| `portrait_framing.js` | 9:16 subject-aware crop, safe-area board placement, group zoom |
| `render_layout.js` | Shared output geometry / viewport / text-fit helpers |
| `canvas_backend.js` | node-canvas ↔ @napi-rs/canvas shim |
| `font.js` | Poppins loading, text metrics |
| `audio_mixer.py` | Stage 11: BGM + ambience + foley + narration → `master_audio.wav`; mux |
| `bgm_library.py` | CC catalog, mood scoring, seamless looping, credits |

## 6. Tests & CI

| Item | Covers |
| --- | --- |
| `tests/regression/run_all_tests.js` | 60 actions, 12 hairstyles, 18 accessories, 12 presets, dual-actor IK (0 px bone stretch, 0 px foot slip), subtitle glow, dual-actor builds |
| `tests/integration/test_studio_pipeline.py` | Pipeline + speech-lock behaviour (Python side) |
| `tests/fixtures/` | Minimal schema specs the JS suite loads |
| `.github/workflows/verify.yml` | Four jobs: **docs** (paths resolve, workflows lint), **specs** (every spec validates), **engine-tests** (both suites), **render-smoke** (stills + silent draft + the "voiceless render must fail loudly" test) |

## 7. Configuration files

| File | What it sets |
| --- | --- |
| `universal_toolbook/config/studio_config.json` | `fps: 30`, `width` + `height`: 1920×1080, `film_grain: false`, `subtitles_default: "cinema"`, `bgm_default: "auto"`, `voice_default`, `channel_name` |
| `universal_toolbook/assets/bgm/BGM_CATALOG.json` | The 7 CC tracks: id, moods, keywords, licence, source URL |
| `universal_toolbook/requirements.txt` | Core Python deps: numpy, imageio-ffmpeg, edge-tts. The TTS extras (`kokoro-onnx`, `piper-tts[alignment]`) are installed by `setup_tts.py`, kept out of the core requirement so a checkout without TTS still works. |
| `universal_toolbook/package.json` | `@napi-rs/canvas` + `canvas` as optionalDependencies |
| `universal_toolbook/tts/config/voices.json` | TTS engine defaults, per-engine voice aliases, processing targets, segmentation pauses. The single source of truth for the TTS subsystem. |
| `universal_toolbook/tts/config/pronunciation_dictionary.json` | Token → spoken-spelling map (pronunciation only; approved text is never rewritten) |
| Environment variables | `PIPER_VOICE_DIR` (Piper voice dir override), `TTS_MODEL_DIR` (Kokoro weights dir override), `TTS_CONFIG` (alternate voices.json), `NODE_PATH` (only when node_modules lives outside the kit) |

Full setup: [`../getting-started/INSTALL.md`](../getting-started/INSTALL.md).
