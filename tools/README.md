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
| [`produce_video.py`](produce_video.py) | end-to-end project producer (stages A–J, ending with the publishing package); see [`docs/production/COMPLETE_WORKFLOW.md`](../docs/production/COMPLETE_WORKFLOW.md) |
| [`validate_publishing.py`](validate_publishing.py) | publishing gate: `videos/<slug>/` ships `<slug>.mp4` + `script.md` + `thumbnail.jpg` + `record.json`, platform-sized thumbnail, complete metadata, current index fingerprint, no temp files |
| [`package_video.py`](package_video.py) | assembles `videos/<slug>/` from a verified master plus approved script, designed thumbnail, description and pinned comment; applies the format policy, runs duplicate detection, then the publishing gate |
| [`make_thumbnail.py`](make_thumbnail.py) | crops/resizes generated base art to 1280×720 or 1080×1920 and typesets the minimal text overlay; inspection stays a manual step |
| [`make_scene_plan.py`](make_scene_plan.py) | derives a scene plan from a script |
| [`serve_downloads.py`](serve_downloads.py) | local HTTP server with Range support for a delivery folder |
| [`audio_report.py`](audio_report.py) | measured WAV loudness/peak report |
| [`audio_report.py`](audio_report.py), [`mix_probe.py`](mix_probe.py), [`subtitle_check.py`](subtitle_check.py) | measured WAV loudness, mix and caption diagnostics |
| [`build_wall_episode.py`](build_wall_episode.py), [`make_poster.js`](make_poster.js), [`make_scene_plan.py`](make_scene_plan.py) | one-off episode, poster and scene-plan builders |

CI invokes the first four plus the engine/render suites; see
[`.github/workflows/verify.yml`](../.github/workflows/verify.yml) and
[`tests/README.md`](../tests/README.md).
