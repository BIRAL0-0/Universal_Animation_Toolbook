# ADR-0001 — Remotion knowledge integrated, Remotion runtime not adopted

**Date:** 2026-11-09 · **Status:** Accepted · **Decision owner:** repository architecture review

## Context

The user supplied the Remotion Agent Skills reference list and documentation as an animation
engineering knowledge source, with an explicit warning: the Toolbook uses a **custom JavaScript
frame renderer plus a Python audio/TTS pipeline**, and is not a Remotion application. React,
Remotion, Tailwind, Three.js and React Three Fiber must not be introduced merely because they
appear in the skill. Relevant knowledge must still become a permanent local skill teaching agents
how to use the *actual* renderer.

## Evidence

- `universal_toolbook/package.json` declares only optional canvas backends (`@napi-rs/canvas`,
  `canvas`). No React, Remotion, bundler, Three.js, Lottie or Tailwind dependency exists.
- All 15 `universal_toolbook/engine/*.js` modules are plain CommonJS with relative
  `require('./x')`; `tests/regression/run_all_tests.js` imports 9 of them by path.
- The renderer already implements `frameIdx / fps` timing, `clamp`/`lerp`/`ease`/`springEase`,
  compiled scene in/out frames, chapter sequencing, speech-locked camera/board cues, screen-space
  subtitles with multi-word word-glow, burned-in captions, uniform portrait reframing, bundled
  fonts and CC music, foley, ducking and loudness normalisation.
- `voice_engine.py` performs dynamic duration calculation from measured speech before rendering —
  the functional equivalent of composition metadata derived from media, but in Python.
- The baseline test suite (JS regression, Python pipeline, 22 production tests, 11 validated
  specs and a silent draft render) all passed before the reorganization.

## Evaluation of the eight required questions

1. **Which techniques apply directly to the frame renderer?** Frame-driven time, interpolation,
   easing, spring physics, sequencing via in/out points, composition metadata, screen-space
   typography, caption timing and asset preloading. All have direct Toolbook equivalents.
2. **Which improve animation timing?** A single pure `f(frame)` clock and normalised interpolation.
   Already present; Remotion's `useCurrentFrame()`/`interpolate()`/`spring()` are API shapes, not
   missing capabilities.
3. **Which improve scene sequencing?** `Sequence`/`Series` map to ordered `scenes[]` with compiled
   `startFrame`/`endFrame`; `calculateMetadata` maps to speech-locked retiming already in Python.
4. **Which improve transitions and camera?** Prebuilt transition packages would add effects, but
   environment fades, cuts, blackouts, split screen and speech-locked camera shots already exist.
   A new primitive belongs in `video_renderer.js` with a JS regression test.
5. **Which improve captions and typography?** SRT import/transcription would add real caption-file
   workflows; burned-in subtitles and word highlights are already implemented. SRT export is
   roadmap F4, not a runtime feature.
6. **Which improve media synchronization?** Audio/video probing maps to existing Python validation
   reports; word timings already drive cues. No gap justifies a runtime swap.
7. **Which features require an actual Remotion runtime?** React composition trees,
   `useCurrentFrame`, `useVideoConfig`, `<Sequence>`, `calculateMetadata`, `@remotion/three`,
   React Three Fiber, Lottie, Tailwind, Mediabunny, Remotion Studio and the bundler.
8. **Would adopting Remotion improve production quality enough?** **No, on current evidence.** It
   would replace a deterministic, dependency-light, tested 2D renderer with a React build
   pipeline; re-implement 15 JS modules; re-integrate Python TTS, BGM, foley, speech-locked cues
   and portrait framing; add large dependencies and a second source of truth; and require every
   existing regression test to be rewritten. No measured quality or speed benefit was demonstrated.

## Licence verification

The brief stated MIT and required verification before copying materials. On 2026-11-09:
`api.github.com/repos/remotion-dev/skills` reports `license: null`; the licence endpoint returns
404; the repository root contains no licence file; a source archive contains no licence file and
no MIT string; `remotion-dev/remotion` reports `NOASSERTION`. Therefore **no upstream text, code
or reference file was copied**. The local skill contains original prose; Remotion API names are used
descriptively. See
[`skills/animation-production/references/ATTRIBUTION.md`](../../skills/animation-production/references/ATTRIBUTION.md).

## Decision

1. Create a permanent primary skill at
   [`skills/animation-production/SKILL.md`](../../skills/animation-production/SKILL.md) that teaches
   the 20-stage workflow using the actual Toolbook architecture.
2. Adapt framework-independent animation knowledge in
   [`skills/animation-production/references/frame-based-animation.md`](../../skills/animation-production/references/frame-based-animation.md)
   and the real module/schema map in
   [`skills/animation-production/references/toolbook-renderer-map.md`](../../skills/animation-production/references/toolbook-renderer-map.md).
3. Quarantine Remotion-specific APIs, clearly labelled as **not adopted**, in
   [`skills/animation-production/references/remotion-techniques.md`](../../skills/animation-production/references/remotion-techniques.md).
4. **Do not add** React, Remotion, Three.js, React Three Fiber, Lottie, Tailwind, Mediabunny or
   any unused React/Remotion code. No second animation engine is created.
5. Revisit only with a tested spike that renders the same minimal episode with the same reports,
   preserves every audio/framing/resume behaviour, passes all existing tests without weakening a
   gate, measures install size and render time, and records a new ADR before adding a dependency.

## Consequences

- The skill teaches agents to use the real renderer; Remotion is an optional technology decision.
- No new runtime dependencies and no migration risk for the 15-module engine or Python pipeline.
- SRT import/transcription and prebuilt 3D/Lottie transitions remain explicitly out of scope;
  roadmap F4 documents the caption export gap.
- Attribution and licence notes are kept with the skill rather than an unverified MIT claim.

## Verification

- `tools/validate_structure.py` asserts no Remotion/React dependency in `package.json` and no
  React/Remotion source files in `universal_toolbook/`.
- `skills/animation-production/SKILL.md` and its references are linked from `AGENTS.md` and
  `README.md`; `tools/check_docs.py` resolves every link.
- Baseline and post-reorganization JS/Python/CI suites pass; no renderer code was changed for this
  decision.
