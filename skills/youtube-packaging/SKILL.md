---
name: youtube-packaging
description: "Choose the hook, title and thumbnail as one promise: generate real candidates, score the script honestly, build a retention map, and prove title/thumbnail/hook alignment before rendering."
---

# Skill: youtube-packaging

## When to use

**Activate when:** any video is being created, retitled, re-thumbnailed, or when a shipped video's
packaging is being reviewed or fixed. Always activate **before** the script is finalised, because
the hook is part of the script, not an afterthought applied to it.

**Authority:** this skill owns the *packaging decisions*. Verified numbers live in
[`docs/production/YOUTUBE_PUBLISHING.md`](../../docs/production/YOUTUBE_PUBLISHING.md) §13.0 and
§13.0.1 and are not restated here. The machine gate is
[`tools/creative_gate.py`](../../tools/creative_gate.py). The evidence write-up is
[`docs/production/CREATIVE_PACKAGING.md`](../../docs/production/CREATIVE_PACKAGING.md).
Script craft is [`scriptwriting`](../scriptwriting/SKILL.md) and
[`youtube-storytelling-and-hooks`](../youtube-storytelling-and-hooks/SKILL.md).

---

## Purpose

The repository could already prove a video *rendered* — resolution, sync, loudness, palette match,
description word count. It could not prove anyone would ever click. All eight shipped films were
built with no recorded reasoning about the hook, the title or the thumbnail, so the packaging was
whatever got typed last.

Packaging is a decision with candidates and a rejected list. If nothing was rejected, nothing was
chosen. `tools/creative_gate.py` now fails a video that cannot show its rejected options.

## The one promise rule

A viewer sees **one** promise made by three things at once:

| Component | Its job | Must not do |
|---|---|---|
| Title | create the question | promise a different video |
| Thumbnail | make that question *visible*, in one frame | restate the title |
| Hook (first ~5s) | begin answering immediately | delay the premise |

If the thumbnail already says the title, one surface is wasted. If the hook does not touch the
title's promise, the viewer feels baited even when the video is good.

## Procedure

## Inputs

The finished script, the film's visual identity, and the promise in one sentence. Packaging is decided from the script, so the script must exist first.

### 1. Decide the promise in one sentence, before writing

Write the sentence a viewer would say after clicking: *"I clicked because I wanted to know ___."*
If you cannot complete it, the concept is not ready. Record it as `creative.alignment.title_promise`.

### 2. Draft at least three genuinely different hooks

Different *angles*, not different wording of one angle. Useful angle families:

- **The prohibition** — "Never look at the clock at 3 AM." (needs an instant reason in line 2)
- **The reframe** — "You never lose an hour all at once."
- **The number** — "Two inches. Nobody measured it."
- **The wrong conclusion** — "He hit a wall. So he assumed it was permanent."
- **The cost already paid** — "Eleven notifications before noon."
- **The question the viewer already has** — "What did you do differently? Nothing."

Then choose one and write **why**, including what you gave up. The gate requires `why` on the
selected hook, and rejects the generic openers ("Have you ever wondered…", "In this video…",
"Today we're going to talk about…", "Welcome back…").

The hook must be inside the first 8 seconds, and its words must actually be spoken in the film —
the gate compares the recorded hook against the record's dialogue.

### 3. Draft titles from at least four different strategies

Seven approaches are recognised; four must be represented before the choice is a strategy rather
than a rewording. Label each candidate with `approach`:

| `approach` | What it does | Example shape |
|---|---|---|
| `curiosity_gap` | withholds what the film reveals | "Why Your Hard Work Looks Like Nothing" |
| `question` | asks what the viewer is already asking | "Would You Keep Watering If Nothing Grew?" |
| `outcome_number` | a concrete quantity or result | "Five Years Of Watering Nothing" |
| `contradiction` | two ideas that should not coexist | "You Are Not Weak. Your Room Is Designed Against You." |
| `stakes_loss` | what it costs to get this wrong | "The Two Inches That Flooded A Valley" |
| `identity` | who this is for, or who they are | "Why Slow Growth Is Not Failed Growth" |
| `reversal` | the expected ending, inverted | "It Was Never There" |

Fill `creative.title_candidates`, mark the chosen one `selected: true`; its text must equal
`record.json` `title` exactly.

Title rules, honestly applied:

- The keyword must earn its place. If a search phrase makes the title unnatural, drop it.
- No number you cannot stand behind.
- No promise the film does not keep.
- If the title carries a number that differs from what the film says, **the title is wrong** —
  fix the title, not the film's facts. (This exact defect was found in
  `discipline-vs-obsession`: title said "9 PM vs 2 AM", the film's clock reads 9 PM and 1 AM.)

### 4. Design at least three thumbnail concepts

`creative.thumbnail_concepts` needs a **different focal subject** per concept — the gate rejects
three versions of the same shot. Each concept records focal subject, emotion, and optional text.

Then:

1. Choose one, mark `selected: true`.
2. Generate the **base art separately** (`generate_image`), in the film's own visual language,
   with no lettering — AI lettering is unreliable and is banned by the house style.
3. Typeset with [`tools/compose_thumbnail.py`](../../tools/compose_thumbnail.py)
   (portrait `1080x1920` → `--art-fraction 0.78`; landscape `1280x720` →
   `--art-fraction 0.72 --band-fill --band-darken`).
4. Check copy with [`tools/thumbnail_copy.py`](../../tools/thumbnail_copy.py): one to three
   content words, at least one not in the title.
5. Check palette with [`tools/thumbnail_style.py`](../../tools/thumbnail_style.py)
   `check <video> <thumbnail> --package videos/<slug>`.
6. **Look at it at 168 px wide on a grid with the other covers** (the phone search width). If the
   face is unreadable or the subject is small, it is a video still, not a cover — redraw it.

Rejected thumbnail concepts go in the record too. That rejection list is the evidence of work.

### 5. Build the retention map

`creative.retention_map` needs at least a `hook`, an `escalation` or `reveal`, and a `payoff`, each
with a stated `purpose` and an `at_sec`. Map it onto real scene timings, not proportions you made up.

Ask of every stretch longer than ~20 s: what does the viewer learn here that they did not know?
If the answer is "nothing, but it looks nice", cut it or move a reveal into it.

### 6. Score the script honestly

`creative.script_critique.scores` covers ten criteria on a 1–5 scale, plus `weakest` and
`revision`. Two rules:

- **Name a weakest criterion.** A draft where everything is a 5 was not read critically.
- **Record a revision.** A critique that changed nothing is theatre.

A high score is not a substitute for judgement. `the-first-plank` scores 2/5 on `opening_hook` in
its own record, and that is the correct, useful answer — it opens on a desk instead of on a
problem, and it is flagged for a future re-edit rather than scored away.

### 7. Complete the SEO package

These live at the top level of `record.json`, not inside `creative`, and `creative_gate.py`
requires them:

| Field | Rule |
|---|---|
| `primary_keyword` | the one phrase the video is trying to win; it must appear in the title and slug |
| `secondary_keywords` | 1–3 supporting phrases a real person would type |
| `title_alternates` | ≥ 2 genuinely usable alternates, never the title in use |
| `hashtags` | 3–5, each with `#` — YouTube shows the first three |
| `category` | the YouTube category this belongs in |

`tools/seo_audit.py` scores the description, tags and title against this package. A high score
still is not a promise of reach.

### 8. Review the rendered film, not just the plan

Once the master exists, `tools/creative_review.py` asks what only the artifact can answer: does the
opening actually move, where does the film go static, is the promised payoff where the record says,
and does the record describe the file. Run it with `--frames` and **look at the saved frames** — the
questions it cannot answer are the ones that matter.

For the cover, `tools/thumbnail_legibility.py --all --sheet <path>` renders every cover at 168 px
and 216 px. Open that sheet. The tool gates only on two covers being the same picture; it will not
tell you whether yours reads, because no measure it has can be trusted to (that was tested — see
`docs/production/CREATIVE_PACKAGING.md` §2.1).

### 9. Label every claim

`creative.claims[]` takes `{text, label, used_as}` with `label` in `M` (measured), `O` (observed)
or `P` (predicted). A `P` may never be `used_as: "fact"`. Do not invent a study, a percentage or a
CTR. If no data was collected, say so — that is a `limitation`, not a loss.

## Rules

- Packaging decisions happen **before** the render, in `record.json`, not after in a chat message.
- Never ship a default: if you cannot show the alternatives you rejected, you did not choose.
- Never restate the title on the cover. Ever. `thumbnail_copy.py` enforces it.
- Never present a prediction as a measurement.
- No CTR, retention or virality promises. The repository has no analytics access; anything else
  would be fabricated.
- A technically perfect render with unexamined packaging is an unfinished video.

## Quality checklist

- [ ] One-sentence promise written and recorded
- [ ] ≥3 distinct hook candidates, one selected with a `why`
- [ ] Selected hook lands ≤8 s and its words appear in the film
- [ ] ≥4 distinct title approaches labelled, selected title matches `record.json` exactly
- [ ] SEO package present: primary + secondary keywords, alternates, hashtags, category
- [ ] ≥3 thumbnail concepts with different focal subjects
- [ ] Base art generated separately; type added by `compose_thumbnail.py`
- [ ] `thumbnail_copy.py` and `thumbnail_style.py` both pass
- [ ] Contact sheet rendered with `thumbnail_legibility.py` and inspected at 168/216 px
- [ ] No two covers are the same picture at phone size
- [ ] Retention map has hook + escalation/reveal + payoff, each with a purpose
- [ ] Ten critique criteria scored, weakest named, revision recorded
- [ ] Every claim labelled `M`/`O`/`P`; no prediction presented as fact
- [ ] `python3 tools/creative_gate.py` passes
- [ ] `python3 tools/creative_review.py --check <slug>` passes and its saved frames were looked at

## Also see

| Need | Where |
| --- | --- |
| Writing the script this packages | [`scriptwriting`](../scriptwriting/SKILL.md) |
| Hooks and retention arcs | [`youtube-storytelling-and-hooks`](../youtube-storytelling-and-hooks/SKILL.md) |
| Post-render QA | [`production-quality`](../production-quality/SKILL.md) |

## Common mistakes

| Mistake | Why it fails |
|---|---|
| Three hooks that are one sentence reworded | Not candidates; the gate detects duplicate text |
| Choosing the loudest hook | Volume is not curiosity. Choose the strongest *honest* hook |
| Thumbnail = an extracted frame | A still is not a cover. Redraw with one subject, one light, one gesture |
| Cover text = title words | Wastes one of the two click surfaces; `thumbnail_copy.py` fails it |
| Every criterion scored 5 | Means the script was not critiqued |
| Writing the hook in the record only | The gate compares it to the spoken dialogue |
| Promising "this will get clicks" | No analytics exist; state it as a prediction or not at all |
| Trusting a legibility number over your eye | The numbers were tested and lost; look at the contact sheet |
| Three titles that are one idea reworded | Not a comparison; the gate counts distinct approach labels |

## Implementation references

| Need | File |
|---|---|
| Machine gate | [`tools/creative_gate.py`](../../tools/creative_gate.py) |
| Copy rule | [`tools/thumbnail_copy.py`](../../tools/thumbnail_copy.py) |
| Palette match | [`tools/thumbnail_style.py`](../../tools/thumbnail_style.py) |
| Phone-size rendering | [`tools/thumbnail_legibility.py`](../../tools/thumbnail_legibility.py) |
| Post-render review | [`tools/creative_review.py`](../../tools/creative_review.py) |
| Typesetting | [`tools/compose_thumbnail.py`](../../tools/compose_thumbnail.py) |
| SEO scoring | [`tools/seo_audit.py`](../../tools/seo_audit.py) |
| Package completeness | [`tools/validate_publishing.py`](../../tools/validate_publishing.py) |
| Verified numbers | [`docs/production/YOUTUBE_PUBLISHING.md`](../../docs/production/YOUTUBE_PUBLISHING.md) |
| Evidence write-up | [`docs/production/CREATIVE_PACKAGING.md`](../../docs/production/CREATIVE_PACKAGING.md) |
| Record schema | [`docs/production/CREATIVE_PACKAGING.md`](../../docs/production/CREATIVE_PACKAGING.md) §3 |

## Examples

### A cover that repeats the title

The cover says 'FIVE HOURS DIFFERENCE' and the title contains the same phrase. Give the cover the consequence and the title the question.

