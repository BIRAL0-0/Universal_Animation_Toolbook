# Production Workflow Documentation

This directory is the **operational documentation for the whole content operation**: from
discovering and selecting an animation idea, through script, voice, animation, sync, render,
quality control, and YouTube publishing preparation — for a system whose render core is
[`universal_toolbook/`](../../universal_toolbook/).

It is the companion to, not a replacement for, the existing kit documentation:

| You have… | Read |
| --- | --- |
| a script and need a film | [`START_HERE.md`](../../START_HERE.md), then [`universal_toolbook/process/README.md`](../../universal_toolbook/process/README.md) (the seven-line pipeline) |
| only an idea or a topic, and want the full production route | **this directory** — start with [`COMPLETE_WORKFLOW.md`](COMPLETE_WORKFLOW.md) |
| the exact JSON schema, actions, environments | [`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](../../universal_toolbook/01_TOOLBOOK_REFERENCE.md) |
| an agent session that needs the operative contract | [`universal_toolbook/process/SESSION_PROMPT.md`](../../universal_toolbook/process/SESSION_PROMPT.md) |
| the finished-film storage rules | [`outputs/README.md`](../../outputs/README.md) |

The `universal_toolbook/process/` folder documents **script → film** in depth (intake, authoring, rendering,
geometry, audio, QA, limits). This folder documents the **whole pipeline around that core** —
the stages before a script exists and after a master is rendered — and keeps a single
chronological master reference of everything.

---

## Status legend

Every stage and every claim in these documents carries one of four status labels. Never read
more into a document than its label says:

| Label | Meaning |
| --- | --- |
| **IMPLEMENTED** | Code exists in this repository and was verified here. Commands and paths are real. |
| **PARTIAL** | Some sub-steps are implemented, the rest are manual. The manual parts are named explicitly. |
| **PROCESS-STANDARD** | A documented procedure a human or AI agent executes. No automated tool exists yet; the document is the standard. |
| **PLANNED** | Not implemented. See [`FUTURE_DEVELOPMENT.md`](FUTURE_DEVELOPMENT.md) for what building it would require. |

---

## The pipeline at a glance

Thirteen stages, in production order. "Who" is: **user** (the human who owns the channel),
**agent** (an AI coding agent operating this repository), **engine** (the toolbook code).

| # | Stage | Who | Status | Reference |
| --- | --- | --- | --- | --- |
| 1 | YouTube trend research & content discovery | user + agent | PROCESS-STANDARD | [`IDEA_RESEARCH.md`](IDEA_RESEARCH.md) |
| 2 | Viral-potential evaluation (10-criterion scoring) | agent | PROCESS-STANDARD | [`VIRAL_POTENTIAL_EVALUATION.md`](VIRAL_POTENTIAL_EVALUATION.md) |
| 3 | Present ideas; user selects | user | PROCESS-STANDARD | [`IDEA_RESEARCH.md`](IDEA_RESEARCH.md) |
| 4 | Generate short sample scripts | agent | PROCESS-STANDARD | [`SCRIPT_WORKFLOW.md`](SCRIPT_WORKFLOW.md) |
| 5 | Generate the complete script | agent | PROCESS-STANDARD | [`SCRIPT_WORKFLOW.md`](SCRIPT_WORKFLOW.md) |
| 6 | Polish the script for AI voiceover | agent | PROCESS-STANDARD | [`SCRIPT_WORKFLOW.md`](SCRIPT_WORKFLOW.md) + [`prompts/VOICEOVER_POLISH_PROMPT.md`](prompts/VOICEOVER_POLISH_PROMPT.md) |
| 7 | Decide audio-first vs animation-first order | agent | IMPLEMENTED (decision logic below) | [`AUDIO_VISUAL_SYNCHRONIZATION.md`](AUDIO_VISUAL_SYNCHRONIZATION.md) |
| 8 | Voiceover generation | engine | IMPLEMENTED | [`VOICE_GENERATION.md`](VOICE_GENERATION.md) |
| 9 | Animation generation (episode authoring) | agent + engine | IMPLEMENTED | [`ANIMATION_GENERATION.md`](ANIMATION_GENERATION.md) |
| 10 | Audio–visual synchronization | engine | IMPLEMENTED | [`AUDIO_VISUAL_SYNCHRONIZATION.md`](AUDIO_VISUAL_SYNCHRONIZATION.md) |
| 11 | Video assembly & rendering | engine + user (gates) | IMPLEMENTED | [`VIDEO_ASSEMBLY.md`](VIDEO_ASSEMBLY.md) |
| 12 | Quality control | engine (automated gates) + user (review) | PARTIAL | [`QUALITY_CONTROL.md`](QUALITY_CONTROL.md) |
| 13 | YouTube publishing preparation | user (publishes) + agent (prepares) | PARTIAL | [`YOUTUBE_PUBLISHING.md`](YOUTUBE_PUBLISHING.md) |

Supporting references:

| Topic | Reference |
| --- | --- |
| Asset lifecycle, naming, storage, cost avoidance | [`ASSET_MANAGEMENT.md`](ASSET_MANAGEMENT.md) |
| Every tool, AI model/service, dependency, config | [`TOOLS_AND_MODELS.md`](TOOLS_AND_MODELS.md) |
| Setup, environment variables, configuration reference | [`CONFIGURATION_AND_SETUP.md`](CONFIGURATION_AND_SETUP.md) |
| Symptom → stage → fix triage (production-wide) | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) |
| Roadmap of meaningful improvements, prioritized | [`FUTURE_DEVELOPMENT.md`](FUTURE_DEVELOPMENT.md) |
| **Self-hosted TTS subsystem (Kokoro default)** | [`TTS_SETUP.md`](TTS_SETUP.md), [`TTS_ARCHITECTURE.md`](TTS_ARCHITECTURE.md), [`TTS_BENCHMARK.md`](TTS_BENCHMARK.md), [`TTS_TROUBLESHOOTING.md`](TTS_TROUBLESHOOTING.md) |
| **Measured environment this pipeline was verified in** | [`ENVIRONMENT_REPORT.md`](ENVIRONMENT_REPORT.md) |
| **Documentation maintenance policy + changelog** | [`WORKFLOW_CHANGELOG.md`](WORKFLOW_CHANGELOG.md) |

---

## Reader map

**New human taking this over.** Read this page, then
[`COMPLETE_WORKFLOW.md`](COMPLETE_WORKFLOW.md) top to bottom, then
[`CONFIGURATION_AND_SETUP.md`](CONFIGURATION_AND_SETUP.md) and do the bootstrap, then render the
template film once (`universal_toolbook/templates/episode_minimal.json`) to see a full loop.

**New AI agent session with a script.** Your operative contract is
[`universal_toolbook/process/SESSION_PROMPT.md`](../../universal_toolbook/process/SESSION_PROMPT.md) —
it wins over this directory whenever the two differ on a command or rule. This directory tells
you where that contract sits inside the wider pipeline and what happens before and after it.

**New AI agent session with only an idea.** Start at Stage 1 in
[`COMPLETE_WORKFLOW.md`](COMPLETE_WORKFLOW.md), follow the
human-approval gates, and keep everything in `work/` (see [`ASSET_MANAGEMENT.md`](ASSET_MANAGEMENT.md)).
Do not begin rendering before the Stage 6 approval (final narration approved).

**Engine developer.** [`TOOLS_AND_MODELS.md`](TOOLS_AND_MODELS.md) is the component inventory,
[`universal_toolbook/process/REPO_MAP.md`](../../universal_toolbook/process/REPO_MAP.md) is the
module-to-effect map, and the maintenance rule in
[`WORKFLOW_CHANGELOG.md`](WORKFLOW_CHANGELOG.md) applies to every change you ship.

---

## Ground rules that apply to the whole pipeline

1. **Human approval gates are real gates.** Stages 3, 4, 6, 12, and 13 end in a user decision.
   An agent never skips one, never answers for the user, and never publishes without explicit
   authorization.
2. **Every stage's output is a file.** If a stage did not produce a file, the stage did not
   happen. No exceptions for "I kept it in context".
3. **Report only numbers that a file produced** (render reports, measured audio, decoded
   frames). This rule from `START_HERE.md` extends to every stage here.
4. **Docs describe the current repository.** If a change makes a sentence here false, the same
   task or pull request that made the change fixes the sentence (see
   [`WORKFLOW_CHANGELOG.md`](WORKFLOW_CHANGELOG.md)).
