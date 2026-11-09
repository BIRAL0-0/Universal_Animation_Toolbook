# AGENTS.md — mandatory instructions for autonomous agents

**This is the single authoritative rule set for this repository.** It replaces the former
operating-rules document, start page and kit-level session-prompt copies. Those remnants, where
present, are short redirects only. Permanent procedures live in
[`skills/`](skills/README.md); technical documentation lives in
[`docs/`](docs/architecture/SYSTEM_OVERVIEW.md).

Every session that touches this repository — including one whose only message is *"Create a new
video."* — is bound by these rules.

---

## 1. Repository architecture — one authoritative location per responsibility

| Location | Sole responsibility | Must not contain |
|---|---|---|
| [`universal_toolbook/`](universal_toolbook/README.md) | reusable, copyable production kit: CLI, JS renderer, Python audio/TTS, config, assets, schema, templates and kit-internal process docs | repository-level dev tools, project-specific files, generated renders |
| [`skills/`](skills/README.md) | permanent agent knowledge and procedures (6 skills) | runtime code, duplicate rules, copied framework documentation |
| [`AGENTS.md`](AGENTS.md) | rules, architecture boundaries, skill activation map | full procedures (link to skills instead) |
| [`templates/`](templates/README.md) | one master production prompt + project skeleton | per-video prompts |
| [`projects/`](projects/) | one independent folder per finished video, never overwritten | shared engine code |
| [`docs/`](docs/architecture/SYSTEM_OVERVIEW.md) | technical documentation: architecture, setup, development, production detail, troubleshooting, decisions | generated reports or per-video logs |
| [`examples/`](examples/) | complete, validated reference episode specs | generated media |
| [`tests/`](tests/README.md) | regression protection and fixtures | production output |
| [`tools/`](tools/README.md) | repository maintenance, validation and QA tools | engine runtime dependencies |
| [`scripts/`](scripts/README.md) | developer entry points: project creation, fresh-checkout verification | engine runtime dependencies |
| [`deliverables/`](deliverables/README.md) | finished distributable packages, benchmark evidence and durable text results | temporary renders |
| [`runtime/`](runtime/README.md) | **git-ignored** temporary workspace: `cache/`, `work/`, `renders/`, `previews/`, `logs/` | anything tracked except `runtime/README.md` |

**Boundary rule:** `universal_toolbook/` must remain copyable on its own. It resolves its own
`engine/`, `assets/`, `config/`, `templates/` and `tools/` relative to `run_studio.py`. It must
never import or execute anything from repository-level `tools/`, `scripts/`, `skills/`,
`tests/`, `projects/` or `docs/`. Skills are repository-level agent knowledge, **not** a runtime
dependency of the kit.

Main entry points: `universal_toolbook/run_studio.py` (production CLI),
`universal_toolbook/setup_tts.py` (one-time Kokoro setup),
`tools/produce_video.py` (ordered project gates), `scripts/new_project.py` (new project),
`tools/validate_structure.py` (repository validation). See
[`docs/architecture/DEPENDENCY_MAP.md`](docs/architecture/DEPENDENCY_MAP.md).

---

## 2. Skill activation map (mandatory)

A bare video request activates the **full workflow**, without the user restating the master prompt.

| Task | Required skill | File |
|---|---|---|
| Any video creation, animation, render or pipeline repair | **animation-production** (primary) + all relevant specialists | [`skills/animation-production/SKILL.md`](skills/animation-production/SKILL.md) |
| Discover a YouTube topic, research, fact-check | youtube-research | [`skills/youtube-research/SKILL.md`](skills/youtube-research/SKILL.md) |
| Create or improve a script, polish narration | scriptwriting | [`skills/scriptwriting/SKILL.md`](skills/scriptwriting/SKILL.md) |
| Design stickman characters, poses, actions, boards, camera | stickman-animation | [`skills/stickman-animation/SKILL.md`](skills/stickman-animation/SKILL.md) |
| Animate scenes, define timing and transitions | animation-production | [`skills/animation-production/SKILL.md`](skills/animation-production/SKILL.md) |
| Generate narration and mix audio | voiceover-audio | [`skills/voiceover-audio/SKILL.md`](skills/voiceover-audio/SKILL.md) |
| Render and inspect MP4, QA sign-off, error recovery | production-quality | [`skills/production-quality/SKILL.md`](skills/production-quality/SKILL.md) |

Read `AGENTS.md` → primary skill → relevant specialist skills → the linked technical docs. Do not
copy skill text into other instruction files. If a skill conflicts with a project file, the skill
and this file win; record the deviation in that project's `PRODUCTION_LOG.md`.

---

## 3. Automatic video creation mode

Any request to create, make, generate or produce a video — including *"Create a new video."*,
*"Make another one."*, a title, an idea, a complete script, or a reference video — activates the
20-stage workflow in
[`skills/animation-production/SKILL.md`](skills/animation-production/SKILL.md) §3. The user does
not need to repeat the master prompt or walk through stages.

**Classify the input first:**

| Case | Action |
|---|---|
| Only an idea | research topics, evaluate, select, title, script, then produce; do not wait for the user to pick a topic unless an essential decision genuinely needs them |
| Topic / title given | research *that subject*; preserve intent; improve the title only if meaning survives |
| Complete script | polish without changing meaning; flag meaning-changing edits; save original and polished |
| Reference video | analyse craft, then build an original concept; never copy a creator's video |
| "Another one" | reuse the established system, create a new independent project, never overwrite previous files |

Decide ordinary implementation decisions without interrupting the user (tool, scene split, render
method, sound design, encoder). Ask only when an essential creative decision cannot be inferred or
proceeding would change the user's meaning. Format default: requested format, else 9:16 for
short-form and 16:9 for long-form.

**Stages (order is mandatory):** input analysis · research · fact-checking · title/concept ·
script · save original + polished · **save the video-specific prompt before production** ·
storyboard · characters/assets · scenes · animation · Kokoro voiceover · music/SFX ·
synchronization · full MP4 render · inspection · error correction · final export · project
archiving · reusable pipeline improvement. A skipped stage is recorded with a reason.

---

## 4. Rules for creating new videos

1. Create a new folder with `python3 scripts/new_project.py <slug> --title "..."`. Never overwrite
   an old project or prompt.
2. Start every project from the single authoritative
   [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](templates/MASTER_VIDEO_PRODUCTION_PROMPT.md);
   customise it with that video's research and save it as `projects/<slug>/PROMPT.md` **before**
   production starts. Deviations go in `PRODUCTION_LOG.md`.
3. Keep the archive defined in
   [`templates/VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md`](templates/VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md).
   `tests/production/test_repo_hygiene.py` enforces it.
4. Save `SCRIPT_ORIGINAL.md`, `SCRIPT_POLISHED.md`, `SCRIPT_CHANGELOG.md`. Polish with
   [`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](docs/production/prompts/VOICEOVER_POLISH_PROMPT.md)
   **exactly as it exists, byte-for-byte — never rewritten, replaced, weakened or removed**.
5. `episode.json` is the single source of truth for scenes; derive `SCENE_PLAN.json` with
   `python3 tools/make_scene_plan.py projects/<slug>`. `CHARACTERS.md` mirrors `cast`.
6. Voice policy: Kokoro `am_michael` primary default, `af_bella` preferred secondary, other
   approved Kokoro voices when they genuinely suit a character, Piper only as fallback. English
   narration unless explicitly requested otherwise. Never change the default silently.
7. No channel name, watermark or channel branding anywhere. The optional `channel_name` field
   stays empty or omitted. Enforced by a regression test.
8. Originality: references inform craft only. Facts: label `[M]` measured, `[O]` observed,
   `[P]` predicted; never call a topic viral on a guess; keep sources and dates in `RESEARCH.md`.
9. Licences: record the licence and attribution of every audio asset in `ASSET_MANIFEST.json`.
10. Session safety: before ending, save prompts, scripts, storyboards, assets, audio, final MP4,
    QA reports and reproduction steps in the repository. Never leave the only copy in temp storage.

---

## 5. Rules for editing shared production components

- Change engine behaviour only in `universal_toolbook/`; keep JS `require('./…')` relative and
  Python imports kit-relative. Do not split the flat `engine/` directory without an ADR — see
  [`docs/decisions/ADR-0002-engine-layout.md`](docs/decisions/ADR-0002-engine-layout.md).
- Add or change actions, boards, props, easing or timing in the engine, not in a single video's
  spec. Add a regression assertion in `tests/regression/run_all_tests.js` or
  `tests/integration/test_studio_pipeline.py`.
- `config/studio_config.json` and `tts/config/voices.json` are the only configuration sources.
  Do not introduce a second voice catalog or a second studio config.
- Remotion, React, Three.js, Lottie and Tailwind are **not** adopted. Framework-independent ideas
  are adapted in the skill; Remotion-specific APIs are quarantined in
  [`skills/animation-production/references/remotion-techniques.md`](skills/animation-production/references/remotion-techniques.md).
  See [`docs/decisions/ADR-0001-remotion-evaluation.md`](docs/decisions/ADR-0001-remotion-evaluation.md).
- Never create a second master prompt, a second polish standard, a second architecture map or a
  second set of agent rules.

---

## 6. Tests and validation

Before declaring any change complete, run the applicable gates:

```bash
python3 tools/validate_structure.py          # structure, skills, prompts, runtime hygiene, links
python3 tools/check_docs.py                  # every documented path resolves
python3 tools/check_workflows.py             # CI YAML parses
python3 tools/validate_specs.py              # every example spec validates with warnings: []
node tests/regression/run_all_tests.js       # renderer regression
python3 tests/integration/test_studio_pipeline.py
python3 -m pytest tests/unit tests/production -q
python3 universal_toolbook/run_studio.py check
```

For a video: `validate` → `warnings: []`; stills in every delivered aspect, **actually looked at**;
draft render; master render; full decode; measured container and audio; ≥6 inspected frames; mute
legibility; `QA_REPORT.md`. Never claim a visual or audio test passed unless performed. See
[`skills/production-quality/SKILL.md`](skills/production-quality/SKILL.md).

CI is defined in `.github/workflows/verify.yml`. A failing check is diagnosed at root cause and
fixed, not retried blindly.

---

## 7. Repository organization and generated files

- Source, documentation, skills, templates, examples and tests are tracked. Historical projects,
  benchmark samples and release archives are tracked evidence; relocate them, never delete them.
- All temporary output goes under [`runtime/`](runtime/README.md): `runtime/work/` for authoring
  scratch, `runtime/renders/` for MP4s and chunk caches, `runtime/previews/` for QA stills and
  frames, `runtime/cache/` for downloads and voice caches, `runtime/logs/` for run logs.
  These are git-ignored. `output/`, `work/`, `.work_*/` and `cache/` remain ignored legacy aliases.
- No generated media (`.mp4`, `.wav`, `.zip`, `.png` QA frames, `.onnx`, `.npz`) in source
  directories. Finished deliverables belong in `deliverables/` or a project's own `final.mp4` /
  `renders/` / `assets/` / `audio/` folders.
- `tools/validate_structure.py` enforces these rules; CI runs it on every push.

---

## 8. Documentation updates

Any code, model, voice, prompt, workflow, configuration, asset or output change must update the
relevant documentation **in the same task or PR**. One procedure → one authoritative file:

| Change | Update |
|---|---|
| Agent rules / activation | `AGENTS.md` |
| Production procedure | the relevant `skills/*/SKILL.md` |
| Per-video prompt structure | `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` |
| Engine internals / module map | `docs/architecture/` |
| Setup / commands | `docs/getting-started/` |
| Detailed production stages | `docs/production/` |
| Verified failures / fixes | `docs/production/KNOWN_ISSUES.md`, `LESSONS_LEARNED.md`, `PIPELINE_CHANGELOG.md`, `docs/troubleshooting/INDEX.md` |
| Any shipped change | `CHANGELOG.md` + a regression test |

Run `python3 tools/check_docs.py` after doc edits. Historical project records and the baseline
inventory may retain legacy paths; `tools/check_docs.py` resolves them through its documented
alias map, but **new** documents must use canonical paths.

---

## 9. Error recovery and self-healing

When anything fails — research, asset, animation, TTS, render, encode, QA — record the error and
stage, reproduce where possible, find the root cause, implement a **reusable** fix, add a
regression test or validation rule, update the affected skill/template/docs/changelog, retry the
stage and verify. Do not retry endlessly, do not work around a failure without understanding it,
and never claim resolution without verification. Maintain
[`docs/production/KNOWN_ISSUES.md`](docs/production/KNOWN_ISSUES.md),
[`LESSONS_LEARNED.md`](docs/production/LESSONS_LEARNED.md),
[`PIPELINE_CHANGELOG.md`](docs/production/PIPELINE_CHANGELOG.md) and `tests/production/`.

---

## 10. Git discipline

Work only on the assigned branch `arena/c7c9d20d-universal-animation-toolbook`. Commit meaningful
milestones, push only to that branch, open a PR from it when the workflow supports one, and merge
only after required checks pass and changes are verified. Never overwrite uncommitted user work.
