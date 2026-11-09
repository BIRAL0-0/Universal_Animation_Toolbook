# VIRAL-POTENTIAL EVALUATION — Stage 2

**Status: PROCESS-STANDARD.** This is the scoring system the pipeline applies to every
researched idea before the user sees it. It is a *ranking aid for this channel and this
engine* — it deliberately does not pretend to predict YouTube's algorithm, and no output of
this stage may be phrased as a virality guarantee.

Input: idea briefs from [`IDEA_RESEARCH.md`](IDEA_RESEARCH.md) (`work/ideas/<slug>.md`).
Output: a score table appended to each brief, plus a shortlist order.

---

## The ten criteria

Score each **1–5** using the anchors below (2 and 4 are the in-between values). Score the
criteria **one at a time, before computing any total**, and write one justification sentence
per criterion in the brief. A criterion with no sentence did not get scored — redo it.

| # | Criterion | Weight | 1 (fails) | 3 (viable) | 5 (excellent) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Hook strength** | 15 | Opening could start anywhere; no reason to stay past 3 s | A clear question/tension in the first line | The first 3–8 seconds pose a problem the viewer cannot un-see; stopping early costs them something specific |
| 2 | **Curiosity & emotional appeal** | 10 | No emotion, no gap to close | One genuine "what happens next?" beat | Multiple stacked gaps plus an emotion (wonder, unease, recognition) the audience feels for themselves |
| 3 | **Audience relevance** | 10 | No clear audience would care | A defined audience with a plausible reason | The audience's recurring frustration/desire, articulated better than they can |
| 4 | **Shareability** | 8 | Nothing quotable, nothing to tag | One line or moment a fan might forward | A "this is so true" moment, or an ending people retell; a natural @-tag or discussion it provokes |
| 5 | **Storytelling potential** | 12 | A list of facts, no arc | A beginning/middle/end with one decision | A character makes a choice under a limit; the ending re-frames the opening (the engine's fable/essay patterns in `examples/` exist for a reason) |
| 6 | **Visual entertainment value** | 10 | Could be a podcast | Some moments benefit from motion | The *idea itself* is visual — objects, weather, blocking, a board that proves the point; at least 2 scenes with a "proof" object |
| 7 | **Retention potential** | 12 | One flat tone to the end | One mid-point shift | At least one tonal shift per ~30 s, an open loop re-staked mid-film, and a final beat that rewards watching to the last second |
| 8 | **Originality** | 5 | Near-identical to obvious existing content | Familiar format, fresh specific | A combination no obvious incumbent has made; the twist is in the pairing, not the premise |
| 9 | **Trend relevance** | 5 | No connection to anything current | A stable evergreen format | Rides a current format/topic wave **with dated evidence in the brief** |
| 10 | **Production feasibility** | 13 | Needs capabilities the engine lacks (crowds, 3D, real likenesses, other aspects) | Doable but with tight spots (3rd minor character, unusual prop) | Fits the engine cleanly: ≤ 2 principal characters, known actions, existing environments/props, target aspect & duration in the proven range |

Weights sum to 100. They are the **default** for this channel; a channel can retune them —
record the retuning in the brief. When a weight changes, scores become incomparable across
briefs that used different weights; say which weights a score used.

## Computing the score

```
score = (Σ criterion_score × weight) / 100      → range 1.0 – 5.0
```

**Bands** (ranking guidance, not predictions):

| Score | Reading | Action |
| --- | --- | --- |
| ≥ 4.0 | Strong candidate | Shortlist; present with full brief |
| 3.2 – 3.9 | Promising | Shortlist if the set is thin; name its two weakest criteria |
| 2.5 – 3.1 | Weak | Do not present unless the user explicitly asked for more; name what would move it |
| < 2.5 | Drop | One line in the brief explaining why |

**Feasibility is a veto, not a weight.** If criterion 10 scores 1–2, the brief must name the
*change* that would make the idea producible (e.g., "cut the third character", "replace the
crowd with a passing_bus + two bystanders implied off-screen") — or it is marked
**out of scope for this engine** and left off the shortlist. The engine's boundary is
[`universal_toolbook/process/08_LIMITS.md`](../../universal_toolbook/process/08_LIMITS.md);
feasibility scores are read against it, not against "what animation is possible in general".

## Worked example (illustrative numbers, not real data)

Idea: "The Rule You Never Questioned" — a 46 s parchment Short about a limit a character
turns out to have agreed to.

| Criterion | Score | Justification (abridged) |
| --- | --- | --- |
| 1 Hook | 5 | Opens mid-climb on a wall that "isn't there yet" — stopping early loses the reveal |
| 2 Curiosity | 4 | One main gap (whose rule?) plus unease |
| 3 Relevance | 4 | Speaks the audience's "why did I accept this?" pattern |
| 4 Shareability | 4 | The ending line retells itself |
| 5 Storytelling | 4 | One decision under a limit; ending re-frames opening |
| 6 Visual | 5 | The wall, the climb, a rule card as proof object — idea is intrinsically visual |
| 7 Retention | 3 | One tonal shift (calm → confrontation); short enough to hold anyway |
| 8 Originality | 4 | Common premise, unusual object (a wall as agreement) |
| 9 Trend | 2 | Evergreen; no dated trend evidence available |
| 10 Feasibility | 4 | 1 narrator + 1 actor, `climb_stairs`, 9:16 ≤ 180 s; the ghost wall itself needs a bespoke set extension (as `universal_toolbook/engine/impossible_wall.js` was for the reference film) — doable, but engine work, not just JSON |

`score = (5·15 + 4·10 + 4·10 + 4·8 + 4·12 + 5·10 + 3·12 + 4·5 + 2·5 + 4·13) / 100
= (75+40+40+32+48+50+36+20+10+52)/100 = 4.03` → **strong candidate**, shortlist.

## Presentation rules

- Scores are always shown **with** the per-criterion table — a bare number is a guess.
- Never write "will go viral", "guaranteed", or "the algorithm will reward". Write "strong
  candidate for this channel because…".
- Never pad a shortlist with sub-3.2 ideas to reach a count. Three honest candidates beat
  five filler ones.
- Prioritize the intersection of **audience appeal** (criteria 2, 3, 4, 7) and **achievable
  production quality** (criterion 10 against the real engine): an idea the engine cannot
  execute well is not a candidate for this pipeline, however good the premise.
