# First video

This page gives the shortest route from a fresh install to a rendered MP4. The authoritative agent
workflow is [`skills/animation-production/SKILL.md`](../../skills/animation-production/SKILL.md);
the mandatory rules are [`AGENTS.md`](../../AGENTS.md). Setup is
[`INSTALL.md`](INSTALL.md); the full CLI is
[`universal_toolbook/README.md`](../../universal_toolbook/README.md).

## 1. Verify the environment

```bash
python3 universal_toolbook/run_studio.py check
python3 tools/validate_structure.py
```

`status: OK` and a passing structure check are required. `kokoro_ready: true` is required for a
voiced render; otherwise follow `INSTALL.md`.

## 2. Render the smallest example (no project needed)

```bash
mkdir -p runtime/work runtime/renders runtime/previews
python3 universal_toolbook/run_studio.py validate universal_toolbook/templates/episode_minimal.json
python3 universal_toolbook/run_studio.py stills universal_toolbook/templates/episode_minimal.json \
    --out-dir runtime/previews/minimal --width 1920 --height 1080
python3 universal_toolbook/run_studio.py render universal_toolbook/templates/episode_minimal.json \
    --out runtime/renders/minimal.mp4 --draft --voice auto --workers 2 --chunk-sec 20
```

Open the PNG stills before encoding. Read `runtime/renders/minimal_report.json` and
`minimal_validation_report.json`: `voiced: true`, `warnings: []`, `film_grain: false`, 30 fps.
For a deliberately silent smoke test use `--voice none` and label the result as silent.

## 3. Start a real project

```bash
python3 scripts/new_project.py video-003-topic --title "Your title" --format "9:16" --runtime "60 s"
```

Customise and save `projects/video-003-topic/PROMPT.md` **before** production. Then follow the
20-stage workflow in the primary skill: research → polished script → storyboard → characters →
`episode.json` → `tools/make_scene_plan.py` → voice/music → stills → draft → master → QA.

```bash
python3 tools/make_scene_plan.py projects/video-003-topic
python3 universal_toolbook/run_studio.py validate projects/video-003-topic/episode.json
python3 tools/produce_video.py projects/video-003-topic
```

`tools/produce_video.py` runs ordered gates A–I, measures audio, extracts QA frames and writes
`qa_measurements.json`. It does **not** replace the creative stages or the required human/agent
review of stills and frames.

## 4. Where results go

- Project source, prompts, scripts, reports and `final.mp4`: `projects/<slug>/`.
- Temporary drafts, stills, caches and logs: `runtime/` (git-ignored).
- Durable release packages and benchmark evidence: `deliverables/`.
- Full stage documentation: [`docs/production/INDEX.md`](../production/INDEX.md).
- QA gate: [`skills/production-quality/SKILL.md`](../../skills/production-quality/SKILL.md).

Never overwrite an old project. New videos get new folders.
