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
| Claims are labelled and predictions stay predictions | **Yes** | label + `used_as` |
| Retention map covers hook/escalation/payoff | **Yes** | kind + purpose required |
| **Whether a hook is actually good** | **No** | editorial judgement; the gate says so in its output |
| **Whether a thumbnail will earn a click** | **No** | no analytics access exists |
| **Whether the script will retain viewers** | **No** | requires real audience data |

The last three rows are the honest boundary. The gate proves the *process* happened and the
*claims* are honest. It cannot prove the result works. Never present a passing gate as evidence
that a video will perform.

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
    "title_candidates": [             // >= 3 approaches
      { "text": "...", "selected": true }
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
  }
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

Both are flagged `revision: "Flagged for future re-edit… not re-rendered in this pass"` because
their masters are already published and re-cutting them is a separate, deliberate decision. That
is the intended behaviour: the record tells the truth about a known weakness instead of hiding it.

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

## 6. Commands

```bash
python3 tools/creative_gate.py                 # every package
python3 tools/creative_gate.py --verbose
python3 tools/creative_gate.py --check the-bamboo-seed
python3 tools/thumbnail_copy.py                # cover copy does not restate the title
python3 tools/thumbnail_style.py check videos/<slug>/<slug>.mp4 videos/<slug>/thumbnail.jpg --package videos/<slug>
python3 tools/seo_audit.py --min 85
python3 tools/validate_publishing.py
```

CI runs `creative_gate.py` alongside the other publishing gates in
[`.github/workflows/verify.yml`](../../.github/workflows/verify.yml).
