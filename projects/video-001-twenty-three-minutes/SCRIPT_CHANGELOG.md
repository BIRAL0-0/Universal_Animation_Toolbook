# SCRIPT_CHANGELOG.md — video-001

**From:** [`SCRIPT_ORIGINAL.md`](SCRIPT_ORIGINAL.md) (v1)
**To:** [`SCRIPT_POLISHED.md`](SCRIPT_POLISHED.md) (v2, TTS-ready)
**Standard:** `docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md`,
sha256 `aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea` (unmodified).
**Mode:** standard polish (rules 1–8), not verbatim mode.

The polish prompt's OUTPUT clause requires "each change, the line it touched, and which rule above
justified it." That is this file. Rule numbers refer to the standard's HARD RULES.

---

## Change log

| # | Scene / line touched | Before | After | Rule | Reason |
|---|---|---|---|---|---|
| 1 | S01 L1 | "a number floating above his head" | "a number in the air beside him" | 1 | **Not a wording preference — an accuracy fix.** The engine has no above-the-head HUD primitive; the counter is an in-world `digital_clock` prop. The original line promised a visual the film cannot deliver. Recorded as a deviation in `PRODUCTION_LOG.md`. |
| 2 | S01 L2 | "240. That's his focus." | "Two hundred and forty. That is his focus." | 5 | Digits must be written as they will be spoken; digit-string reading varies between backends. |
| 3 | S01 L2–3 | one 14-word line | split into two lines | 3 | One sentence per `dialogue` entry keeps the subtitle to a single row. |
| 4 | S01 L4 | "He can't see it." | "He cannot see it." | 3, 6 | The contraction is followed by a fragment beat; the full form lands the pause cleanly and avoids any backend elision. |
| 5 | S02 L2 | "about 2 seconds" | "about two seconds" | 5 | Number spelled out. |
| 6 | S02 L3 | "23 minutes" | "twenty three minutes" | 5 | Number spelled out. |
| 7 | S02 L4 | single 22-word sentence: "That's not a metaphor. Researchers at UC Irvine measured it, in real offices, and the average was 23 minutes and 15 seconds." | three lines: "That is not a metaphor." / "Researchers at the University of California, Irvine measured it in real offices." / "The average was twenty three minutes and fifteen seconds." | 3, 5, 7 | Exceeded one breath. Rule 7 requires the spoken form of a proper noun, and `UC` risks reading as "uck". |
| 8 | S03 L1 | "At 9:00 AM" | "At nine in the morning" | 5 | Colon in a time token is read aloud by some backends. |
| 9 | S03 L2 | "He reads it, smiles, and goes back to work." | "He reads it, he smiles, and he goes back to work." | 3, 4 | Repetition of the subject gives each comma a real beat instead of a rushed list. |
| 10 | S03 L2–3 | one line | split: "…goes back to work." / "Or he thinks he goes back to work." | 3 | The second clause is the joke; splitting it buys the pause that sells it. |
| 11 | S03 L4 | "That's nothing." | "That is nothing." | 4 | Character line delivered slowly and flatly; the full form holds the beat. |
| 12 | S03 L5 | "240 becomes 217." | "Two hundred and forty becomes two hundred and seventeen." | 5 | Numbers spelled out. |
| 13 | S03 L5 | "He doesn't feel a thing, and that's exactly the problem." | "He does not feel a thing, and that is exactly the problem." | 4, 5 | Full forms give the two clauses equal weight at the act's pivot. |
| 14 | S04 L1 | "Then another. And another. And another." | "Then another one arrives, and another, and another." | 2 | Three bare fragments would each render as a clipped one-word subtitle. One complete sentence keeps the rhythm and the subtitle intact. |
| 15 | S04 L2 | "217. 194. 171." | "The counter drops. Two hundred and seventeen, one ninety four, one seventy one." | 2, 5 | A digit-only line is a fragment with no spoken anchor; "The counter drops" also makes the line legible on mute (rule 1's meaning preserved, visual purpose added). |
| 16 | S04 L3 | "Each one felt free. None of them were." | "Each one felt free, and none of them were." | 2, 4 | Second sentence was elliptical; joined so the pause falls mid-line rather than swallowing the verb. |
| 17 | S04 L4 | "He isn't losing seconds. He's losing the return trip, every single time." | two lines, full forms: "He is not losing seconds." / "He is losing the return trip, every single time." | 3, 4 | Split so the contrast is two separate subtitle cards, one idea each. |
| 18 | S05 L1 | "By lunch" | "By lunchtime" | 3 | "By lunch" reads as a meal, not a time of day, when spoken. |
| 19 | S05 L1–2 | "11 notifications" / "11 times 23 minutes is more than 4 hours." | "eleven notifications" / "Eleven times twenty three minutes is more than four hours." | 5 | Numbers spelled out; the multiplication is written as the word `times`. |
| 20 | S05 L3 | "He started with 8." | "He started the day with eight." | 3, 5 | A bare digit at line end is ambiguous aloud; "the day" restores the referent without adding a claim. |
| 21 | S05 L4 | "hasn't moved an inch" | "has not moved an inch" | 4 | Full form slows the line to match the collapse beat. |
| 22 | S06 L1 | "At 3:00 PM, the counter reads 9." | "At three in the afternoon, the counter reads nine." | 5 | Time and digit tokens spelled out. |
| 23 | S06 L2 | "Nothing dramatic happened. No crash. No disaster." | "Nothing dramatic happened. No crash, and no disaster." | 2 | Two bare noun fragments would clip; joined into one complete negation. |
| 24 | S07 L3 | "Two other tasks slip in first. Every single time." | "Two other tasks slip in first, every single time." | 2, 4 | "Every single time." is a fragment; the comma keeps the emphasis without a clipped card. |
| 25 | S07 L4 | "So the phone didn't steal his time. The switching did." | two lines: "So the phone did not steal his time." / "The switching did." | 3, 4 | Split so the reveal lands as its own beat. "The switching did." is retained deliberately — it is the punchline and the preceding sentence supplies its subject. |
| 26 | S08 L2 | "He turns the phone face down, and puts it in the drawer." | "He turns the phone face down, and he puts it in the drawer." | 3, 4 | Subject repeated so the two actions get two beats. |
| 27 | S08 L3 | "Nothing dramatic. Nothing heroic. Just out of sight." | two lines: "It is not dramatic, and it is not heroic." / "It is just out of sight." | 2 | Three fragments in a row; each would render as a one-word subtitle with clipped intonation. |
| 28 | S09 L2 | "217 minutes, still sitting there." | "Two hundred and seventeen minutes, still sitting there." | 5 | Number spelled out. |
| 29 | S09 L2 | "the counter hasn't moved" | "the counter has not moved" | 4 | Full form for the A/B proof beat. |
| 30 | S09 L3 | SAM: "You finished it?" | "Did you finish it?" | 2, 3 | A verbless question reads flat in TTS; the auxiliary gives it natural rising intonation. Meaning unchanged. |
| 31 | S10 L2 | "minutes you don't get back" | "minutes you do not get back" | 4 | Full form lands the final stress on "back". |
| 32 | S10 L3 | "Scientists watched our focus on a single screen fall from 2.5 minutes to 47 seconds." (15 words, one clause stack) | two lines: "Scientists measured how long we hold a single screen." / "It fell from two and a half minutes to forty seven seconds." | 3, 5 | The original packs two ideas into one breath with an awkward "watched…fall" construction. Split for the ear. `2.5` → `two and a half` per rule 5's explicit `1.5x` example. |
| 33 | All scenes | contractions (`that's`, `doesn't`, `isn't`, `didn't`, `can't`, `hasn't`, `don't`) | full forms in **narration and key pivot lines** | 4 | Deliberate, not blanket. Contracted forms are retained nowhere in the narration because every narrator line is a paced beat; character lines keep natural speech (`I started it. And I stayed.`). |

**Total changes:** 33 across 41 narration lines and 5 character lines.
**Beats dropped:** 0. **Claims added:** 0. **Punchline changed:** no.
**Word count:** 362 → 372 (+10, entirely from spelling out numbers and restoring subjects).

---

## Flagged for the client (rule 1 / Part 14 Case 3 discipline)

One change alters more than delivery, so it is flagged rather than buried:

> **Change #1 — S01:** "a number floating above his head" → "a number in the air beside him".

The original wording implied a HUD attached to the character. The engine has no such primitive
(see `universal_toolbook/process/08_LIMITS.md`: boards are screen-space, props are a fixed
library). The counter is realised as an in-world `digital_clock` prop standing beside the desk.
The narration now describes what the film actually shows. **This is a factual-description fix, not
a change to the story's meaning** — but it is the one edit a reviewer should confirm.

No other change alters meaning. If the client wants the original HUD framing, the fix is to add a
`focus_counter` prop to `universal_toolbook/engine/world_props_and_boards.js` and register it in `SUPPORTED_PROPS`;
that is logged as a candidate improvement in `docs/production/LESSONS_LEARNED.md`, not silently
worked around.

---

## Verification performed

- Polished text checked against `RESEARCH.md` §5 confidence table: every asserted number is
  High or Medium-High confidence. The Medium-confidence figures (275 interruptions/day,
  1 h 18 min/day) were **not** introduced.
- The 240-minute daily budget remains framed as a hypothetical ("That is every minute of
  attention he gets today" describes the film's premise, not a measured quantity); the end card
  and `RESEARCH.md` state this explicitly.
- Line lengths: max 16 words per `dialogue` entry after polishing (was 22).
- Spoken-word count used for the runtime estimate in `SCRIPT_POLISHED.md`.
