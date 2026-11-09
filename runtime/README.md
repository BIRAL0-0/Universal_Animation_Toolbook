# runtime/ — git-ignored temporary workspace

This is the **only** place for generated, regenerable files. Everything under this directory except
this README is ignored by [`.gitignore`](../.gitignore) and must never be committed.

| Subdirectory | Contents |
|---|---|
| `cache/` | downloaded TTS weights and voices (`cache/tts/` is a legacy alias; the current `setup_tts.py` and `tts/config/voices.json` use `runtime/cache/tts/`), temporary downloads |
| `work/` | authoring scratch (`episode.json` drafts, scene plans, temporary scripts) |
| `renders/` | draft and master MP4s, `*_report.json`, `*_validation_report.json`, `*_visual_audio_cues.json`, chapters, chunk caches |
| `previews/` | QA stills and extracted review frames |
| `logs/` | run logs, benchmark output, diagnostics |

Create the tree on a fresh checkout:

```bash
mkdir -p runtime/cache runtime/work runtime/renders runtime/previews runtime/logs
```

The engine resolves output paths from the current working directory, so pass an explicit path:

```bash
python3 universal_toolbook/run_studio.py stills universal_toolbook/templates/episode_minimal.json \
    --out-dir runtime/previews/minimal --width 1920 --height 1080
python3 universal_toolbook/run_studio.py render universal_toolbook/templates/episode_minimal.json \
    --out runtime/renders/minimal.mp4 --draft --voice auto --workers 2 --chunk-sec 20
```

Durable products do **not** stay here: a finished video and its reports belong in its
[`projects/<slug>/`](../projects/) folder; release packages and benchmark evidence belong in
[`deliverables/`](../deliverables/README.md). `tools/validate_structure.py` fails if tracked files
appear in this tree or generated media appears in a source directory.

Legacy roots `output/`, `work/`, `.work_*/` and `cache/` remain ignored for backwards
compatibility with historical documents, but new commands and documentation use `runtime/`.
