# Testing and validation

The authoritative command list is [`tests/README.md`](../../tests/README.md); CI is
[`.github/workflows/verify.yml`](../../.github/workflows/verify.yml). The measured 2026-11-09
results are in [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md). This page explains what each gate
proves and what it deliberately does not prove.

| Gate | Proves | Does not prove |
|---|---|---|
| `run_studio.py check` | Python/Node/ffmpeg, seven bundled BGM tracks, canvas backend, 60-frame draw smoke | Kokoro readiness (the `kokoro_ready` field is reported, not required on a fresh machine) |
| `tools/validate_structure.py` | required architecture files, skill map, no duplicate master prompt, no tracked runtime artifacts/media | visual quality |
| `tools/check_docs.py` | every quoted path and relative link resolves, including command targets and `file::symbol` claims | external URL availability |
| `tools/check_workflows.py` | CI YAML parses and has expected job/step counts | that GitHub Actions has run |
| `tools/validate_specs.py` | every episode spec validates | that a spec makes a good film |
| `node tests/regression/run_all_tests.js` | frame animation actions, builds, hairstyles, geometries and bone-stretch limits | browser playback |
| `tests/integration/test_studio_pipeline.py` | Python timing, exact word matching, BGM, silence compaction, speech-locked camera/board | neural voice model availability |
| `pytest tests/production tests/unit -q` | doc/hygiene/environment/structure contracts | subjective audio/visual review |
| silent draft render + validation report | ffmpeg encode path, frame count, clean render report, no grain and no unexpected warnings | voiceover, music sync or human-visible composition |
| `scripts/verify_fresh_checkout.py` | tracked-only copy initializes `runtime/`, resolves kit paths, validates specs and renders a silent draft | Kokoro weights (network-dependent) |

**Visual and audio review is separate.** The automated gates decode/validate frame counts and
measured WAV data; they do not watch the film or listen to it. A claim that visual or audio QA
passed requires actual frame inspection/listening and must cite the files reviewed. On a machine
without Kokoro/Piper weights, `kokoro_ready: false` and `offline_voiceover_ready: false` are
expected; `--voice none` is the only offline-valid smoke mode.

## Before changing shared components

Capture the baseline command outputs, make the change, then rerun every gate above. If one fails,
diagnose the root cause and fix it rather than weakening the assertion; document the failure and
recovery in [`docs/troubleshooting/INDEX.md`](../troubleshooting/INDEX.md) when it is likely to
recur.
