---
name: scriptwriting
description: "Classify a video brief, research and fact-check the topic, write and polish narration, and preserve original and polished scripts with a changelog."
---

# Skill: scriptwriting

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
