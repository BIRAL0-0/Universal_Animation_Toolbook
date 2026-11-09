# REFERENCE ANALYSIS — video-001

**Analysis date:** 2026-11-09
**References supplied by the client:**
1. `https://youtube.com/shorts/DRdfSzODnlM` — *He Started Fast… But He Didn't Finish* — Growth Protocol, 0:30
2. `https://youtu.be/F-a7-UMsmKI` — *What If You Did Nothing for 30 Days?* — Growth Protocol, 3:00

---

## Access limitation — read this first

**The videos could not be watched.** This sandbox has binary network access only to
`github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org` and
`files.pythonhosted.org`. YouTube video streams and thumbnails are not reachable.

What *was* retrieved, through the agent's page-reading tool: each video's **title, channel,
length, exact view count, exact like count, upload date, category, full description, full chapter
list, and (for reference 1) the auto-generated transcript**.

Therefore every item below is tagged:

- **[V]** *Verified* — read directly from the video's own page metadata.
- **[I]** *Inferred* — reasoned from verified chapter lists, descriptions or transcripts.
- **[A]** *Assumption* — an expectation about craft that this analysis could **not** verify.

The brief demands this distinction. It is honoured throughout, and the assumptions are the reason
`QA_REPORT.md` grades this film against its own stills rather than against a frame-by-frame
comparison with the references.

---

## Reference 1 — *He Started Fast… But He Didn't Finish* (0:30 Short)

**[V]** 12,327 views · 383 likes (3.11%) · uploaded 2026-10-28 · category *Film & Animation*.
**[V]** Transcript is `[music]` throughout with a single trailing spoken token. **This film has
essentially no dialogue.**
**[V]** Description carries the entire narrative: one runner rushed ahead, celebrated too early,
gave up when the climb got hard; the other kept taking one step at a time.
**[V]** Hashtags: `#consistency #discipline #motivation #selfimprovement #mindset #shorts`.

**[I] Structure:** a 30-second two-character race parable — fast start, premature celebration,
collapse, contrasted against steady incremental progress, closing on a moral delivered in text
rather than speech. The finish-line emoji in the title (`🏁`) implies the goal is literal and
on-screen.
**[I] Why it works:** zero language barrier, instant legibility, and the moral is stated in the
description so the video itself never has to stop moving.

**What to adopt [I]:**
- **Wordless legibility.** A viewer should understand the film on mute. This film's central image
  (a draining number) is chosen precisely because it reads without audio.
- **One idea, one image.** No subplot, no second theme.
- **The contrast pair.** Two behaviours shown side by side beat one behaviour described.

**What not to adopt:** a 30-second runtime is too short to carry a factual mechanism plus a
character arc. This film needs ~2:40.

---

## Reference 2 — *What If You Did Nothing for 30 Days?* (3:00 narrated film)

**[V]** 74 views · 5 likes · uploaded 2026-11-03 · category *Education*.
**[V]** Chapter list: `0:00 What if you did nothing? / 0:40 When rest becomes routine / 0:58 The
staircase you avoid / 1:23 The ideas that fade / 1:47 Day 30: nothing happened / 2:08 Rewind: the
same 30 days / 2:49 Your turn`.
**[V]** Description states the thesis explicitly: "Nothing bad happened. No crash. No disaster.
Just 30 quiet days of comfort, and that's exactly what makes it dangerous." And the turn: "we
rewind the same 30 days and change just one thing: one small action a day."
**[V]** Ends on a direct comment-bait question: "What's the one small thing you'll do today?"

**[I] Structure:** hook → slow decay in four labelled stages → the flat anti-climax ("nothing
happened") → **rewind and replay the same timeline with one variable changed** → call to action.
The rewind is the strongest structural idea in either reference: it makes the argument by
*showing the same footage twice with a different outcome*, which is a visual proof, not a claim.

**[I] Pacing:** seven chapters in 180 s ≈ 26 s per beat, with the first 40 s given to the hook
alone. That is a slow, deliberate opening by Shorts standards.

**What to adopt [I]:**
- **The A/B timeline.** Prove the argument by replaying the same conditions with one change.
  This film's last act does exactly that: the same desk, the same work, the phone face-down.
- **A named anti-climax.** "Day 30: nothing happened" is a strong beat because it refuses the
  expected disaster. This film's equivalent is *"He does not feel a thing."*
- **Direct-address closing question.** Adopted verbatim in spirit, not in wording.
- **Explicit chapter labels**, which double as on-screen cards and as YouTube chapters.

**What not to adopt [I]:** the 40-second hook. Measured evidence in `RESEARCH.md` §1 shows this
channel's 30 s Short out-distributed this 3 min film by ~166×, and the general stickman retention
guidance found in research says to start "in the middle of something". This film's hook lands
inside the first 10 seconds.

---

## The breakout comparable — what actually scales

*Reference analysis would be incomplete without the one video in this niche that measurably broke
out.* **[V]** *DOPAMINE | An Animated Short Film*, Day One Films, **584,787 views / 13,905 likes
on a 21.6K-subscriber channel**, 2:40, uploaded 2026-09-30.

**[V]** Its transcript is mostly `[music]` with three short taunting speeches from the addiction
voice. **[V]** Its description says: "Every frame, sound and note of music in this film was made
from scratch." **[V]** Twelve chapters, each 10–20 s.

**[I] The transferable qualities:**
1. **One metaphor, carried to exhaustion.** Colour = capacity for joy. It never explains itself.
2. **Seductive antagonist voice, not a lecturing narrator.** The addiction *talks to* the hero.
3. **Ten-to-twenty-second chapters** — fast enough for a Short, long enough for a film.
4. **A physical recovery act** ("Earning it back") rather than a spoken moral.

---

## Craft areas the brief asks about — honest status

| Area the brief asks me to study | Status | What I actually know |
|---|---|---|
| Stickman character design & consistency | **[A]** | Could not sample frames. Mitigated by using the repository's own parameterised `cast` block, which guarantees consistency by construction — one definition, reused in every scene. |
| Character proportions & expressions | **[A]** | Same. The engine exposes 15 expressions and 7 builds; `CHARACTERS.md` pins them once. |
| Animation technique & movement | **[A]** | Same. The engine's 58 named actions are the movement vocabulary. |
| Scene composition & backgrounds | **[I]** | Chapter titles imply domestic/interior settings for ref 2 ("the staircase you avoid", "the ideas that fade"). |
| Camera movement & framing | **[A]** | Unverifiable without frames. |
| Storytelling & visual explanation | **[V]/[I]** | Fully recoverable from chapter lists and descriptions — the strongest verified signal in this analysis. |
| Narration & dialogue | **[V]** | Ref 1: none. Ref 2: narrated. DOPAMINE: sparse antagonist voice over music. |
| Sound effects & music | **[V]/[I]** | Ref 1's transcript is wall-to-wall `[music]`; DOPAMINE states its score was made from scratch. Music is load-bearing in all three. |
| Transitions & pacing | **[I]** | Chapter timestamps give exact beat lengths — ref 2 ≈26 s/beat, DOPAMINE ≈13 s/beat. |
| Visual hooks & retention | **[I]** | All three open on the premise itself, not on a logo or a cold scene. |

**[A] Assumptions are not evidence.** Where the brief's checklist could not be answered from
metadata, this project compensates with *verifiable* substitutes: the engine's parameterised cast
guarantees character consistency, and `QA_REPORT.md` grades the rendered film against its own
extracted frames and measured audio.

---

## Creative direction adopted for video-001

1. **Runtime 2:40, twelve-ish beats at 10–20 s** — DOPAMINE's measured pacing, not ref 2's.
2. **Hook inside 10 s** — start in the middle of the premise.
3. **One metaphor, never explained:** a draining focus counter. Colour is not used as the
   metaphor (that is DOPAMINE's); *number* is.
4. **A documentary narrator plus three short character lines** — between ref 1 (silent) and
   ref 2 (fully narrated). The narrator states facts; the characters say only what a person would
   really say.
5. **Adopt ref 2's A/B replay** as the closing act: same desk, same work, phone face-down.
6. **Adopt ref 1's mute-legibility test:** the film must make sense with the audio off.
7. **Close on a direct-address question** (ref 2's pattern), rewritten originally.
8. **Music is load-bearing** — a dynamic BGM bed that shifts mood per act, ducked under narration.
9. **Chapter labels double as on-screen cards** and as YouTube chapters in the delivery notes.
