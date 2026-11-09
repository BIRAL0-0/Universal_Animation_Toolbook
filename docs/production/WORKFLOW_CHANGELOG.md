# WORKFLOW CHANGELOG — historical documentation record

**Status: HISTORICAL ARCHIVE.** Everything below this notice is preserved as evidence of how the
production workflow documentation evolved. It is **not** the current maintenance policy or the
current repository changelog. The authoritative rule is [`AGENTS.md`](../../AGENTS.md) §8;
current changes go in [`CHANGELOG.md`](../../CHANGELOG.md), and the current pipeline log is
[`PIPELINE_CHANGELOG.md`](PIPELINE_CHANGELOG.md). Do not add new entries here.

---

# WORKFLOW CHANGELOG — the documentation maintenance policy

**Status: POLICY.** This file is the law for keeping this documentation set true to the
repository, plus the changelog of the documentation itself. The same rule is also encoded
in the agent contract at
[`universal_toolbook/process/SESSION_PROMPT.md`](../../universal_toolbook/process/SESSION_PROMPT.md)
(see "Documentation maintenance" in its invariants), so agents working from the kit docs
hit it before working from anywhere else.

---

## The rule

> **Whenever a future code change, feature addition, model replacement, workflow
> modification, configuration change, or production-process improvement affects the
> documented pipeline, the relevant documentation MUST be updated in the same development
> task or pull request.**

This applies to, at minimum:

- New AI providers, new models, or a replaced voice backend (any change to what
  `VOICE_GENERATION.md` or the backend table claims).
- Changed prompts — including the voiceover polish standard
  ([`prompts/VOICEOVER_POLISH_PROMPT.md`](prompts/VOICEOVER_POLISH_PROMPT.md)), which may
  only be revised by an explicit, logged decision.
- Modified script-generation or intake processes (Stage 1–7 docs, `script_helper.py`
  behaviour).
- New or changed voice-generation or animation-generation methods (new TTS path, new
  action, new board type, new set extension, new style).
- Changed audio–animation sequencing or retiming behaviour.
- New output formats, resolutions, aspect ratios, or duration gates (CLI flags,
  `VIDEO_ASSEMBLY.md`, `08_LIMITS.md`).
- Modified rendering processes (chunking, resume semantics, report fields, encode path).
- New configuration requirements or environment variables (`CONFIGURATION_AND_SETUP.md`).
- Changed asset storage or folder conventions (`ASSET_MANAGEMENT.md`, `REPO_MAP.md`,
  `outputs/README.md`).
- New approval stages or changed gates (every doc that lists the gates, the boundary table
  in `COMPLETE_WORKFLOW.md`, `SESSION_PROMPT.md`).
- Removed or deprecated features (remove the instructions — do not archive them).
- Changed commands or dependencies (every fenced command block that quotes them).

Documentation changes ship **in the same PR** as the implementation. Deferring doc updates
to a "future cleanup" is a defect, not a task.

## The checklist (run it in the same task as the change)

1. **Identify which documentation pages are affected** — search the docs for the changed
   name/flag/path (`grep -rn "<old name>" docs/ universal_toolbook/ START_HERE.md README.md`).
2. **Update their actual instructions** — rewrite the affected sections for the new
   behaviour; do not append a "note: this changed" that contradicts the text above it.
3. **Correct outdated commands and paths** — every fenced block and backticked path that
   quoted the old form.
4. **Update diagrams where necessary** — the mermaid pipeline in `COMPLETE_WORKFLOW.md`,
   tables in stage docs.
5. **Update this changelog** — one entry, format below.
6. **Verify links and references work** — `python3 tools/check_docs.py` is the gate: every
   path quoted in any markdown must resolve (CI enforces this). Run the test suites the
   change touches (`node tests/run_all_tests.js`, `python3 tests/test_studio_pipeline.py`,
   `python3 tools/validate_specs.py`).
7. **Clearly identify newly implemented capabilities** — flip their status label
   (PROCESS-STANDARD → IMPLEMENTED, PARTIAL → IMPLEMENTED) in `INDEX.md` and the stage
   docs; a capability that is implemented but still labeled planned is a doc bug.
8. **Remove obsolete instructions** — the docs describe the **current repository state**,
   not its history. History lives in this changelog and in git, nowhere else. No
   "previously this was X" paragraphs in operational docs.

## Entry format

```markdown
## YYYY-MM-DD — <short title>
- **Trigger:** <the change that forced this doc update>
- **Docs changed:** <files>
- **What changed in the docs:** <one line each>
- **Status flips:** <PROCESS-STANDARD → IMPLEMENTED etc., or none>
```

---

## Changelog

## 2026-11-03 — Self-hosted TTS subsystem: Kokoro default (Edge → Kokoro → Piper chain)
- **Trigger:** Voiceover quality on Microsoft Edge TTS was unsatisfactory and the service
  is not self-hosted / not guaranteed free. The mission: a completely free, local,
  on-demand TTS that is modular, resumable, tested, and integrated with the render
  pipeline — with the script-polish step untouched.
- **Code changed:**
  - New `universal_toolbook/tts/` package — pluggable `TTSProvider` (Kokoro / Piper /
    Edge), reusable `audio.py` (resample, peak pre-pass, RMS normalize, soft limit,
    analysis), `segment.py` (natural segmentation + pronunciation dictionary),
    `manifest.py` (job ids, per-segment status, resumability), `universal_toolbook/tts/config/voices.json` +
    `universal_toolbook/tts/config/pronunciation_dictionary.json`.
  - New CLIs: `setup_tts.py` (one-time idempotent setup + SHA-256-pinned Kokoro weights),
    `generate_voiceover.py` (the single generation command), `process_audio.py`,
    `validate_audio.py`, and `universal_toolbook/tts/test_tts.py` (the test suite).
  - `universal_toolbook/engine/voice_engine.py`: Kokoro added as the first backend for `--voice auto`
    (and new forced `--voice kokoro`), with Edge then Piper as fallbacks; Kokoro-mode
    voice cache uses a distinct `k1|` signature namespace. Existing Edge/Piper/OS/text-led
    paths are unchanged.
  - `run_studio.py`: `--voice kokoro` choice, `kokoro_ready` in the `check` report,
    updated `_voice_diagnosis` and setup notes.
  - `.gitignore`: `cache/` + `*.npz` (model weights stay out of git).
- **Docs changed:** new `TTS_SETUP.md`, `TTS_ARCHITECTURE.md`, `TTS_BENCHMARK.md`,
  `TTS_TROUBLESHOOTING.md`, `ENVIRONMENT_REPORT.md`. Updated `VOICE_GENERATION.md`
  (§8.1 backends + alias table), `TOOLS_AND_MODELS.md` (models, CLI, config),
  `CONFIGURATION_AND_SETUP.md` (bootstrap, env vars, constraints), `TROUBLESHOOTING.md`
  (TTS routing), `INDEX.md` (supporting references).
- **What changed in the docs:** Edge TTS is now documented as a *fallback* (retained,
  not the default); Kokoro-82M int8 (CPU, 11 voices, free, local) is the default
  voiceover engine with a single setup command and a single generation command.
  Voice-selection guidance, alias tables, configuration surface, and troubleshooting
  routing all reflect the Kokoro → Edge → Piper order. The voiceover polish prompt
  (`prompts/VOICEOVER_POLISH_PROMPT.md`) is **unchanged** — TTS is not a substitute for
  script polishing.
- **Status flips:** Voiceover generation (Stage 8) remains IMPLEMENTED; the standalone
  TTS subsystem (setup/generate/process/validate + resumable manifests) is new and
  IMPLEMENTED (test suite green). No PROCESS-STANDARD stage changed.
- **Known limitations (documented, not hidden):** the installed Kokoro int8 export has
  no native word-boundary output → word timings use the syllable-proportional +
  energy-refined fallback (honest, same path Piper used); generation is CPU-only and
  slower under parallel load; weights must be re-downloaded on a fresh sandbox
  (`setup_tts.py`, ~2 min). See `TTS_BENCHMARK.md` + `TTS_TROUBLESHOOTING.md`.

## 2026-11-03 — Documentation system v1.0 (initial)

- **Trigger:** establishment of the production-workflow documentation set covering the full
  pipeline (idea → publishing), on top of the existing `universal_toolbook/process/`
  procedure docs (script → film).
- **Also fixed (pre-existing CI failure, verified on main):** `examples/test_transitions.json`
  used `"environment": "minimal"`, which is not a preset (the 12 presets are listed in
  `universal_toolbook/01_TOOLBOOK_REFERENCE.md`), so `validate_specs.py` — and therefore the
  CI specs job — failed with an unknown-environment warning. The scene's per-scene `setting`
  was absent, so the fallback to `modern_office` fired. Fixed to `"mind_space"` (dark,
  minimal abstract stage — closest to the fixture's intent). All 11 specs now validate with
  `warnings: []`.
- **Docs changed:** created `docs/production-workflow/`: `INDEX.md`,
  `COMPLETE_WORKFLOW.md`, `IDEA_RESEARCH.md`, `VIRAL_POTENTIAL_EVALUATION.md`,
  `SCRIPT_WORKFLOW.md`, `prompts/VOICEOVER_POLISH_PROMPT.md`, `VOICE_GENERATION.md`,
  `ANIMATION_GENERATION.md`, `AUDIO_VISUAL_SYNCHRONIZATION.md`, `VIDEO_ASSEMBLY.md`,
  `QUALITY_CONTROL.md`, `YOUTUBE_PUBLISHING.md`, `ASSET_MANAGEMENT.md`,
  `TOOLS_AND_MODELS.md`, `CONFIGURATION_AND_SETUP.md`, `TROUBLESHOOTING.md`,
  `FUTURE_DEVELOPMENT.md`, this file. Updated `START_HERE.md`, `README.md`,
  `universal_toolbook/process/README.md`, `universal_toolbook/process/SESSION_PROMPT.md`
  (documentation-maintenance invariant).
- **What changed in the docs:**
  - Stages 1–3 (research, evaluation, selection) and 13 (publishing) are documented as
    **PROCESS-STANDARD / PARTIAL** — no automation exists for them yet; the documents are
    the standard, and `FUTURE_DEVELOPMENT.md` lists the tools that would automate each
    (F1, F2, F3, F4, F5, F17).
  - **Codified the voiceover polish standard.** The English AI voiceover script-editing
    prompt previously supplied to the agent in conversation is now stored at
    `prompts/VOICEOVER_POLISH_PROMPT.md` — the repository's single authoritative version.
    All ten criteria (grammar/sentence structure, conversational English, natural
    delivery, sentence length, punctuation/pauses, spoken numbers and symbols,
    pronunciation-safe terminology, brand names/proper nouns, preserved tone and meaning,
    TTS compatibility) are encoded in full prompt form, plus the verbatim-mode constraint
    that `validate --script` token-fidelity enforces.
  - Documented verified engine internals the stage docs depend on: per-line voice cache
    key `sha1(voice|rate|pitch|text)` and the keep/delete procedure for re-voicing one
    section; the quiet failure mode where a line failing all TTS backends is dropped from
    audio while the film still reports `voiced: true`; chunk resume being content-blind;
    external-audio path (`--voice-dir`, `<sceneId>.wav`).
  - Established the `work/<slug>/` project-folder convention (idea.md, decisions.md,
    samples/, script_v1.md, script_polished.md, episode.json) as the working-area standard.
  - Established the 10-criterion weighted viral-potential rubric (weights sum to 100;
    feasibility is a veto) as the Stage 2 standard.
- **Status flips:** none (no code change); existing IMPLEMENTED capabilities re-verified and
  cross-linked.
