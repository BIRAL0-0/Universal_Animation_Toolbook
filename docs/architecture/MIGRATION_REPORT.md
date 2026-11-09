# Migration report — 2026-11-09 reorganization

**Branch:** `arena/c7c9d20d-universal-animation-toolbook`
**Base:** `abedd59`
**Main reorganization commit:** `a2d311c`
**Final validation/report commits:** `a2d311c` (main reorganization), `cf649fa` (final tree/reports) and this evidence-update commit
**Pull request:** [PR #18](https://github.com/BIRAL0-0/Universal_Animation_Toolbook/pull/18) (open, intentionally not merged)

This report is generated from the actual repository. The complete file-by-file change table comes
from `git diff --name-status -M abedd59 a2d311c`; the full final tree is
[`docs/architecture/FINAL_TREE.md`](FINAL_TREE.md), and the measured gate outputs are in
[`docs/development/VALIDATION_REPORT.md`](../development/VALIDATION_REPORT.md).

## 1. Architecture after the reorganization

| Responsibility | One authoritative location | What changed |
|---|---|---|
| Reusable, copyable runtime kit | [`universal_toolbook/`](../../universal_toolbook/README.md) | kept its flat `engine/`; kit-relative imports, config, assets and CLI still work from inside the kit |
| Mandatory agent rules | [`AGENTS.md`](../../AGENTS.md) | replaced five overlapping instruction sets; contains architecture, activation map, video rules, shared-component rules, validation, generated files, docs and error recovery |
| Permanent agent skills | [`skills/`](../decisions/README.md) | six operational skills with frontmatter; detailed references only for the animation skill |
| Technical documentation | [`docs/`](SYSTEM_OVERVIEW.md) | architecture, getting-started, development, production, troubleshooting, decisions |
| One master prompt | [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](../../templates/MASTER_VIDEO_PRODUCTION_PROMPT.md) | per-video prompts are generated into `projects/<slug>/PROMPT.md` before production |
| Independent video projects | [`projects/`](../../projects/) | two historical projects preserved; new projects are never overwritten |
| Validated example specs | [`examples/`](../../examples/) | 11 specs, all validated with `warnings: []` |
| Repository dev tools / entry points | [`tools/`](../../tools/README.md), [`scripts/`](../../scripts/README.md) | structure/docs/CI checks, project generator, fresh-checkout verifier |
| Tests | [`tests/`](../../tests/README.md) | unit, integration, regression, production, fixtures |
| Durable deliverables | [`deliverables/`](../../deliverables/README.md) | release ZIPs, benchmark MP3s, the two-inch-bridge master and reports, hand-off page |
| Temporary generated state | [`runtime/`](../../runtime/README.md) | git-ignored cache/work/renders/previews/logs; only `runtime/README.md` is tracked |

The dependency/responsibility map was recorded before restructuring in
[`docs/architecture/BASELINE_INVENTORY.md`](BASELINE_INVENTORY.md) and is maintained in
[`docs/architecture/DEPENDENCY_MAP.md`](DEPENDENCY_MAP.md). `run_studio.py` spawns the Node
canvas renderer; JS modules use relative `require('./…')`; Python audio/TTS modules are
imported kit-relatively. Repo-level `tools/`, `scripts/`, `skills/`, `docs/`, `tests/` and
`projects/` are never runtime dependencies of the copied kit.

## 2. Removals, merges and preservation decisions

- **Four duplicate kit instruction files removed:** `universal_toolbook/00_START_HERE.md`,
  `universal_toolbook/MASTER_PROMPT.md`, `universal_toolbook/process/SESSION_PROMPT.md`,
  `universal_toolbook/process/REPO_MAP.md`. Their unique operational content was migrated into
  `AGENTS.md`, the six skills, `universal_toolbook/README.md`,
  `universal_toolbook/process/README.md`, architecture docs and the master template. Root
  `START_HERE.md` and `AGENT_OPERATING_RULES.md` are short redirects, not competing rule sets.
- **Two broken hand-off symlinks removed** after inspection. The original hand-off HTML was
  preserved with its metadata and preview; the MP4, ZIP and poster are now real byte-identical
  assets under `deliverables/the_wall_you_agreed_with/`, and the release ZIP also lives in
  `deliverables/releases/`.
- **Historical evidence preserved:** both `projects/` folders, all 16 benchmark MP3s, three
  release ZIPs, the two-inch-bridge master MP4, chapters, cues, validation JSON and SVG
  storyboard were relocated. `deliverables/two_inch_bridge_cel/report.json` is byte-for-byte
  unchanged; `NOTES.md` and `deliverables/tts_benchmark/README.md` keep their original text and append a
  clearly dated migration note. The English-only voiceover polish prompt remains byte-for-byte
  immutable at `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`
  (SHA-256 `aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea`, 5256 bytes).
- **Documentation changelog preserved:** `docs/production/WORKFLOW_CHANGELOG.md` is now a
  historical archive with a superseding header; current changes go to root `CHANGELOG.md` and
  current pipeline changes to `docs/production/PIPELINE_CHANGELOG.md`.
- **Paths unified:** 53 tracked files had exact path replacements and two regexes applied; the
  TTS config, setup script and `tts/config.py` now use `runtime/cache/tts/` in the full repo and
  keep `runtime/` inside a standalone kit copy. The global changes were inspected; the historical
  render report was restored verbatim so measured evidence was not rewritten.
- **No useful information was deleted merely to reduce file count.** Every removal candidate was
  checked for references, imports, workflow dependence and unique content first.

## 3. Permanent skills

`AGENTS.md` §2 is the mandatory activation map. On a bare *"Create a new video."* the agent reads
`AGENTS.md`, activates `skills/animation-production/SKILL.md`, and activates the relevant
specialists: `youtube-research`, `scriptwriting`, `stickman-animation`, `voiceover-audio`,
`production-quality`. Each skill has YAML frontmatter, an operational procedure, explicit
authoritative links, and is referenced from `AGENTS.md`. `skills/animation-production/` has four
references: Toolbook renderer map, framework-independent animation principles, quarantined
Remotion-specific API notes, and source/licence attribution. Skill text is not copied into other
instruction files.

## 4. Remotion evaluation and adoption decision

**Decision: knowledge adapted, runtime rejected.** See
[`docs/decisions/ADR-0001-remotion-evaluation.md`](../decisions/ADR-0001-remotion-evaluation.md).

| Question | Evidence-based answer |
|---|---|
| Direct applicability | Low for runtime: the existing `frameIdx / fps` canvas renderer and `compileEpisode()` already implement the production path. Framework-independent timing/composition ideas are adapted. |
| Animation timing | Already deterministic frame-clock based, with `lerp`, `ease`, `springEase`, `backEase`; no React hooks required. |
| Sequencing | Ordered `scenes[]`, `startFrame`/`endFrame`, speech-locked retiming and cue alignment already exist. |
| Transitions/camera | Environment fades, `camera_shots`, portrait framing and board/camera speech locking are implemented. |
| Captions/typography | Bundled Poppins fonts, `line_timings`, `word_timings`, `accent_words`, screen-space caption rendering are implemented; SRT/transcription remain roadmap-only. |
| Media synchronization | Python `voice_engine.py`, `audio_mixer.py`, `bgm_library.py`, cue alignment and measured WAV reports already own it. |
| Features requiring a real Remotion runtime | React composition trees, `useCurrentFrame`, `useVideoConfig`, `calculateMetadata`, `<Sequence>`, `<Series>`, `@remotion/transitions`, `@remotion/captions`, `@remotion/three`, Lottie, Tailwind, Mediabunny and Remotion Studio. |
| Justified dependencies/complexity? | No. No tested technical benefit was demonstrated; adding a second engine would duplicate working code and break the copyable kit. |

No React, Remotion, Tailwind, Three.js, React Three Fiber or unused scaffold code was added.
The upstream `remotion-dev/skills` repository had `"license": null`, no LICENSE file and no MIT
text in the checked archive; `remotion-dev/remotion` reports `NOASSERTION`. No upstream text/code
was copied, so no copied-code MIT notice is required. `skills/animation-production/references/ATTRIBUTION.md`
records the verification; Remotion-specific instructions are clearly labelled quarantine.

## 5. Automatic video creation and project archive

`AGENTS.md` §3 classifies idea-only, topic/title, complete script, reference video and "another
one" inputs, then runs the 20 stages without requiring the user to restate the master prompt.
`scripts/new_project.py` creates an independent `projects/<slug>/`, saves the customised
`PROMPT.md` **first**, writes research, original/polished scripts and changelog, storyboard,
characters, derived `SCENE_PLAN.json`, voiceover notes, asset manifest, production log, QA report
and `assets/`, `audio/`, `renders/` folders. It refuses to overwrite. Voice policy remains Kokoro
`am_michael` primary default, `af_bella` preferred secondary, other approved Kokoro voices when
appropriate and Piper only as fallback. `tools/validate_structure.py` and `tests/unit/` enforce
the single master prompt, protected polish prompt, skill map and project structure.

## 6. Before / after counts and source size

| Measure | Before (`abedd59` baseline) | After final tree | Change |
|---|---:|---:|---:|
| Tracked paths / regular files | 263 / 261 (+2 symlinks) | 304 / 304 | +41 paths; 0 symlinks |
| Markdown files | 75 | 110 | +35 |
| Python files | 43 | 47 | +4 |
| JavaScript files | 15 | 15 | +0 |
| Python + JavaScript lines | 24,682 | 25,544 | +862 |
| Markdown lines | 8,815 | 11,309 | +2,494 |

The added Markdown is mostly new authoritative architecture/skills/decision documentation and
the migration/validation reports, not duplicated procedures: five overlapping instruction files
and one old workflow-docs directory were removed, while 25 stage docs were relocated.

Baseline figures are from [`docs/architecture/BASELINE_INVENTORY.md`](BASELINE_INVENTORY.md); the
"after" figures count all tracked, non-ignored files in the final tree, including the three
report/tree documents. Source LOC means Python + JavaScript lines; Markdown lines are reported
separately because documentation is not executable source.

## 7. Validation, CI, fresh checkout and kit verification

All local gates passed (see [`docs/development/VALIDATION_REPORT.md`](../development/VALIDATION_REPORT.md)
for exact outputs): structure/docs/workflow/spec checks, environment check, JS regression, Python
integration, 31 unit/production tests, Python/JS/JSON syntax checks, `scripts/new_project.py`,
`tools/produce_video.py --stop-after stills`, stills generation, a silent 24-second MP4 with a
clean validation report, and `scripts/verify_fresh_checkout.py`. The fresh-checkout script passed
all 16 steps on commit `a2d311c79aaf359b265de56eb8a9e789011a6b07`; the same script is used to re-verify the final state before delivery. CI YAML parses locally as
5 jobs / 36 steps.

Complete measured outputs are in [`docs/development/VALIDATION_REPORT.md`](../development/VALIDATION_REPORT.md).
Automated gates do **not** equal subjective visual/audio QA. Seven images were actually opened
and inspected: four frames extracted from the 24-second silent draft MP4, two 1920×1080 stills
and one 1080×1920 portrait still. They showed the expected two characters, captions, chapter
board, clock, spotlights, desk and consistent parchment/ink style with no visible corruption.
The WAV mix was measured (peak −10.9 dBFS, RMS −27.75 dBFS, zero clipped samples), but **no
human listening test was performed**; no voiced/Kokoro render was produced because
`kokoro_ready: false` and `offline_voiceover_ready: false` on this machine.

## 8. Remaining limitations

- Kokoro/Piper weights are absent here; `setup_tts.py` needs a network install before voiced
  rendering. No subjective audio review, full-film visual review or voiced render was performed.
- GitHub Actions PR run `42666120250` passed all five required checks: structure/docs (38 s),
  specs (45 s), engine/production tests (43 s), render smoke (1 m 7 s) and fresh checkout
  (1 m 34 s). The PR is intentionally **not merged**; the documentation-only follow-up commit
  triggers the same workflow and its result is reported in the final delivery summary.
- Remotion's public docs HTML was not fetched; the evaluation used the supplied framework
  concepts plus verified GitHub licence metadata. No MIT licence was assumed.
- Historical project documents and delivery reports may quote pre-reorganization paths. They are
  preserved as evidence and resolved by `tools/check_docs.py`'s explicit historical alias map;
  new documentation is required to use canonical paths.
- `ffprobe` is not on PATH in this sandbox; container checks use the renderer's own validation
  report and `imageio-ffmpeg`.
- The roadmap still lists automation for some PROCESS-STANDARD stages; they are documented
  procedures, not implemented tools.

## 9. Where future agents look for each work type

| Work type | Authoritative location |
|---|---|
| Rules, architecture, activation, error recovery | `AGENTS.md` |
| Any video request | `skills/animation-production/SKILL.md` plus relevant specialists |
| Script / research / fact-check | `skills/scriptwriting/SKILL.md`, `skills/youtube-research/SKILL.md`, `docs/production/` |
| Characters, poses, boards, camera | `skills/stickman-animation/SKILL.md`, `universal_toolbook/01_TOOLBOOK_REFERENCE.md` |
| Voice, TTS, mix, music | `skills/voiceover-audio/SKILL.md`, `docs/architecture/AUDIO_TTS_PIPELINE.md`, `universal_toolbook/tts/config/voices.json` |
| Renderer or engine change | `universal_toolbook/engine/`, `universal_toolbook/run_studio.py`, `tests/regression/`, `tests/integration/` |
| New per-video project | `scripts/new_project.py`, `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`, `projects/<slug>/` |
| QA sign-off / troubleshooting | `skills/production-quality/SKILL.md`, `docs/troubleshooting/INDEX.md`, `docs/development/TESTING.md` |
| Structure/CI/doc gates | `tools/validate_structure.py`, `tools/check_docs.py`, `tools/check_workflows.py`, `.github/workflows/verify.yml` |
| Durable package/evidence | `deliverables/` |
| Temporary renders/logs/cache | `runtime/` |
| Decisions and history | `docs/decisions/`, `CHANGELOG.md`, `docs/production/WORKFLOW_CHANGELOG.md` |

## 10. File-by-file migration table

Statuses: `R###` = Git-detected rename with similarity, `A` = added, `M` = modified in place,
`D` = deleted. Paths in this table are historical where the status says so; the final canonical
tree is [`FINAL_TREE.md`](FINAL_TREE.md).

| Status | Old path | New path | Note |
|---|---|---|---|
| M | `.github/workflows/verify.yml` | `.github/workflows/verify.yml` | updated in place |
| M | `.gitignore` | `.gitignore` | updated in place |
| A | — | `AGENTS.md` | added authoritative file |
| M | `AGENT_OPERATING_RULES.md` | `AGENT_OPERATING_RULES.md` | updated in place |
| A | — | `CHANGELOG.md` | added authoritative file |
| A | — | `CONTRIBUTING.md` | added authoritative file |
| A | — | `LICENSE` | added authoritative file |
| M | `README.md` | `README.md` | updated in place |
| M | `START_HERE.md` | `START_HERE.md` | updated in place |
| M | `deliverables/README.md` | `deliverables/README.md` | updated in place |
| `R076` | `outputs/README.md` | `deliverables/RESULTS.md` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/discipline_vs_obsession_release.zip` | `deliverables/releases/discipline_vs_obsession_release.zip` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/the_wall_you_agreed_with_1080x1920.zip` | `deliverables/releases/the_wall_you_agreed_with_1080x1920.zip` | relocated; canonical links/paths updated where needed |
| `R100` | `projects/video-001-twenty-three-minutes/video-001_RELEASE.zip` | `deliverables/releases/video-001_RELEASE.zip` | relocated; canonical links/paths updated where needed |
| `R093` | `downloads/index.html` | `deliverables/the_wall_you_agreed_with/index.html` | relocated; canonical links/paths updated where needed |
| A | — | `deliverables/the_wall_you_agreed_with/poster.jpg` | added authoritative file |
| A | — | `deliverables/the_wall_you_agreed_with/the_wall_you_agreed_with_1080x1920.mp4` | added authoritative file |
| A | — | `deliverables/the_wall_you_agreed_with/the_wall_you_agreed_with_1080x1920.zip` | added authoritative file |
| `R088` | `outputs/tts_benchmark/README.md` | `deliverables/tts_benchmark/README.md` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_aoede_conversational.mp3` | `deliverables/tts_benchmark/kokoro_af_aoede_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_bella_conversational.mp3` | `deliverables/tts_benchmark/kokoro_af_bella_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_bella_dramatic.mp3` | `deliverables/tts_benchmark/kokoro_af_bella_dramatic.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_bella_educational.mp3` | `deliverables/tts_benchmark/kokoro_af_bella_educational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_bella_energetic_youtube.mp3` | `deliverables/tts_benchmark/kokoro_af_bella_energetic_youtube.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_bella_v1_conversational.mp3` | `deliverables/tts_benchmark/kokoro_af_bella_v1_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_heart_conversational.mp3` | `deliverables/tts_benchmark/kokoro_af_heart_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_jessica_conversational.mp3` | `deliverables/tts_benchmark/kokoro_af_jessica_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_af_kore_conversational.mp3` | `deliverables/tts_benchmark/kokoro_af_kore_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_am_eric_conversational.mp3` | `deliverables/tts_benchmark/kokoro_am_eric_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_am_fenrir_conversational.mp3` | `deliverables/tts_benchmark/kokoro_am_fenrir_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_am_liam_conversational.mp3` | `deliverables/tts_benchmark/kokoro_am_liam_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_am_michael_energetic_youtube.mp3` | `deliverables/tts_benchmark/kokoro_am_michael_energetic_youtube.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_am_michael_v1_conversational.mp3` | `deliverables/tts_benchmark/kokoro_am_michael_v1_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_am_onyx_conversational.mp3` | `deliverables/tts_benchmark/kokoro_am_onyx_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_bf_alice_conversational.mp3` | `deliverables/tts_benchmark/kokoro_bf_alice_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/kokoro_bm_daniel_conversational.mp3` | `deliverables/tts_benchmark/kokoro_bm_daniel_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/piper_en_GB-alan-medium_conversational.mp3` | `deliverables/tts_benchmark/piper_en_GB-alan-medium_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/tts_benchmark/piper_en_US-ryan-medium_conversational.mp3` | `deliverables/tts_benchmark/piper_en_US-ryan-medium_conversational.mp3` | relocated; canonical links/paths updated where needed |
| `R086` | `outputs/two_inch_bridge_cel/NOTES.md` | `deliverables/two_inch_bridge_cel/NOTES.md` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/two_inch_bridge_cel/chapters.txt` | `deliverables/two_inch_bridge_cel/chapters.txt` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/two_inch_bridge_cel/cues.json` | `deliverables/two_inch_bridge_cel/cues.json` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/two_inch_bridge_cel/report.json` | `deliverables/two_inch_bridge_cel/report.json` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/two_inch_bridge_cel/storyboard.svg` | `deliverables/two_inch_bridge_cel/storyboard.svg` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/two_inch_bridge_cel/the_two_inch_bridge_1080p.mp4` | `deliverables/two_inch_bridge_cel/the_two_inch_bridge_1080p.mp4` | relocated; canonical links/paths updated where needed |
| `R100` | `outputs/two_inch_bridge_cel/validation.json` | `deliverables/two_inch_bridge_cel/validation.json` | relocated; canonical links/paths updated where needed |
| A | — | `docs/architecture/AUDIO_TTS_PIPELINE.md` | added authoritative file |
| A | — | `docs/architecture/BASELINE_INVENTORY.md` | added authoritative file |
| A | — | `docs/architecture/DECISIONS.md` | added authoritative file |
| A | — | `docs/architecture/DEPENDENCY_MAP.md` | added authoritative file |
| A | — | `docs/architecture/ENGINE_MODULES.md` | added authoritative file |
| A | — | `docs/architecture/RENDERING_PIPELINE.md` | added authoritative file |
| A | — | `docs/architecture/SYSTEM_OVERVIEW.md` | added authoritative file |
| A | — | `docs/decisions/ADR-0001-remotion-evaluation.md` | added authoritative file |
| A | — | `docs/decisions/ADR-0002-engine-layout.md` | added authoritative file |
| A | — | `docs/decisions/ADR-0003-repository-layout.md` | added authoritative file |
| A | — | `docs/decisions/README.md` | added authoritative file |
| A | — | `docs/development/CODE_ORGANIZATION.md` | added authoritative file |
| `R095` | `docs/production-workflow/ENVIRONMENT_REPORT.md` | `docs/development/ENVIRONMENT_REPORT.md` | relocated; canonical links/paths updated where needed |
| `R086` | `docs/production-workflow/FUTURE_DEVELOPMENT.md` | `docs/development/ROADMAP.md` | relocated; canonical links/paths updated where needed |
| A | — | `docs/development/TESTING.md` | added authoritative file |
| A | — | `docs/getting-started/FIRST_VIDEO.md` | added authoritative file |
| `R088` | `docs/production-workflow/CONFIGURATION_AND_SETUP.md` | `docs/getting-started/INSTALL.md` | relocated; canonical links/paths updated where needed |
| `R093` | `docs/production-workflow/ANIMATION_GENERATION.md` | `docs/production/ANIMATION_GENERATION.md` | relocated; canonical links/paths updated where needed |
| `R055` | `docs/production-workflow/ASSET_MANAGEMENT.md` | `docs/production/ASSET_MANAGEMENT.md` | relocated; canonical links/paths updated where needed |
| `R093` | `docs/production-workflow/AUDIO_VISUAL_SYNCHRONIZATION.md` | `docs/production/AUDIO_VISUAL_SYNCHRONIZATION.md` | relocated; canonical links/paths updated where needed |
| `R085` | `docs/production-workflow/COMPLETE_WORKFLOW.md` | `docs/production/COMPLETE_WORKFLOW.md` | relocated; canonical links/paths updated where needed |
| `R092` | `docs/production-workflow/IDEA_RESEARCH.md` | `docs/production/IDEA_RESEARCH.md` | relocated; canonical links/paths updated where needed |
| `R077` | `docs/production-workflow/INDEX.md` | `docs/production/INDEX.md` | relocated; canonical links/paths updated where needed |
| M | `docs/production/KNOWN_ISSUES.md` | `docs/production/KNOWN_ISSUES.md` | updated in place |
| M | `docs/production/LESSONS_LEARNED.md` | `docs/production/LESSONS_LEARNED.md` | updated in place |
| M | `docs/production/PIPELINE_CHANGELOG.md` | `docs/production/PIPELINE_CHANGELOG.md` | updated in place |
| `R083` | `docs/production-workflow/QUALITY_CONTROL.md` | `docs/production/QUALITY_CONTROL.md` | relocated; canonical links/paths updated where needed |
| `R085` | `docs/production-workflow/SCRIPT_WORKFLOW.md` | `docs/production/SCRIPT_WORKFLOW.md` | relocated; canonical links/paths updated where needed |
| `R091` | `docs/production-workflow/TOOLS_AND_MODELS.md` | `docs/production/TOOLS_AND_MODELS.md` | relocated; canonical links/paths updated where needed |
| `R091` | `docs/production-workflow/TROUBLESHOOTING.md` | `docs/production/TROUBLESHOOTING.md` | relocated; canonical links/paths updated where needed |
| `R098` | `docs/production-workflow/TTS_ARCHITECTURE.md` | `docs/production/TTS_ARCHITECTURE.md` | relocated; canonical links/paths updated where needed |
| `R095` | `docs/production-workflow/TTS_BENCHMARK.md` | `docs/production/TTS_BENCHMARK.md` | relocated; canonical links/paths updated where needed |
| `R076` | `docs/production-workflow/TTS_SETUP.md` | `docs/production/TTS_SETUP.md` | relocated; canonical links/paths updated where needed |
| `R093` | `docs/production-workflow/TTS_TROUBLESHOOTING.md` | `docs/production/TTS_TROUBLESHOOTING.md` | relocated; canonical links/paths updated where needed |
| `R098` | `docs/production-workflow/TTS_VOICE_COMPARISON.md` | `docs/production/TTS_VOICE_COMPARISON.md` | relocated; canonical links/paths updated where needed |
| `R074` | `docs/production-workflow/VIDEO_ASSEMBLY.md` | `docs/production/VIDEO_ASSEMBLY.md` | relocated; canonical links/paths updated where needed |
| `R099` | `docs/production-workflow/VIRAL_POTENTIAL_EVALUATION.md` | `docs/production/VIRAL_POTENTIAL_EVALUATION.md` | relocated; canonical links/paths updated where needed |
| `R097` | `docs/production-workflow/VOICE_GENERATION.md` | `docs/production/VOICE_GENERATION.md` | relocated; canonical links/paths updated where needed |
| `R095` | `docs/production-workflow/WORKFLOW_CHANGELOG.md` | `docs/production/WORKFLOW_CHANGELOG.md` | relocated; canonical links/paths updated where needed |
| `R081` | `docs/production-workflow/YOUTUBE_PUBLISHING.md` | `docs/production/YOUTUBE_PUBLISHING.md` | relocated; canonical links/paths updated where needed |
| `R100` | `docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md` | `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` | relocated; canonical links/paths updated where needed |
| A | — | `docs/troubleshooting/INDEX.md` | added authoritative file |
| D | `downloads/the_wall_you_agreed_with_1080x1920.mp4` | — | removed after checking references and migrating unique content |
| D | `downloads/the_wall_you_agreed_with_1080x1920.zip` | — | removed after checking references and migrating unique content |
| A | — | `runtime/README.md` | added authoritative file |
| A | — | `scripts/README.md` | added authoritative file |
| A | — | `scripts/new_project.py` | added authoritative file |
| A | — | `scripts/verify_fresh_checkout.py` | added authoritative file |
| A | — | `skills/README.md` | added authoritative file |
| A | — | `skills/animation-production/SKILL.md` | added authoritative file |
| A | — | `skills/animation-production/references/ATTRIBUTION.md` | added authoritative file |
| A | — | `skills/animation-production/references/frame-based-animation.md` | added authoritative file |
| A | — | `skills/animation-production/references/remotion-techniques.md` | added authoritative file |
| A | — | `skills/animation-production/references/toolbook-renderer-map.md` | added authoritative file |
| A | — | `skills/production-quality/SKILL.md` | added authoritative file |
| A | — | `skills/scriptwriting/SKILL.md` | added authoritative file |
| A | — | `skills/stickman-animation/SKILL.md` | added authoritative file |
| A | — | `skills/voiceover-audio/SKILL.md` | added authoritative file |
| A | — | `skills/youtube-research/SKILL.md` | added authoritative file |
| M | `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` | `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` | updated in place |
| A | — | `templates/README.md` | added authoritative file |
| A | — | `templates/VIDEO_PROJECT_TEMPLATE/PROJECT_FILES.md` | added authoritative file |
| A | — | `templates/VIDEO_PROJECT_TEMPLATE/README.md` | added authoritative file |
| A | — | `tests/README.md` | added authoritative file |
| `R099` | `tests/test_studio_pipeline.py` | `tests/integration/test_studio_pipeline.py` | relocated; canonical links/paths updated where needed |
| M | `tests/production/test_environment_readiness.py` | `tests/production/test_environment_readiness.py` | updated in place |
| M | `tests/production/test_repo_hygiene.py` | `tests/production/test_repo_hygiene.py` | updated in place |
| `R095` | `tests/run_all_tests.js` | `tests/regression/run_all_tests.js` | relocated; canonical links/paths updated where needed |
| A | — | `tests/unit/test_repository_structure.py` | added authoritative file |
| A | — | `tools/README.md` | added authoritative file |
| M | `tools/build_wall_episode.py` | `tools/build_wall_episode.py` | updated in place |
| M | `tools/check_docs.py` | `tools/check_docs.py` | updated in place |
| M | `tools/mix_probe.py` | `tools/mix_probe.py` | updated in place |
| M | `tools/produce_video.py` | `tools/produce_video.py` | updated in place |
| M | `tools/subtitle_check.py` | `tools/subtitle_check.py` | updated in place |
| M | `tools/validate_specs.py` | `tools/validate_specs.py` | updated in place |
| A | — | `tools/validate_structure.py` | added authoritative file |
| D | `universal_toolbook/00_START_HERE.md` | — | removed after checking references and migrating unique content |
| M | `universal_toolbook/01_TOOLBOOK_REFERENCE.md` | `universal_toolbook/01_TOOLBOOK_REFERENCE.md` | updated in place |
| D | `universal_toolbook/MASTER_PROMPT.md` | — | removed after checking references and migrating unique content |
| M | `universal_toolbook/README.md` | `universal_toolbook/README.md` | updated in place |
| M | `universal_toolbook/generate_voiceover.py` | `universal_toolbook/generate_voiceover.py` | updated in place |
| M | `universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md` | `universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md` | updated in place |
| M | `universal_toolbook/process/03_RENDER_PIPELINE.md` | `universal_toolbook/process/03_RENDER_PIPELINE.md` | updated in place |
| M | `universal_toolbook/process/04_VISUAL_GEOMETRY.md` | `universal_toolbook/process/04_VISUAL_GEOMETRY.md` | updated in place |
| M | `universal_toolbook/process/05_AUDIO.md` | `universal_toolbook/process/05_AUDIO.md` | updated in place |
| M | `universal_toolbook/process/06_QA_GATE.md` | `universal_toolbook/process/06_QA_GATE.md` | updated in place |
| M | `universal_toolbook/process/07_TROUBLESHOOTING.md` | `universal_toolbook/process/07_TROUBLESHOOTING.md` | updated in place |
| M | `universal_toolbook/process/README.md` | `universal_toolbook/process/README.md` | updated in place |
| D | `universal_toolbook/process/REPO_MAP.md` | — | removed after checking references and migrating unique content |
| D | `universal_toolbook/process/SESSION_PROMPT.md` | — | removed after checking references and migrating unique content |
| M | `universal_toolbook/process_audio.py` | `universal_toolbook/process_audio.py` | updated in place |
| M | `universal_toolbook/run_studio.py` | `universal_toolbook/run_studio.py` | updated in place |
| M | `universal_toolbook/setup_tts.py` | `universal_toolbook/setup_tts.py` | updated in place |
| M | `universal_toolbook/tools/build_storyboard_svg.py` | `universal_toolbook/tools/build_storyboard_svg.py` | updated in place |
| M | `universal_toolbook/tools/convert_kokoro_v1_voices.py` | `universal_toolbook/tools/convert_kokoro_v1_voices.py` | updated in place |
| M | `universal_toolbook/tools/tts_voice_benchmark.py` | `universal_toolbook/tools/tts_voice_benchmark.py` | updated in place |
| M | `universal_toolbook/tools/tts_voice_report_tables.py` | `universal_toolbook/tools/tts_voice_report_tables.py` | updated in place |
| M | `universal_toolbook/tts/__init__.py` | `universal_toolbook/tts/__init__.py` | updated in place |
| M | `universal_toolbook/tts/config.py` | `universal_toolbook/tts/config.py` | updated in place |
| M | `universal_toolbook/tts/config/voices.json` | `universal_toolbook/tts/config/voices.json` | updated in place |
| M | `universal_toolbook/tts/providers/kokoro_provider.py` | `universal_toolbook/tts/providers/kokoro_provider.py` | updated in place |
| M | `universal_toolbook/validate_audio.py` | `universal_toolbook/validate_audio.py` | updated in place |
