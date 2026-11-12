# Creative packaging — hook, title, thumbnail as one promise

**Status:** IMPLEMENTED (gate) + BACKFILLED (existing videos). **Owner:** this document owns the
`creative` block schema and the evidence standard. The *procedure* is
[`skills/youtube-packaging/SKILL.md`](../../skills/youtube-packaging/SKILL.md); the verified
numbers are in [`YOUTUBE_PUBLISHING.md`](YOUTUBE_PUBLISHING.md) §13.0.1 and are not repeated here.

---

## 1. The gap this closes

Before this document, the repository could prove a film had rendered and that its packaging was
*complete*. It could not show that anyone had **decided** anything about the packaging:

| Question | Before | After |
|---|---|---|
| Was more than one hook considered? | nothing recorded | `creative.hook_candidates` with rejected options |
| Was the title chosen over alternatives? | nothing recorded | `creative.title_candidates` |
| Was the thumbnail designed or defaulted? | only the final image | `creative.thumbnail_concepts`, ≥3 distinct focal subjects |
| Does the hook match the film? | not checked | gate compares hook text to spoken dialogue |
| Do title, thumbnail and hook agree? | not checked | `creative.alignment` + gate |
| Is the script actually good? | SEO word-count only | ten-criterion critique with a named weakest point |
| Is every claim sourced or a guess? | `[M]/[O]/[P]` in prose only | `creative.claims[]`, machine-checked |

The audit that motivated this found **zero** repo-wide occurrences of hook candidates, retention
maps, title candidates, thumbnail concepts or an alignment check. This document and the gate
create them.

## 2. What is automated and what is not — stated plainly

| Capability | Automated? | Notes |
|---|---|---|
| Candidates exist, are distinct, one is selected | **Yes** — `tools/creative_gate.py` | exact text comparison |
| Selected title equals `record.json.title` | **Yes** | string equality |
| Hook lands within 8 s | **Yes** | `seconds_into_video` |
| Hook wording appears in the film | **Yes** | token overlap ≥ 60% against dialogue |
| Generic openers rejected | **Yes** | banned-phrase list |
| Thumbnail concepts differ by focal subject | **Yes** | normalised string comparison |
| Cover text does not restate the title | **Yes** — `tools/thumbnail_copy.py` | pre-existing gate |
| Cover palette belongs to the film | **Yes** — `tools/thumbnail_style.py` | pre-existing gate |
| Cover was rendered at real phone sizes (168 / 216 px) | **Yes** — `tools/thumbnail_legibility.py` | writes the contact sheet CI keeps |
| No two covers are the same picture at phone size | **Yes** | calibrated: identical ≈ 0.00, unrelated ≈ 1.0 |
| Title drafted from ≥ 4 distinct strategies | **Yes** — `creative_gate.py` | `approach` labels, 7 accepted |
| SEO package complete (primary/secondary phrases, alternates, hashtags, category) | **Yes** | `REQUIRED_SEO_FIELDS` |
| The rendered film delivers the recorded hook and beats | **Yes** — `tools/creative_review.py` | measures the MP4, not the plan |
| **Whether the cover reads at 168 px** | **No — and this was tested, not assumed** | three candidate scalars each failed covers that read fine; see §2.1 |
| Claims are labelled and predictions stay predictions | **Yes** | label + `used_as` |
| Retention map covers hook/escalation/payoff | **Yes** | kind + purpose required |
| **Whether a hook is actually good** | **No** | editorial judgement; the gate says so in its output |
| **Whether a thumbnail will earn a click** | **No** | no analytics access exists |
| **Whether the script will retain viewers** | **No** | requires real audience data |

The last three rows are the honest boundary. The gate proves the *process* happened and the
*claims* are honest. It cannot prove the result works. Never present a passing gate as evidence
that a video will perform.

### 2.1 Why legibility is measured but not judged

`thumbnail_legibility.py` was built to fail covers that are unreadable at phone size. It does not,
because every automated measure tried disagreed with the eye:

| Candidate measure | Failure |
|---|---|
| Centre-weighted saliency "subject share" | scored `the-first-plank` at 7% and `the-wall-you-agreed-with` at 6% — both read perfectly at 168 px, because their subject is bright-on-black |
| Edge-energy text-band contrast | locked onto art texture on the illustrated covers; `the-bamboo-seed` measured 2.4:1 despite clear white type |
| Connected-component cap height | merged limbs and props with type; no threshold separated them |

So the tool gates on the one thing that *is* reliable — two covers being the same picture — and
otherwise renders the real mobile sizes for a human to look at. **Reported numbers are advisory.**
A number that confidently fails a good cover trains everyone to ignore the tool.

## 3. The `creative` block (schema)

Every `videos/<slug>/record.json` must contain this object. It is validated by
`tools/creative_gate.py`, which fails the package if any required field is missing or dishonest.

```jsonc
{
  "creative": {
    "backfilled": false,              // true only for the 8 videos documented before this rule
    "hook_candidates": [              // >= 3, distinct text
      { "text": "...", "selected": true, "why": "why this one, and what it cost",
        "seconds_into_video": 0.0 }
    ],
    "retention_map": [                // >= 3, must include hook and payoff
      { "at_sec": 0,   "kind": "hook",       "purpose": "..." },
      { "at_sec": 21,  "kind": "escalation", "purpose": "..." },
      { "at_sec": 43,  "kind": "reveal",     "purpose": "..." },
      { "at_sec": 60,  "kind": "payoff",     "purpose": "..." }
    ],
    "title_candidates": [             // >= 3, and >= 4 distinct approach labels
      { "text": "...", "approach": "curiosity_gap", "selected": true },
      { "text": "...", "approach": "question" },
      { "text": "...", "approach": "outcome_number" },
      { "text": "...", "approach": "contradiction" }
      // accepted: curiosity_gap | question | outcome_number | contradiction
      //           stakes_loss | identity | reversal
    ],
    "thumbnail_concepts": [           // >= 3, different focal_subject
      { "focal_subject": "...", "emotion": "...", "text": "OPTIONAL COPY", "selected": true }
    ],
    "alignment": {
      "title_promise":     "...",     // what the title makes the viewer want
      "thumbnail_promise": "...",     // how the cover makes that visible
      "hook_promise":      "...",     // how the first seconds start answering
      "verdict":           "aligned"  // anything else fails the gate
    },
    "claims": [                       // every stated fact or prediction
      { "text": "...", "label": "M",  // M measured | O observed | P predicted
        "used_as": "fact" }           // a "P" may never be "fact"
    ],
    "script_critique": {
      "scores": {                     // all ten required, each 1-5
        "opening_hook": 4, "clarity": 5, "originality": 4, "story_progression": 4,
        "retention_potential": 4, "emotional_impact": 4, "visual_potential": 5,
        "payoff": 5, "accuracy": 4, "pacing": 4
      },
      "weakest": "originality",       // required; a flat 5/5 sheet was not a critique
      "revision": "what the critique actually changed"
    }
  },

  // Top-level, not nested — the SEO package a viewer never sees and a search
  // engine always reads. Required by creative_gate.py.
  "primary_keyword": "bamboo seed",
  "secondary_keywords": ["bamboo parable", "slow progress"],   // 1-3
  "title_alternates": ["...", "..."] ,                          // >= 2, never the title in use
  "hashtags": ["#perseverance", "#patience", "#motivation"],    // 3-5, with the '#'
  "category": "Education"
}
```

## 4. Backfill result — and the two films it indicted

All eight shipped videos were given a `creative` block on 2026-11-11, written **from their actual
`script.md` and their shipped thumbnail**, not invented. Two of them scored badly on their own
opening and are recorded that way rather than quietly marked fine:

| Video | `opening_hook` | Why |
|---|---|---|
| `the-first-plank` | **2 / 5** | Opens on *"Behind her, a clean desk held an untouched page."* A desk, not a problem. The real hook — the blank plank — arrives third. |
| `the-two-inch-bridge` | **2 / 5** | Opens on *"The chasm at Kessa was eight hundred metres of nothing."* Scale, with nothing at stake for a person yet. The real hook is *"Two inches. Nobody measured it."* |

Both were originally flagged for a future re-edit rather than fixed. **`the-two-inch-bridge` has
now been re-cut (3.1.0)** — see §4.1. `the-first-plank` remains flagged, and the reason is
technical rather than editorial: its episode spec was never committed to `examples/`, so the only
surviving record of its visuals is the rendered master. Re-cutting it means re-authoring eight
scenes of choreography, not re-ordering two.

### 4.1 The two re-cuts

Both flagged films have now been fixed.

| Film | 3.0.0 opening | 3.1.0 opening | hook |
|---|---|---|---|
| `the-two-inch-bridge` | the chasm (scale, no stakes) | "Two inches off every joint." | 2 → 4 |
| `the-first-plank` | a clean desk with an untouched page | "a bridge with only the first plank missing" | 2 → 4 |

`the-first-plank` had to be **re-authored, not re-ordered**: its episode spec was never
committed, so the only record of its visuals was the published master. The spec now exists
(`examples/the_first_plank_episode.json`), and re-authoring surfaced three things worth
keeping:

- **Preset environments draw geometry; `canyon_bridge` does not.** It is a colour theme, so an
  outdoor scene using it renders as a bare room. The four outdoor acts use explicit `setting`
  blocks instead (`backdrop: mountains | horizon | hills`, `sky` gradients, `rain`, `stars`).
- **`setting` overrides are gated by `DEFAULT_VISUAL_IDENTITY.lock_identity`.** A custom
  setting collapses to the near-black default unless the scene sets
  `override_visual_identity: true`. That is the documented default background working as
  intended, with a sanctioned escape hatch — not a bug.
- **Character scale and board geometry interact.** Mira at `1.30` put her head inside the
  board band; `1.12` with a 440×`84+42n` board clears it. Board `y` ≤ 1.5 is a fraction of
  frame height, above that it is pixels.

### 4.1a The cover must be the film's character

`the-first-plank`'s cover was AI-generated art and had invented a different Mira: red shoes,
a ponytail, skin tone. The film's Mira has blue shoes, long hair and a white body. That is
exactly the "the character doesn't look like the video" complaint, and no colour-histogram
gate could see it.

The replacement is **rendered from the film's own rig** — S06's sunrise setting at 1.45×
camera zoom with the chapter label and name tag suppressed — so character identity is
guaranteed by construction rather than by a prompt. Typography is set by
`tools/compose_thumbnail.py` in a dedicated band under the art (`NEAR` / `EDGE`), which is
why the score rose from 0.615 to 0.735.

**Rule:** when a cover shows the protagonist, render it from the episode spec. Generative
art may supply backgrounds, objects or texture, but not the character the film already owns.

The record now declares this in `thumbnail_spec.art_source` (`rendered_from_spec` or
`generated_art`), and a cover claiming `rendered_from_spec` must name an `art_spec` that
exists. `tests/unit/test_seo_and_style.py::test_cover_art_declares_its_source` enforces it.
The rule is deliberately narrow: it does not attempt to judge whether the art is good, only
that the claim made about it is true.

### 4.1c Reproducibility is now checked

`tools/validate_publishing.py` traces each master to a committed episode spec by its **first
spoken line** — not its title, because three examples share the title "The Two-Inch Bridge"
while their openings differ. A film with no traceable spec gets a note:

> no committed episode spec reproduces this master — a re-cut or re-render would require
> re-authoring from script.md

That note currently fires for exactly one package, `what-if-every-notification-cost-you-23-minutes`.
It is the same gap that forced `the-first-plank` to be re-authored from scratch, and it is
recorded rather than hidden: a gate cannot retroactively create a spec for a published master,
but it can stop the next production shipping without one.

### 4.1b The first re-cut: `the-two-inch-bridge` 3.0.0 → 3.1.0

The judged weakness was that S01 established *scale* — "eight hundred metres of nothing" — with
nothing at stake for a person. The fix swaps S01 and S02 so the film opens on the shortcut being
taken and lets the chasm supply the scale that decision is measured against.

**No word of the narration changed.** Every line is the line it always was; only the order of the
two scenes changed. Each scene's environment, props, character beats, camera cues, board content
and `accent_words` moved with the lines they belong to — swapping only the `dialogue` arrays and
leaving the choreography behind was the first attempt, and it produced a lab scene with office
blocking.

| | 3.0.0 | 3.1.0 |
|---|---|---|
| Opens on | the chasm (scale, no stakes) | "Two inches off every joint." |
| `opening_hook` | 2 / 5 | 4 / 5 |
| Weakest criterion | `opening_hook` | `retention_potential` (3) — act two holds one beat for four scenes |
| Runtime | 102.91 s | 101.60 s |
| Master | preserved at `deliverables/superseded/` | `videos/the-two-inch-bridge/the-two-inch-bridge.mp4` |

The re-cut scored 4/5, not 5/5, and `retention_potential` is now honestly the weakest: the film
still runs four scenes on the same rising-water beat. **A good re-cut does not make a film perfect;
it moves the weakness somewhere more specific.**

Retention-map timings were re-derived from the rendered master's own chapter file rather than
estimated, because the shorter runtime put the recorded payoff beat 1.4 s past the end of the film
— which the post-render review caught by refusing to pass it.

The same exercise found a **factual conflict** in `discipline-vs-obsession`: the title promises
"9 PM vs 2 AM" while the rendered film's clock reads **9 PM and 1 AM**. The title is wrong; the
film is right. Fixing it means re-cutting the title and possibly the cover, so it is recorded here
as a known defect rather than silently patched.

## 5. Feedback loop — and why there is no CTR table

There is **no YouTube Analytics access** in this repository. Therefore:

- no click-through rate, retention curve or drop-off point in this document is measured;
- no such number may be added to a skill or a record as if it were;
- the only performance statements permitted are labelled `[P]` (predicted).

If analytics access is ever granted, the loop is:

1. Export per-video: impressions, CTR, average view duration, 30-second retention, traffic source.
2. Compare **pairs** of videos that share a topic family, so traffic mix is roughly constant.
3. Treat every difference as correlation until a second pair agrees.
4. Update this document's table and the skill's angle families — not the gate's thresholds, which
   encode process, not performance.

Until then the honest statement is: **packaging quality is judged, not measured.**

## 5b. The post-render review — the artifact, not the plan

`creative_gate.py` checks decisions. `tools/creative_review.py` checks the **film that shipped**:

| Question | How it is answered |
|---|---|
| Does the opening move, or is the hook narration over a still? | frame delta across the first 8 s |
| Where does the film go visually static? | still runs over 4 s, reported as time ranges |
| Is the promised reveal/payoff actually there, when the record says? | beat times checked against the real duration |
| Does the record describe the file? | resolution and duration against the MP4's own metadata |
| Does the cover's light belong to the film? | **reported, not failed** — a cover carries its own key light; `thumbnail_style.py` is authoritative |

It saves frames at five points for a human to look at, because the questions it cannot answer —
is this still beat deliberate, is this hook interesting — are the ones that matter most.

## 6. Commands

```bash
python3 tools/creative_gate.py                 # every package
python3 tools/thumbnail_legibility.py --all --sheet runtime/work/covers.png
python3 tools/creative_review.py --all --frames runtime/work/review
python3 tools/creative_gate.py --verbose
python3 tools/creative_gate.py --check the-bamboo-seed
python3 tools/thumbnail_copy.py                # cover copy does not restate the title
python3 tools/thumbnail_style.py check videos/<slug>/<slug>.mp4 videos/<slug>/thumbnail.jpg --package videos/<slug>
python3 tools/seo_audit.py --min 85
python3 tools/validate_publishing.py
```

CI runs `creative_gate.py` alongside the other publishing gates in
[`.github/workflows/verify.yml`](../../.github/workflows/verify.yml).
