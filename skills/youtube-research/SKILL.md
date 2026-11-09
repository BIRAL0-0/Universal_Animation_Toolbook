---
name: youtube-research
description: "Discover YouTube topics, evaluate viral potential, fact-check claims and record evidence before writing a script."
---

# Skill: youtube-research

**Activate when:** a request gives only an idea, asks to discover/find/choose a YouTube topic,
supplies a title or subject that needs evidence, asks for a viral-potential evaluation, or asks
for fact-checking before scripting. Also activate for "find a topic and make a video" and for
"another one" when fresh topic research is appropriate.

**Authority:** detailed procedure is in
[`docs/production/IDEA_RESEARCH.md`](../../docs/production/IDEA_RESEARCH.md),
[`docs/production/VIRAL_POTENTIAL_EVALUATION.md`](../../docs/production/VIRAL_POTENTIAL_EVALUATION.md)
and stages 1–3 of [`docs/production/COMPLETE_WORKFLOW.md`](../../docs/production/COMPLETE_WORKFLOW.md).
Save evidence in the project's `RESEARCH.md` and `TOPIC_SELECTION.md`.

## Procedure

1. **Define the idea brief.** One file per candidate idea: title, audience, premise, thesis,
   angle, evidence needs, feasibility. Research is a documented procedure, not an automated tool
   in this repository — do not claim a script exists when it does not.
2. **Research reachable sources.** Record URL/source, access date and what was actually observed.
   If no source is reachable, say so explicitly and mark the output as prediction, not measurement.
3. **Evidence hygiene.** Label every claim:
   - **[M] measured performance** — a number from a real measurement;
   - **[O] observed trend** — a qualitative, sourced observation;
   - **[P] prediction / hypothesis** — our expectation or a thought experiment.
   Never call a topic "viral" on a guess. Never present a prediction as a measured quantity.
4. **Fact-check before narration.** Every number asserted in the script must trace to a High or
   Medium-High confidence row in `RESEARCH.md` §5. Medium-confidence figures stay out of
   narration. Thought experiments are introduced as such, not as measured facts.
5. **Evaluate candidates.** Use the 10-criterion weighted rubric in
   `VIRAL_POTENTIAL_EVALUATION.md` (weights sum to 100; feasibility is a veto). Score the supplied
   subject even when a different topic looks more popular — never abandon the user's subject.
6. **Select and justify.** `TOPIC_SELECTION.md` records the chosen topic, rejected alternatives,
   score, rationale and date. Improve a supplied title only if intent is preserved.
7. **Hand off to scripting.** [`scriptwriting`](../scriptwriting/SKILL.md) uses the evidence rows
   and the saved research file; do not re-research silently in chat without saving it.

## Publishing preparation (not publishing)

Stage 13 of the workflow prepares chapter labels, metadata, thumbnail candidates and captions
notes. Upload is a human action requiring explicit authorization; no YouTube API credentials are
stored in this repository. See [`docs/production/YOUTUBE_PUBLISHING.md`](../../docs/production/YOUTUBE_PUBLISHING.md).

## Rules

- No channel name or branding anywhere in the repository.
- No copyrighted script, scene, character or chapter list is reproduced from a reference video.
- Sources and dates are mandatory for every factual claim.
- If research is skipped or impossible, record the reason in `PRODUCTION_LOG.md` and label the
  resulting concept as a prediction.
