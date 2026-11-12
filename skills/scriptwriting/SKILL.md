---
name: scriptwriting
description: "Classify a video brief, research and fact-check the topic, write and polish narration, and preserve original and polished scripts with a changelog."
---

# Skill: scriptwriting

## When to use

**Activate when:** a video request arrives with only an idea, a topic, a title, a reference video,
a draft script, a complete script, or a request to improve/polish narration, hook, structure,
pacing, dialogue or factuality. Always activate alongside
[`animation-production`](../animation-production/SKILL.md) for a video request.

**Authority:** this skill owns the *writing procedure*. The immutable editing standard is
[`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](../../docs/production/prompts/VOICEOVER_POLISH_PROMPT.md);
the per-video prompt template is
[`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](../../templates/MASTER_VIDEO_PRODUCTION_PROMPT.md);
detailed stages 1–6 are in
[`docs/production/COMPLETE_WORKFLOW.md`](../../docs/production/COMPLETE_WORKFLOW.md) and
[`docs/production/SCRIPT_WORKFLOW.md`](../../docs/production/SCRIPT_WORKFLOW.md).

## Purpose

Turn a brief, a topic or a supplied script into narration that can actually be spoken, timed and
animated — and leave a record showing which words were reused, which were changed and why.

## Inputs

A brief or supplied script, the intake class (A–F), and the target duration. The class decides which
stages are skipped. A script with no target duration cannot be paced, so the duration is an input,
not an output.

## Procedure

1. **Classify input.** Idea/topic → research and concept first; title → research that subject and
   preserve intent; complete script → polish without changing meaning; reference → analyse craft,
   write an original script; "another one" → new independent project.
2. **Research and fact-check.** Use [`youtube-research`](../youtube-research/SKILL.md). Save
   `RESEARCH.md` with sources, dates and confidence. Label measured `[M]`, observed `[O]`,
   predicted `[P]`. Every number spoken in narration must trace to a high-confidence row.
3. **Fix the delivery target before writing.** Runtime, aspect, scene count and approximate word
   budget. Use ~2.5 words/second as a first budget; the engine later retimes scenes to measured
   speech. Long-form essays and Shorts have different hooks — do not write one script and stretch it.
4. **Structure.** Hook in the first 10 seconds, start in the middle of the premise, carry one
   metaphor, prove by showing the same conditions with one variable changed where possible, vary
   sentence length, close on an originally worded direct-address question. Give every scene one
   clear visual purpose.
5. **Write for the ear.** Short spoken sentences (8–16 words), complete grammar, punctuation that
   means a pause, numbers and symbols written as spoken, pronunciation-safe terminology. One
   sentence per `dialogue[]` entry: subtitles are per-line and long lines cover characters.
6. **Polish with the immutable standard.** Apply
   [`VOICEOVER_POLISH_PROMPT.md`](../../docs/production/prompts/VOICEOVER_POLISH_PROMPT.md)
   **exactly as it exists, byte-for-byte**. Never rewrite, summarise or weaken it. In verbatim
   mode keep every word in order; propose meaning-changing edits and wait for approval instead of
   making them silently.
7. **Save the evidence.** `SCRIPT_ORIGINAL.md`, `SCRIPT_POLISHED.md`, `SCRIPT_CHANGELOG.md`
   (per change: line touched + rule that justified it). Copy the approved polished text verbatim
   into `episode.json` `dialogue[].text` / `scene.narration`; no editing between approval and render.
8. **Verify fidelity.** For a verbatim script run
   `python3 universal_toolbook/run_studio.py validate projects/<slug>/episode.json --script projects/<slug>/SCRIPT_ORIGINAL.md`
   and require `exact_word_match: true`. The check is punctuation-insensitive, order-sensitive.
9. **Mute-legibility.** Read the storyboard with the narration removed. If the visuals do not tell
   the story, fix the scene design, not the voiceover.

## Rules

- English narration unless the user explicitly asks otherwise.
- No new claims, dropped beats or changed punchlines during polish.
- Never call a topic viral on a guess; distinguish evidence from prediction.
- Do not create a second polish standard in a project file or a chat message.
- Record deviations and skipped stages in `PRODUCTION_LOG.md`; never claim a review that did not happen.

## Common mistakes

| Mistake | Why it fails |
| --- | --- |
| Writing the script before fixing the duration | Pacing is a function of runtime; the script comes out unfixable |
| Polishing from memory instead of from `VOICEOVER_POLISH_PROMPT.md` | A weaker standard silently replaces the authoritative one |
| Class C treating supplied text as verified | A supplied script can be wrong; the claim audit still applies |
| Long sentences with subordinate clauses | The voice cannot pause where the grammar needs it |
| Two ideas in one `dialogue[]` line | Subtitles are per-line; the second idea covers the frame |
| Editing between approval and render | Breaks `exact_word_match`; the approved thing is not what shipped |

## Quality checklist

- [ ] Intake class recorded (A–F) and the skipped stages named
- [ ] `RESEARCH.md` exists with sources, dates and confidence per claim
- [ ] Every spoken number traces to a row in that research
- [ ] Duration and format fixed before the first line was written
- [ ] Hook lands inside the first 10 seconds and states the premise, not the contents
- [ ] Sentences are 8–16 words and sayable in one breath
- [ ] `VOICEOVER_POLISH_PROMPT.md` applied as it exists, not summarised
- [ ] `SCRIPT_ORIGINAL.md`, `SCRIPT_POLISHED.md`, `SCRIPT_CHANGELOG.md` all saved
- [ ] `exact_word_match: true` where a verbatim script was required
- [ ] Storyboard readable with the audio off

## Implementation references

| Need | File |
| --- | --- |
| The immutable editing standard | [`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](../../docs/production/prompts/VOICEOVER_POLISH_PROMPT.md) |
| Writing stages 1–6 | [`docs/production/SCRIPT_WORKFLOW.md`](../../docs/production/SCRIPT_WORKFLOW.md) |
| Research procedure | [`youtube-research`](../youtube-research/SKILL.md) |
| Hooks and retention | [`youtube-storytelling-and-hooks`](../youtube-storytelling-and-hooks/SKILL.md) |
| Packaging decided from the script | [`youtube-packaging`](../youtube-packaging/SKILL.md) |
| Per-video prompt template | [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](../../templates/MASTER_VIDEO_PRODUCTION_PROMPT.md) |
| Word-match verification | `universal_toolbook/run_studio.py validate <episode> --script <original>` |

## Examples

### A supplied script that is factually wrong

Intake class C skips the writing stages but not the claim audit. Label the wrong claim `[P]` or cut it.

### A line that keeps failing the breath test

"Because the thing that most people never realise about notifications, and this is the part that
actually matters, is that the interruption is not the cost." — 27 words, two interruptions to its own
clause. Split: "The interruption is not the cost. / The recovery is." Two lines, two beats, and the
second one lands.

