# CHARACTERS.md — video-001

**Character consistency management.** One definition per character, pinned here and mirrored
byte-for-byte into the `cast` block of [`episode.json`](episode.json). Because the engine builds
every character from that single parameterised profile, consistency across all ten scenes is
guaranteed *by construction* rather than by redrawing — this is the repository's substitute for the
frame-sampled reference sheets the supplied references could not provide (see
[`REFERENCE_ANALYSIS.md`](REFERENCE_ANALYSIS.md), craft table, rows tagged **[A]**).

---

## KAI — `kai`

*The protagonist. About twenty-six. Works at a desk. Not lazy, not broken — just interrupted.*

| Field | Value | Why |
|---|---|---|
| `name` | `KAI` | Short, legible as a name tag, no pronunciation risk |
| `style` | `cel` | Atmospheric Cinema Cel — the crisp vector look, zero grain |
| `build` | `lean` | Young, unremarkable; reads as "ordinary person" not "athlete" |
| `hair` | `textured_messy` | Slightly unkempt — visual shorthand for a fragmented mind |
| `hair_color` | `#2f1f18` | Warm near-black, does not compete with accent colours |
| `color` | `#f8fafc` | Near-white body: maximum contrast on dark backgrounds |
| `shoe_color` | `#1e293b` | Grounds him against the floor line |
| `posture` | `-0.10` | **Slightly** rounded at the start — the engine's 3-joint spine. Not slumped (that is S06's job), just not proud |
| `scale` | `1.56` | Standard hero scale for 1920-stage geometry |
| `eyes` | `true` | Required for the expression vocabulary to read |
| `accessories` | `["watch"]` | The watch is thematic: a man who owns a timepiece but cannot find his time |
| `expression` (default) | `focused` | Neutral-positive baseline |

**Expression arc** (engine supports 15; six are used):

```
focused  →  curious  →  shocked  →  tired  →  exhausted  →  determined
 S01-S03      S01        S05-S06     S06        S06          S08-S10
```

The arc is the story: competence, curiosity, disbelief, erosion, collapse, resolve. Every
expression above is in the engine's supported set, so no beat falls back to a default.

**Action vocabulary used** (all from the engine's 60 supported actions):
`stretch_wake` · `idle_stand` · `pace_think` · `sit_desk_type` · `phone_scroll` · `check_watch` ·
`point_board` · `sit_desk_slump` · `head_in_hands` · `kneel_lookup` · `stand_up_resolve` ·
`pick_up_floor` · `stand_from_desk` · `look_horizon`

---

## SAM — `sam`

*The colleague. Appears in exactly two scenes (S09, S10-adjacent). She is the A/B control: the
same room, the same work, a full counter.*

| Field | Value | Why |
|---|---|---|
| `name` | `SAM` | |
| `style` | `cel` | Must match Kai's style or the two look like different films |
| `build` | `standard` | Deliberately not `lean` — silhouette differs from Kai at a glance |
| `hair` | `bun` | Strong, distinct silhouette; unmistakable at small portrait scale |
| `hair_color` | `#1f2937` | |
| `color` | `#f472b6` | Pink — separates her from Kai's white in a single frame |
| `shoe_color` | `#0f172a` | |
| `posture` | `0.28` | **Upright.** The engine's positive posture lifts the sternum into a tall stance. Her body language *is* the argument |
| `scale` | `1.54` | Marginally shorter than Kai so the pair never reads as twins |
| `eyes` | `true` | |
| `accessories` | `["headphones"]` | Headphones on at a desk = deliberate focus. One accessory, one idea |
| `expression` (default) | `focused` | |

**Voice:** `af_bella` (repository preferred secondary).

**Hard constraint honoured:** never more than two characters in any scene. Sam shares the frame
with Kai only in S09.

---

## Consistency controls

1. **Single source of truth.** The `cast` block is written once and never re-declared per scene.
   Scenes reference characters by `id` only.
2. **No per-scene appearance overrides** except `expression`, which is authored per beat on
   purpose (that is the performance, not an inconsistency).
3. **Name tags:** `show_name: true` on first appearance only (S01 for Kai, S09 for Sam), so the
   frame does not accumulate labels. The engine defaults to first-appearance tagging; it is set
   explicitly here so the behaviour is deliberate and testable.
4. **Colour separation test:** Kai `#f8fafc` (white) vs Sam `#f472b6` (pink) vs scene accents
   (teal / amber / rose) — verified distinguishable in the extracted QA frames, including
   desaturated, for the mute-legibility test.
5. **Prop consistency:** Kai's `watch` appears in every scene he is in, because it is part of the
   cast profile rather than a per-scene addition.

## Voice casting

| Character | Engine | Voice | Speed | Rationale |
|---|---|---|---|---|
| NARRATOR | Kokoro | `am_michael` | 1.00 | Repository PRIMARY default. Warm, authoritative, even pace — carries factual claims credibly |
| KAI | Kokoro | `am_liam` | 1.03 | Warm, friendly, natural; reads younger than Michael so the two never confuse |
| SAM | Kokoro | `af_bella` | 1.02 | Repository preferred secondary. Warm, professional, clear |

Full voice notes: [`VOICEOVER.md`](VOICEOVER.md).
