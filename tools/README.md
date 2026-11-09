# Development tools

These are repository-level developer utilities. The copyable production kit in
[`universal_toolbook/`](../universal_toolbook/README.md) must never import or require them; its
runtime entry point is `python3 universal_toolbook/run_studio.py`. Its own operational helpers
live under `universal_toolbook/tools/`.

| Tool | Responsibility |
|---|---|
| [`validate_structure.py`](validate_structure.py) | structure gate: required files/folders, tracked runtime artifacts, unexpected generated media, duplicate master prompts, valid project structure, skill references |
| [`check_docs.py`](check_docs.py) | every markdown path, command and relative link resolves; historical links may use its explicit alias map |
| [`check_workflows.py`](check_workflows.py) | CI workflow YAML parses and declares the expected jobs/steps |
| [`validate_specs.py`](validate_specs.py) | validates all episode JSON specs (kit template, examples and historical projects) |
| [`produce_video.py`](produce_video.py) | end-to-end project producer; see [`docs/production/COMPLETE_WORKFLOW.md`](../docs/production/COMPLETE_WORKFLOW.md) |
| [`make_scene_plan.py`](make_scene_plan.py) | derives a scene plan from a script |
| [`serve_downloads.py`](serve_downloads.py) | local HTTP server with Range support for a delivery folder |
| [`audio_report.py`](audio_report.py) | measured WAV loudness/peak report |
| [`audio_report.py`](audio_report.py), [`mix_probe.py`](mix_probe.py), [`subtitle_check.py`](subtitle_check.py) | measured WAV loudness, mix and caption diagnostics |
| [`build_wall_episode.py`](build_wall_episode.py), [`make_poster.js`](make_poster.js), [`make_scene_plan.py`](make_scene_plan.py) | one-off episode, poster and scene-plan builders |

CI invokes the first four plus the engine/render suites; see
[`.github/workflows/verify.yml`](../.github/workflows/verify.yml) and
[`tests/README.md`](../tests/README.md).
