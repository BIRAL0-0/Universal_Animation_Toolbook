# process/ — the kit's technical production procedure

These pages are **film-agnostic**: they describe how to turn any script into a finished 16:9 or
9:16 MP4 with this engine. They are part of the copyable kit. The complete agent workflow
(research, per-video prompt, script polishing, project archive, QA sign-off and self-healing) is
repository-level knowledge: [`../../AGENTS.md`](../../AGENTS.md) and
[`../../skills/animation-production/SKILL.md`](../../skills/animation-production/SKILL.md).
Detailed 13-stage content-operation documentation lives at
[`../../docs/production/INDEX.md`](../../docs/production/INDEX.md); architecture at
[`../../docs/architecture/SYSTEM_OVERVIEW.md`](../../docs/architecture/SYSTEM_OVERVIEW.md).

| # | File | Read it when |
|---|---|---|
| 01 | [`01_INTAKE.md`](01_INTAKE.md) | You have a script and must turn it into scenes, timing and a cast. |
| 02 | [`02_AUTHORING_EPISODE_JSON.md`](02_AUTHORING_EPISODE_JSON.md) | You are writing `episode.json`. |
| 03 | [`03_RENDER_PIPELINE.md`](03_RENDER_PIPELINE.md) | You are ready to run commands. |
| 04 | [`04_VISUAL_GEOMETRY.md`](04_VISUAL_GEOMETRY.md) | Something overlaps, clips, or sits in the wrong place. |
| 05 | [`05_AUDIO.md`](05_AUDIO.md) | Voices, pacing, BGM, foley, or the audio sounds wrong. |
| 06 | [`06_QA_GATE.md`](06_QA_GATE.md) | Before you call anything finished. |
| 07 | [`07_TROUBLESHOOTING.md`](07_TROUBLESHOOTING.md) | A command failed or a render looks broken. |
| 08 | [`08_LIMITS.md`](08_LIMITS.md) | You are about to promise something the engine cannot do. |

Reference material in the kit: [`../01_TOOLBOOK_REFERENCE.md`](../01_TOOLBOOK_REFERENCE.md) (full
schema), [`../templates/episode_minimal.json`](../templates/episode_minimal.json) (runnable
skeleton), [`../README.md`](../README.md) (CLI and capabilities). In the full repository,
[`../../examples/`](../../examples/) holds complete reference specs and
[`../../tests/README.md`](../../tests/README.md) explains the regression suites.

The engine resolves its own `engine/`, `assets/`, `config/`, `templates/` and `tools/` relative to
`run_studio.py`. Commands below are written from the repository root; `cd universal_toolbook` and
drop the prefix if you prefer, or copy the folder elsewhere entirely.

## The pipeline in seven lines

```bash
python3 universal_toolbook/run_studio.py check
cp universal_toolbook/templates/episode_minimal.json runtime/work/episode.json
python3 universal_toolbook/run_studio.py validate runtime/work/episode.json
python3 universal_toolbook/run_studio.py stills runtime/work/episode.json --out-dir runtime/previews/stills_16x9 --width 1920 --height 1080
python3 universal_toolbook/run_studio.py render runtime/work/episode.json --aspect-ratio 16:9 --out runtime/renders/draft.mp4 --draft --voice auto
python3 universal_toolbook/run_studio.py stills runtime/work/episode.json --out-dir runtime/previews/stills_9x16 --width 1080 --height 1920
python3 universal_toolbook/run_studio.py render runtime/work/episode.json --aspect-ratio 16:9 --out runtime/renders/final_16x9.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

The loop that matters is **stills → look → fix → stills**, at the target aspect ratio. Rendering
the master is the last 10 % of the work. `--short-form` gates 40–90 s independently of aspect;
`--shorts` selects 9:16 and allows up to 180 s.

## Ground rules

1. Never declare a render finished without opening frames from it.
2. `validate` must show `warnings: []`.
3. Grain stays off; output is zero-grain.
4. `voiced: true` is required; `COMPLETE_SILENT` / exit 3 is a failure.
5. Never overwrite a previous master — new filename, and say so.
6. Keep generated files in `runtime/`; only source and durable deliverables belong in git.
7. Report only numbers that came out of a file the run produced.
8. Shared defects are fixed in the engine with a regression test, never patched per video.

When a change affects the documented pipeline, update the relevant skill, template, doc and
[`../../CHANGELOG.md`](../../CHANGELOG.md) in the same task, then run
`python3 tools/check_docs.py` from the repository root.
