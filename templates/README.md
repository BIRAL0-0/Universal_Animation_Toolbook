# Templates

| File | Authority |
|---|---|
| [`MASTER_VIDEO_PRODUCTION_PROMPT.md`](MASTER_VIDEO_PRODUCTION_PROMPT.md) | **the only** master per-video production prompt. Copy into a new `projects/<slug>/PROMPT.md` and save it before production. |
| [`VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md`](VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md) | authoritative project archive checklist, enforced by `tests/production/test_repo_hygiene.py`. |
| [`VIDEO_PROJECT_TEMPLATE/README.md`](VIDEO_PROJECT_TEMPLATE/README.md) | how `scripts/new_project.py` uses the skeleton. |
| `universal_toolbook/templates/episode_minimal.json` | runtime episode skeleton inside the copyable kit (not a duplicate of this master prompt). |

The immutable English voiceover polish standard is not a template: it lives at
[`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](../docs/production/prompts/VOICEOVER_POLISH_PROMPT.md).
Agent rules live in [`AGENTS.md`](../AGENTS.md); procedures live in
[`skills/`](../skills/README.md). Do not create a second master prompt or a second per-video
instruction set.
