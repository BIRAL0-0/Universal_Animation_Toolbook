# Agent Skills

Permanent, structured procedural and domain knowledge for autonomous agents working in this
repository.

| Skill | When to activate | Entry point |
|---|---|---|
| `animation-production` | Any request to create, continue, repair, render, inspect or archive a video (primary orchestrator) | [`animation-production/SKILL.md`](animation-production/SKILL.md) |
| `character-design-and-rigging` | Canonical single-colour character design, Minkowski capsule rig anatomy, seamless joint geometry | [`character-design-and-rigging/SKILL.md`](character-design-and-rigging/SKILL.md) |
| `stickman-animation` | Locomotion cycles, seated/standing postures, expressive body language, 70 supported actions | [`stickman-animation/SKILL.md`](stickman-animation/SKILL.md) |
| `physical-interactions-and-props` | Phone, desk, table, chair, cup, laptop, book and door contact/grip/parent-switching interactions | [`physical-interactions-and-props/SKILL.md`](physical-interactions-and-props/SKILL.md) |
| `animation-principles` | Classical 12 animation principles, easing, anticipation, follow-through, continuous beat handoff | [`animation-principles/SKILL.md`](animation-principles/SKILL.md) |
| `cinematic-composition` | 16:9 & 9:16 shot framing, locked near-black studio visual identity, safe zones, camera cuts | [`cinematic-composition/SKILL.md`](cinematic-composition/SKILL.md) |
| `environment-and-asset-continuity` | Persistent room geography, canonical prop IDs, cross-cut object state continuity | [`environment-and-asset-continuity/SKILL.md`](environment-and-asset-continuity/SKILL.md) |
| `subtitles-and-typography` | Collision-aware subtitle placement, highlight spacing, speech-end cutoff, unclipped chapter headers | [`subtitles-and-typography/SKILL.md`](subtitles-and-typography/SKILL.md) |
| `animation-scriptwriting` | Visually staged animated narration, short natural clauses, `pause_after` cadence, `accent_words` | [`animation-scriptwriting/SKILL.md`](animation-scriptwriting/SKILL.md) |
| `youtube-storytelling-and-hooks` | First-3-second visual+spoken hooks, retention pacing for `<60s` Shorts vs `>=60s` long-form | [`youtube-storytelling-and-hooks/SKILL.md`](youtube-storytelling-and-hooks/SKILL.md) |
| `sound-design` | Stereo contact foley, BGM mood selection, `-9.5 dB` speech ducking, broadcast loudness targets | [`sound-design/SKILL.md`](sound-design/SKILL.md) |
| `animation-quality-assurance` | Automated 17-scenario visual regression suite + mandatory frame-by-frame visual inspection | [`animation-quality-assurance/SKILL.md`](animation-quality-assurance/SKILL.md) |
| `scriptwriting` | General script intake, polishing via `VOICEOVER_POLISH_PROMPT.md`, meaning preservation | [`scriptwriting/SKILL.md`](scriptwriting/SKILL.md) |
| `voiceover-audio` | Kokoro `am_michael` / Piper TTS setup, word-level alignment, speech synchronization | [`voiceover-audio/SKILL.md`](voiceover-audio/SKILL.md) |
| `youtube-research` | Topic discovery, primary-source verification, `[M]`/`[O]`/`[P]` claim confidence | [`youtube-research/SKILL.md`](youtube-research/SKILL.md) |
| `production-quality` | Pre-delivery MP4 container decode, audio measurement, QA report sign-off | [`production-quality/SKILL.md`](production-quality/SKILL.md) |

## Boundaries

- **Authoritative rules and activation map:** [`AGENTS.md`](../AGENTS.md). Do not duplicate those
  rules across skill files; link to `AGENTS.md` and keep each skill focused on its craft.
- **Engine runtime:** [`universal_toolbook/`](../universal_toolbook/README.md). Skills are
  repository-level agent documentation, **not** runtime dependencies of the kit. The kit must work
  if copied out on its own without `skills/`.
- **Third-party animation knowledge:** framework-independent ideas adapted from Remotion's
  documentation and `remotion-dev/skills` live in
  [`animation-production/references/frame-based-animation.md`](animation-production/references/frame-based-animation.md);
  React/Remotion-specific APIs are quarantined in
  [`animation-production/references/remotion-techniques.md`](animation-production/references/remotion-techniques.md);
  licence and attribution details are in
  [`animation-production/references/ATTRIBUTION.md`](animation-production/references/ATTRIBUTION.md)
  and [`docs/decisions/ADR-0001-remotion-evaluation.md`](../docs/decisions/ADR-0001-remotion-evaluation.md).
