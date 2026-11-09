# Validation report — 2026-11-09

This is the measured post-reorganization verification record. Commands were run from the
repository root with `.venv` Python 3.11.2 and Node v22.22.3; CI uses Python 3.11 / Node 20.
No claim of subjective audio listening or Kokoro voice synthesis is made here.

## Local gates (all exit 0)

| Gate | Result |
|---|---|
| `tools/validate_structure.py` | `STRUCTURE CHECK OK: 55 required files, 23 required dirs, 6 skills` |
| `tools/check_docs.py` | `DOCS CHECK OK: 1627 path references resolved across 107 markdown files` |
| `tools/check_workflows.py` | `WORKFLOW CHECK OK: 1 file(s), 5 job(s), 36 step(s)` |
| `tools/validate_specs.py` | `OK: all 11 spec(s) validated, warnings: []` |
| `universal_toolbook/run_studio.py check` | `status: OK`, 7 BGM tracks, `kokoro_ready: false`, `offline_voiceover_ready: false` |
| `node tests/regression/run_all_tests.js` | `js_tests: PASSED`, 60 actions, 7 builds, 12 hairstyles, 12 preset environments, zero bone stretch / foot slip |
| `tests/integration/test_studio_pipeline.py` | `py_tests: PASSED`, voice-failure diagnosis, 7 BGM tracks, exact word match, speech-locked board/camera |
| `pytest tests/unit tests/production -q` | `31 passed` |
| `python -m compileall` + `node --check` + JSON parse | all Python, JS and JSON files parsed |

## Production smoke

- `scripts/new_project.py` generated a temporary project in `runtime/work/`; `PROMPT.md` was
  saved first, all 14 required files and `assets/`, `audio/`, `renders/` existed, and a second
  invocation refused to overwrite.
- `tools/produce_video.py <temp-project> --stop-after stills` passed Stage A validate
  (`warnings: []`) and produced 9:16 and 16:9 stills.
- `run_studio.py stills` produced two 1920×1080 PNGs.
- A deliberate `--voice none` draft render produced `runtime/renders/reorg_smoke.mp4`:
  `COMPLETE`, 24 s, 960×540, 30 fps, 720 frames, `voiced: false`, `warnings: []`; the validation
  report was `valid: true`, `film_grain: false`, `warnings: []`.
- Four frames at 2/8/14/20 s were extracted and opened; two landscape stills and one portrait
  still were also opened. Seven images were visually inspected. No corruption was observed.
- The mixed WAV was measured with NumPy: 24.0 s, 44.1 kHz stereo, peak −10.9 dBFS,
  RMS −27.75 dBFS, 0 clipped samples. This is a measurement, not a listening test.

## Fresh-checkout and standalone kit

`scripts/verify_fresh_checkout.py` clones only committed files, checks out the exact HEAD commit,
creates a fresh venv, installs Python/Node dependencies, runs every gate, validates the kit from
inside its own copied folder, renders a silent draft, checks its validation report and extracts
one frame. On commit `a2d311c79aaf359b265de56eb8a9e789011a6b07` it returned `PASSED`: 16/16 steps
exit 0, `runtime/renders/fresh_checkout.mp4` was 1,793,346 bytes with 720 validated frames, and
`runtime/previews/fresh_checkout_frame.png` was extracted. The script explicitly reports that it
does not perform subjective visual review. `tests/unit/test_repository_structure.py` independently
copies `universal_toolbook/` to a temporary directory and runs `run_studio.py validate` there.

## CI

[`.github/workflows/verify.yml`](../../.github/workflows/verify.yml) has five jobs: structure/docs,
specs, engine/production tests, silent render smoke, and fresh checkout. YAML parsing is verified
locally by `tools/check_workflows.py`. {{GitHub Actions PR run `42666120250` passed all five checks: structure/docs (38 s), specs
(45 s), engine/production tests (43 s), render smoke (1 m 7 s) and fresh checkout (1 m 34 s).
All five jobs were observed with `gh pr checks 18 --watch`. A documentation-only follow-up commit
triggers the same workflow; its result is reported in the final delivery summary.}}

## What was NOT verified

- No Kokoro or Piper voice was synthesized; no voiced MP4 was produced.
- No human listened to the mix and no full film was watched end to end.
- No GitHub Actions run was claimed before its checks were observed.
- No Remotion runtime was installed or tested; no upstream skill files were copied.
