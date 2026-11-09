# Permanent agent skills

These are executable procedures for autonomous agents, not decorative documentation.
[`AGENTS.md`](../AGENTS.md) is the **authoritative activation map and rule set**; each `SKILL.md`
below is the single authoritative procedure for its responsibility. Do not copy a skill's text into
another instruction file — link to it.

| Task | Skill | Primary file |
|---|---|---|
| Any video creation / animation / render / troubleshooting request | animation-production | [`animation-production/SKILL.md`](animation-production/SKILL.md) |
| Discover a YouTube topic, research, fact-check | youtube-research | [`youtube-research/SKILL.md`](youtube-research/SKILL.md) |
| Create or improve a script, polish narration | scriptwriting | [`scriptwriting/SKILL.md`](scriptwriting/SKILL.md) |
| Design stickman characters, poses, actions, boards, camera | stickman-animation | [`stickman-animation/SKILL.md`](stickman-animation/SKILL.md) |
| Generate narration, mix audio, measure loudness | voiceover-audio | [`voiceover-audio/SKILL.md`](voiceover-audio/SKILL.md) |
| Render and inspect an MP4, QA sign-off, error recovery | production-quality | [`production-quality/SKILL.md`](production-quality/SKILL.md) |

`animation-production` is the primary skill: it orchestrates the 20-stage workflow and delegates to
the specialist skills. Its [`references/`](animation-production/references/) contain the real
renderer map, framework-independent animation principles, the clearly quarantined Remotion-specific
techniques, and the source attribution / licence verification.

**Remotion status:** evaluated, **not adopted**. See
[`docs/decisions/ADR-0001-remotion-evaluation.md`](../docs/decisions/ADR-0001-remotion-evaluation.md).
No React, Remotion, Three.js, Lottie or Tailwind code exists in this repository.
