# SCRIPT WORKFLOW — Stages 4, 5, 6

**Status: PROCESS-STANDARD** (the writing is done by the agent; two implemented tools assist —
`universal_toolbook/tools/script_helper.py` and `validate --script`).

Input: the selected idea brief `runtime/work/<slug>/idea.md` (Stage 3).
Output: an approved, TTS-ready narration `runtime/work/<slug>/script_polished.md` plus the decision
log `runtime/work/<slug>/decisions.md`.

Everything after this stage is expensive (voice synthesis, rendering) — which is exactly why
the final narration has a **hard approval gate** before it.

---

## Stage 4 — Short sample scripts

Purpose: let the user compare *directions* cheaply, before any full script exists.

**Rules.**

- 2–3 samples, each ≤ ~15 sentences (roughly 60–90 s of speech at the engine's ≈2.5 w/s if
  ever rendered — samples are previews, not timed).
- Each sample explores a **different storytelling approach** where the concept allows it:
  fast-paced/entertaining, curiosity-driven, humorous, dramatic/suspenseful, educational.
  Do **not** force a style that does not fit the concept — one strong approach beats three
  diluted ones; say when a second approach does not fit and why.
- Each sample must show: the opening hook, the story direction, the narration style, the
  main concept, and a potential ending.
- Samples live in `runtime/work/<slug>/samples/sample_<n>_<approach>.md`.

**Gate.** The user picks a direction, requests a revision (loop back), or mixes elements
(record the mix in `runtime/work/<slug>/decisions.md`).

## Stage 5 — The complete script

Purpose: the full narration sized for the delivery target.

### 5.1 Fix the delivery target before writing a word

| Decision | Rule source |
| --- | --- |
| Duration class | 40–90 s generic short-form (`--short-form`), vertical Shorts >0–180 s (`--shorts`), or long-form — [`universal_toolbook/process/08_LIMITS.md`](../../universal_toolbook/process/08_LIMITS.md) |
| Aspect | 16:9 landscape or 9:16 portrait, from delivery requirement, not from duration — [`universal_toolbook/process/01_INTAKE.md`](../../universal_toolbook/process/01_INTAKE.md) |
| Style | `cel` vs `parchment` per the intake rule of thumb; recorded in the idea brief |

### 5.2 Budget duration from words

The engine **retimes scenes to the generated speech**, so the script must be written to the
budget, not padded to it:

- narration ≈ **2.6 words/second**, dialogue ≈ 2.4 w/s;
- inter-line pauses 0.22–0.32 s (0.35–0.45 s at scene turns);
- each scene adds ≈ 1.3 s of lead-in + tail-out.

Rule of thumb: **`words ÷ 2.5 ≈ seconds`**, plus 1.3 s per scene. A 46-second Short is
≈ 100–110 words of narration. If a draft runs long, cut words — do not speed up the voice
beyond the documented rate range.

### 5.3 Structure

- One scene = one location + one continuous stretch of time + **one meaningful change**
  (a fact revealed / a decision made / a thing breaks). A scene where nothing changes is a
  candidate for deletion — the same rule that defeats "talking heads".
- Strong opening hook in the first 3–8 seconds of *audio*.
- Natural progression with at least one tonal shift per ~30 s for retention.
- An ending that re-frames or pays off the opening (loop potential: a coda that connects
  back to the cold open is a known pattern in this repo's films — see
  `examples/the_staircase_episode.json`).
- Enough detail per scene to animate it: who is on screen, what changes, what object proves
  the point, what the camera does. (This is the intake stage's per-scene table —
  [`universal_toolbook/process/01_INTAKE.md`](../../universal_toolbook/process/01_INTAKE.md) §1.6.)
- No narration added merely to increase duration.

Save to `runtime/work/<slug>/script_v1.md`.

### 5.4 Verbatim scripts

If the user supplied the script and it must be preserved 100 %:

- `script_v1.md` **is** the user's text, unmodified.
- The engine enforces this mechanically: `python3 universal_toolbook/run_studio.py validate
  runtime/work/<slug>/episode.json --script runtime/work/<slug>/script_v1.md` compares **word tokens**
  (lowercase alphanumeric, punctuation-insensitive, order-sensitive) between the source
  script and the episode's narration. `exact_word_match: true` is the bar; a paraphrase
  fails it.
- Consequence for Stage 6: polish may shape punctuation and pauses but not words (see below).

### 5.5 Optional mechanical skeleton (IMPLEMENTED)

```bash
python3 universal_toolbook/tools/script_helper.py parse runtime/work/<slug>/script_v1.md \
  --out runtime/work/<slug>/skeleton.json
```

Segments the script into beat-aligned scenes (~34 words each), estimates duration
(`_script_stats.estimated_duration_sec`), and recommends a BGM track. The skeleton uses
placeholder cast and a generic setting — it is a *starting point* for Stage 9 authoring,
never a finished episode. Fidelity check:

```bash
python3 universal_toolbook/tools/script_helper.py verify runtime/work/<slug>/script_v1.md runtime/work/<slug>/episode.json
```

## Stage 6 — Polish for AI voiceover

**Status: PROCESS-STANDARD.** The authoritative standard is
[`prompts/VOICEOVER_POLISH_PROMPT.md`](prompts/VOICEOVER_POLISH_PROMPT.md) — apply it in full;
do not substitute a summary of it.

**Why this stage exists.** Neural voices read text literally. Ellipses become dead air,
fragments ("step two. Slid backward") become clipped intonations, and digits ("9 PM") depend
on the backend's spelling. The engine *compacts* long internal silences
([`universal_toolbook/process/05_AUDIO.md`](../../universal_toolbook/process/05_AUDIO.md)), but
it does not rewrite your text — the text has to be spoken-ready.

**Procedure.**

1. Apply the polish prompt to `script_v1.md` (or to the user's verbatim script, under its
   constraints).
2. Write the result to `runtime/work/<slug>/script_polished.md`. **Keep both files** — the original
   is the record of what the user approved at the content level; the polished file is what
   the engine speaks.
3. **Verbatim mode constraint.** With `validate --script` in effect, the polished file must
   keep the **same word tokens in the same order**. Punctuation/pause shaping is safe
   (`just... started` → `just started`; `step two. Slid backward` → `step two, slid
   backward` — both keep the token stream and both are real fixes applied in this repo's
   history). Any *word-level* TTS change (e.g., `9 PM` → `nine PM`) changes the token
   stream: present it to the user, get explicit approval, record it in
   `runtime/work/<slug>/decisions.md`. (An alternative is to keep the token stream and let the
   engine's spelling rules handle the rendering; the polish prompt documents which forms
   are safe under verbatim mode.)
4. **Agent-written scripts** have no token constraint — polish freely, keeping the original
   tone and meaning (the prompt's own rule).

**Gate. HARD.** Present `script_polished.md` in full. The user approves the final narration
**before** Stage 7 onward. Every later cost (TTS calls, render time, re-renders) depends on
this exact text. Record the approval — timestamp and approver — in
`runtime/work/<slug>/decisions.md`.

### What changes after approval

If the narration changes after a render exists: the voice cache entries for changed lines
miss (cache keys include the text — see [`VOICE_GENERATION.md`](VOICE_GENERATION.md)), those
lines re-synthesize, the whole timeline retimes, and **all render chunks are stale** —
delete `runtime/renders/.work_<stem>/` (keeping `vo_cache` saves the TTS cost) and re-render. This is
not a failure mode, it is the design; the gate exists so it stays rare.
