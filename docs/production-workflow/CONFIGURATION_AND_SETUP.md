# CONFIGURATION AND SETUP

**Status: IMPLEMENTED.** Bootstrap commands are canon in
[`START_HERE.md`](../../START_HERE.md) §2 and
[`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md);
this page is the **configuration reference**: what exists, what it controls, what is
hardcoded, and what the environment constraints are. If the two disagree on a command,
`START_HERE.md` wins.

## 1. Bootstrap (once per machine)

```bash
python3 universal_toolbook/run_studio.py check      # expect: "status": "OK", 7 BGM tracks
npm install --prefix universal_toolbook             # canvas backend (@napi-rs/canvas or node-canvas)
pip install -r universal_toolbook/requirements.txt  # numpy, imageio-ffmpeg, edge-tts
python3 universal_toolbook/setup_tts.py             # TTS: packages + Kokoro weights + Piper voices + verify
python3 universal_toolbook/run_studio.py check      # now: kokoro_ready true, offline_voiceover_ready true
```

`setup_tts.py` is the **single TTS setup command**: it installs the TTS
packages, downloads the Kokoro-82M int8 weights (SHA-256 verified) into
`cache/tts/`, installs the default Piper voices from the GitHub mirror, and
synthesizes a one-line test per engine. It is idempotent — re-run it after any
session reset. Details: [`TTS_SETUP.md`](TTS_SETUP.md).

**PEP 668 (externally-managed Python).** Where `pip` refuses (Debian/Ubuntu system
Python), work in a venv — the repo's own documented path:

```bash
python3 -m venv .venv
.venv/bin/pip install -r universal_toolbook/requirements.txt
. .venv/bin/activate          # now every command in the docs works unchanged
```

**Offline voices (when the Edge endpoint is unreachable — the normal case in
sandboxes).** `setup_tts.py` does all of this automatically (Kokoro weights +
Piper voices). To manage Piper voices directly:

```bash
python3 universal_toolbook/tools/fetch_piper_voices.py check
python3 universal_toolbook/tools/fetch_piper_voices.py install
# alternatives: --github <owner>/<repo> --github-path <dir>  (github-only network — the sandbox default)
#               --from-dir /path/to/voices                   (offline copy)
# --dry-run prints the URLs it would fetch
```

After setup, `python3 universal_toolbook/run_studio.py check` must print
`"status": "OK"`. Read the fields:

| Field | Meaning |
| --- | --- |
| `bgm_tracks_available` | 7 expected (the bundled CC set) |
| `environment.node` / `python` | versions in use |
| `environment.ffmpeg` | resolved ffmpeg (the `imageio-ffmpeg` binary) |
| `environment.edge_tts` | the **library** is importable — *not* an endpoint probe; reachability is per-line at render time |
| `kokoro_ready` | the Kokoro package **and** weights are present ⇒ `--voice auto`/`kokoro` will narrate locally. false ⇒ run `setup_tts.py` before spending a render. |
| `offline_voiceover_ready` | Piper voices present ⇒ the offline fallback works. false ⇒ a render with `--voice auto` may be silent if Kokoro is also absent — install voices before spending a render |

## 2. Configuration surface (what is tunable)

### `universal_toolbook/config/studio_config.json` (engine defaults)

| Key | Value | Effect |
| --- | --- | --- |
| `fps` | 30 | The only frame rate; not exposed as a CLI flag |
| `width` / `height` | 1920 × 1080 | The authoring stage (portrait is a crop of it) |
| `film_grain` | false | Zero-grain by design; not exposed for enabling |
| `subtitles_default` | `"cinema"` | Per-render override: `--subtitles cinema\|off` |
| `bgm_default` | `"auto"` | Per-render override: `--bgm …` |
| `voice_default` | `am_michael` | Fallback voice when a speaker has none. Kokoro-first policy: Michael (`am_michael`) primary, Bella (`af_bella`) preferred secondary, other approved Kokoro voices when suitable, Piper only as last resort. Legacy Edge ids (`en-US-…Neural`) remain accepted for old examples only |
| `channel_name` | `""` | Watermark; leave empty for a clean frame |

### Episode-level (per film, in `episode.json`)

`style` (cel/parchment), `bgm`, `subtitles_mode`, `outro`, `channel_name`, `voices`
(per-speaker voice/rate/pitch), `cast` (the whole character system), per-scene
`bgm`/`bgm_gain` (0.86–0.92), `accent_color`, `lead_in`/`tail_out`, `min_duration`,
`portrait_focus`/`portrait_focus_x`, per-line `pause_after`/`pause_before`/`allow_long_pause`.
Complete field reference: [`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](../../universal_toolbook/01_TOOLBOOK_REFERENCE.md).

### Render flags

Full table in [`VIDEO_ASSEMBLY.md`](VIDEO_ASSEMBLY.md) §11.4. The documented master path:
`--full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto`.

### `universal_toolbook/tts/config/voices.json` (TTS subsystem)

| Key | Default | Effect |
| --- | --- | --- |
| `default_engine` | `kokoro` | Engine used by `generate_voiceover.py` when `--engine` is omitted |
| `engines.kokoro.model` / `.voices` | `cache/tts/kokoro.onnx` / `voices.npz` | Weight paths (override dir via `TTS_MODEL_DIR`) |
| `engines.kokoro.defaults` | voice `af_bella`, speed 1.0, pauses 0.25/0.10 | Per-call defaults |
| `engines.kokoro.aliases` | Edge-name → Kokoro voice map | How episode JSON voices resolve under Kokoro |
| `engines.piper.aliases` | Edge-name → Piper model map | Fallback resolution |
| `processing.*` | resample 44100, peak pre-pass −1.0, RMS −16.0, limit −0.5 | The audio-processing chain targets (see `TTS_ARCHITECTURE.md` §4) |
| `segmentation.*` | paragraph 0.6 s, sentence 0.25 s, clause 0.1 s, max 220 chars | How scripts are split and paced |

And `pronunciation_dictionary.json` (token → spoken spelling; see
`TTS_ARCHITECTURE.md` §5). Full operational detail: [`TTS_SETUP.md`](TTS_SETUP.md).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `PIPER_VOICE_DIR` | Piper voice-model directory override (resolution order: this → `~/.cache/piper_voices` → `assets/voices/`) |
| `TTS_MODEL_DIR` | Kokoro weights directory override (default `<repo>/cache/tts`) |
| `TTS_CONFIG` | Alternate TTS `voices.json` (default `universal_toolbook/tts/config/voices.json`) |
| `NODE_PATH` | Only when `node_modules` lives outside the kit (e.g., the beacon/wall rebuild notes) |

There are **no other** environment variables, no `.env` files, and no API keys anywhere in
this pipeline. Anything claiming otherwise is a documentation bug — file it as one.

## 3. What is NOT configurable (by design)

- Frame rate (30), grain (off), codec (H.264 + AAC), subtitle font (Poppins, bundled).
- Aspect set: 16:9 and 9:16 only in the CLI (no 1:1, 4:5, 4K — see
  [`universal_toolbook/process/08_LIMITS.md`](../../universal_toolbook/process/08_LIMITS.md)).
- The speech-driven retiming model: declared scene durations are plans; measured speech
  wins. There is no flag to make authored timing authoritative.

## 4. Environment constraints (measured, not assumed)

| Constraint | Consequence |
| --- | --- |
| Sandbox network is restricted (github.com, pypi.org, codeload reach only; huggingface.co & speech.platform.bing.com blocked) | **Kokoro is the standard voice path** (`--voice auto`/`kokoro`); its weights come from a pinned GitHub git-blob (release-asset CDN also blocked). Edge TTS is unreachable; Piper is the fast fallback. Full probe: [`ENVIRONMENT_REPORT.md`](ENVIRONMENT_REPORT.md). |
| `pip` PEP 668 on system Python | Use the venv (above) — never `--break-system-packages` |
| 2 vCPU / 3.8 GB RAM, no GPU | TTS is CPU-only ONNX (int8); `--workers 2`; more thrashes. Kokoro ≈ faster than realtime idle. Master ≈ 90 s per 2 min of film |
| `ffmpeg -af volumedetect` prints nothing in this build | Measure `master_audio.wav` with Python `wave` + `audioop` (the documented procedure in `universal_toolbook/process/03_RENDER_PIPELINE.md` §5 and `tools/audio_report.py`) |
| Disk | `node_modules` ~67 MB, Python env ~300 MB, Kokoro weights ~98 MB, 2 Piper voices ~126 MB, renders ~8 MB per 2 min |
| VPS/sandbox is temporary (nothing persists between sessions) | Re-run `setup_tts.py` (and rebuild the venv) after a reset; download the workspace to keep generated audio |
| `work/` and `output/` are git-ignored and absent from fresh clones | `mkdir -p work` before the first authoring step (a standing checklist item) |

## 5. Verifying a setup (and a machine migration)

```bash
python3 universal_toolbook/run_studio.py check                          # OK?
python3 tools/check_docs.py                                             # docs resolve?
python3 tools/validate_specs.py                                         # all specs clean?
node tests/run_all_tests.js                                             # engine healthy?
python3 tests/test_studio_pipeline.py                                   # pipeline healthy?
# prove the whole path end to end (silent by design — no voices needed):
python3 universal_toolbook/run_studio.py stills universal_toolbook/templates/episode_minimal.json \
  --out-dir work/stills --width 1920 --height 1080
python3 universal_toolbook/run_studio.py render universal_toolbook/templates/episode_minimal.json \
  --out /tmp/smoke/film.mp4 --draft --voice none --workers 2 --chunk-sec 20
# expect "status": "COMPLETE", "voiced": false (deliberate --voice none), warnings []
```

This is exactly what CI runs (`.github/workflows/verify.yml`) — a machine that passes
locally passes CI.
