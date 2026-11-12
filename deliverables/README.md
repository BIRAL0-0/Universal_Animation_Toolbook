# Deliverables

This is the **only** repository location for durable, distributable artifacts. Temporary renders,
stills, caches and logs belong in the git-ignored [`runtime/`](../runtime/README.md); per-video
source and QA evidence live in [`projects/`](../projects/).

| Path | What it is |
|---|---|
| [`RESULTS.md`](RESULTS.md) | the durable-results convention: one folder per finished film, text mirrors of chapters/reports/cues/validation, optional master MP4, `NOTES.md` with SHA-256 and exact rebuild command |
| [`releases/`](releases/) | finished ZIP packages: `discipline_vs_obsession_release.zip`, `the_wall_you_agreed_with_1080x1920.zip`, `video-001_RELEASE.zip`, `video-003-first-plank_RELEASE.zip` |
| [`universal_animation_toolbook_tts.zip`](universal_animation_toolbook_tts.zip) | the 2026-11-03/09 self-hosted TTS source deliverable (repository minus heavy runtime artifacts) |
| [`tts_benchmark/`](tts_benchmark/README.md) | committed MP3 listening samples for 16 Kokoro/Piper voices, with attribution |
| [`two_inch_bridge_cel/`](two_inch_bridge_cel/NOTES.md) | a complete shipped master MP4 plus chapters, report, validation, cues, SVG storyboard and measured notes |
| [`video-003-first-plank/`](video-003-first-plank/NOTES.md) | "The First Plank": primary 9:16 master, text mirrors, poster, SVG storyboard, authoring set and QA sign-off; 16:9 master and full ZIP in `releases/` |
| [`the_wall_you_agreed_with/`](the_wall_you_agreed_with/index.html) | historical hand-off page plus real MP4, ZIP and poster files; the earlier broken symlinks were replaced with byte-identical release assets, and the package is also in `releases/` |

## TTS source ZIP (historical)

Mission 1 added the Kokoro/Piper/Edge subsystem; mission 2 added 44 selectable Kokoro voices,
`am_michael` as the primary default, Piper `length_scale` support and the voice comparison report.
The ZIP intentionally excludes downloaded model weights (~242 MB), past films, generated renders,
`.venv` and `node_modules`.

Full details and the fresh-machine verification commands are in
[`docs/production/TTS_BENCHMARK.md`](../docs/production/TTS_BENCHMARK.md),
[`docs/production/TTS_VOICE_COMPARISON.md`](../docs/production/TTS_VOICE_COMPARISON.md) and
[`docs/getting-started/INSTALL.md`](../docs/getting-started/INSTALL.md).

## Verify a fresh machine

```bash
python3 -m venv .venv
.venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
.venv/bin/python universal_toolbook/setup_tts.py
.venv/bin/python universal_toolbook/run_studio.py check
python3 tools/validate_structure.py
```

## Rules

1. Do not commit generated QA frames, chunk caches, intermediate mixes or `.work_*` directories.
2. Keep the master under ~50 MB; anything larger ships as text results plus the rebuild command.
3. Never edit a report by hand; copy the renderer's output verbatim.
4. Record licence and attribution for every audio asset (see
   [`universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md`](../universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md)).
5. Historical evidence is relocated, never deleted. `two_inch_bridge_cel/report.json`,
   `chapters.txt`, `cues.json`, `validation.json`, the SVG storyboard and the master MP4 remain
   byte-for-byte unchanged; historical path strings inside those records are documented in
   `NOTES.md`. New delivery packages go here, not into source directories.
