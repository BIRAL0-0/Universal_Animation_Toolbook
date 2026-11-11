---
name: youtube-research
description: "Discover YouTube topics, evaluate viral potential, fact-check claims and record evidence before writing a script."
---

# Skill: youtube-research

## When to use

**Activate when:** a request gives only an idea, asks to discover/find/choose a YouTube topic,
supplies a title or subject that needs evidence, asks for a viral-potential evaluation, or asks
for fact-checking before scripting. Also activate for "find a topic and make a video" and for
"another one" when fresh topic research is appropriate.

**Authority:** detailed procedure is in
[`docs/production/IDEA_RESEARCH.md`](../../docs/production/IDEA_RESEARCH.md),
[`docs/production/VIRAL_POTENTIAL_EVALUATION.md`](../../docs/production/VIRAL_POTENTIAL_EVALUATION.md)
and stages 1–3 of [`docs/production/COMPLETE_WORKFLOW.md`](../../docs/production/COMPLETE_WORKFLOW.md).
Save evidence in the project's `RESEARCH.md` and `TOPIC_SELECTION.md`.

## Purpose

Decide what is worth making and know, before a word is written, which parts of it are measured,
which are observed and which are guesses. A video built on an unlabelled prediction is a video
that can be confidently wrong.

## Inputs

A topic or a brief, the target audience, and any existing videos on the same subject. Research with
no topic is browsing, so the topic is a hard input — if the request is only "find something", the
first output is a shortlist, not a script.

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

## Rules

- Never call a topic "viral" on a guess. Predicted reach stays `[P]`.
- Never present a prediction as a measured quantity, in a document or in narration.
- A claim with no reachable source is labelled as unsourced, not omitted quietly.
- The user's supplied subject is scored, never silently replaced by a topic that scores better.
- Research that is not saved to `RESEARCH.md` did not happen.
- Do not invent analytics: this repository has no access to views, CTR or retention.

## Common mistakes

| Mistake | Why it fails |
| --- | --- |
| Researching in chat and never saving it | The next session re-derives everything, possibly differently |
| Promoting a thought experiment to a fact | The film then asserts something nobody measured |
| Choosing the highest-scoring topic over the user's | The user asked for their subject; score it, do not swap it |
| Treating feasibility as one weighted input | It is a veto — an unmakeable idea scores zero however exciting |
| Reporting "no sources found" as "no sources exist" | Those are different claims |

## Quality checklist

- [ ] Idea brief written for every candidate considered
- [ ] Every source has a URL, an access date and what was actually observed
- [ ] Every claim labelled `[M]`, `[O]` or `[P]`
- [ ] No spoken number with Medium confidence or below
- [ ] Ten-criterion rubric applied, feasibility used as a veto
- [ ] `TOPIC_SELECTION.md` names the chosen topic **and** the rejected ones with reasons
- [ ] Supplied subject scored rather than replaced
- [ ] Evidence handed to `scriptwriting` by file, not by memory

## Implementation references

| Need | File |
| --- | --- |
| Research procedure | [`docs/production/IDEA_RESEARCH.md`](../../docs/production/IDEA_RESEARCH.md) |
| Scoring rubric | [`docs/production/VIRAL_POTENTIAL_EVALUATION.md`](../../docs/production/VIRAL_POTENTIAL_EVALUATION.md) |
| Stages 1–3 | [`docs/production/COMPLETE_WORKFLOW.md`](../../docs/production/COMPLETE_WORKFLOW.md) |
| Claim labelling in the record | [`youtube-packaging`](../youtube-packaging/SKILL.md) |
| What verified publishing numbers exist | [`docs/production/YOUTUBE_PUBLISHING.md`](../../docs/production/YOUTUBE_PUBLISHING.md) |

## Examples

### The claim that had to be cut

A draft asserts "bamboo grows three metres in six weeks". No source supports the specific figure;
one popular article repeats it without citation. The line is cut from narration, and the film keeps
its ground-level device: a tag that measures the *fable*, not botany. What survives is honest — the
visual carries the claim the research could not.

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

## Examples

### A topic that cannot be sourced

Three searches produce nothing verifiable. Change the topic or reframe it as a fable and label the claims.

