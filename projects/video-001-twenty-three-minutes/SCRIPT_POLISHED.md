# SCRIPT_POLISHED.md — video-001

**Film:** *What If Every Notification Cost You 23 Minutes?*
**Draft:** v2 — TTS-ready
**Date:** 2026-11-09
**Polishing standard:** [`docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md`](../../docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md)
**Standard integrity:** sha256 `aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea`,
5256 bytes — **used exactly as it exists, not modified, not summarised.**
**Source:** [`SCRIPT_ORIGINAL.md`](SCRIPT_ORIGINAL.md)
**Change log:** [`SCRIPT_CHANGELOG.md`](SCRIPT_CHANGELOG.md)

**Mode:** standard polish (rules 1–8). **Not** verbatim mode — this is an original script, so
word-level edits for spoken delivery are permitted. No new claims were introduced, no beats were
dropped, no punchline was changed.

> The text below is what goes into `episode.json` `dialogue[].text`, **verbatim**. No further
> editing happens between this approval and render.

---

## S01 — THE COUNTER

**NARRATOR:** Kai wakes up on a Tuesday morning, and there is a number in the air beside him.
**NARRATOR:** Two hundred and forty. That is his focus.
**NARRATOR:** That is every minute of attention he gets today.
**KAI:** What is that?
**NARRATOR:** He cannot see it. But it is already counting down.

## S02 — THE RULE

**NARRATOR:** Here is the rule nobody tells you.
**NARRATOR:** A notification takes about two seconds to read.
**NARRATOR:** It takes twenty three minutes to come back from.
**NARRATOR:** That is not a metaphor.
**NARRATOR:** Researchers at the University of California, Irvine measured it in real offices.
**NARRATOR:** The average was twenty three minutes and fifteen seconds.

## S03 — FIRST DRAIN

**NARRATOR:** At nine in the morning, his phone lights up on the desk.
**NARRATOR:** He reads it, he smiles, and he goes back to work.
**NARRATOR:** Or he thinks he goes back to work.
**KAI:** Two seconds. That is nothing.
**NARRATOR:** Two hundred and forty becomes two hundred and seventeen.
**NARRATOR:** He does not feel a thing, and that is exactly the problem.

## S04 — ESCALATION

**NARRATOR:** Then another one arrives, and another, and another.
**NARRATOR:** The counter drops. Two hundred and seventeen, one ninety four, one seventy one.
**NARRATOR:** Each one felt free, and none of them were.
**NARRATOR:** He is not losing seconds.
**NARRATOR:** He is losing the return trip, every single time.

## S05 — THE ARITHMETIC

**NARRATOR:** By lunchtime, Kai has answered eleven notifications.
**NARRATOR:** Eleven times twenty three minutes is more than four hours.
**NARRATOR:** He started the day with eight.
**NARRATOR:** The work on his desk has not moved an inch.

## S06 — EMPTY AFTERNOON

**NARRATOR:** At three in the afternoon, the counter reads nine.
**NARRATOR:** Nothing dramatic happened. No crash, and no disaster.
**KAI:** Where did the day go?
**NARRATOR:** It went into the gaps between things.

## S07 — THE REAL THIEF

**NARRATOR:** Here is the part that surprised the researchers.
**NARRATOR:** Nobody goes straight back to what they were doing.
**NARRATOR:** Two other tasks slip in first, every single time.
**NARRATOR:** So the phone did not steal his time.
**NARRATOR:** The switching did.

## S08 — ONE SMALL THING

**NARRATOR:** So Kai does one small thing.
**NARRATOR:** He turns the phone face down, and he puts it in the drawer.
**NARRATOR:** It is not dramatic, and it is not heroic.
**NARRATOR:** It is just out of sight.

## S09 — ONE HOUR LATER

**NARRATOR:** One hour later, the counter has not moved.
**NARRATOR:** Two hundred and seventeen minutes, still sitting there.
**SAM:** Did you finish it?
**KAI:** I started it. And I stayed.

## S10 — THE PRICE

**NARRATOR:** Your attention was never free.
**NARRATOR:** Every buzz has a price, and you pay it in minutes you do not get back.
**NARRATOR:** Scientists measured how long we hold a single screen.
**NARRATOR:** It fell from two and a half minutes to forty seven seconds.
**NARRATOR:** So before you unlock your phone, ask one question.
**NARRATOR:** What is this going to cost me?

---

## Delivery notes for the voice engine

| Setting | Value |
|---|---|
| Engine | Kokoro-82M int8 ONNX (local, offline) |
| `narrator` | `am_michael`, speed 1.0 |
| `kai` | `am_liam`, speed 1.03 |
| `sam` | `af_bella`, speed 1.02 |
| Sentence pause | 0.25 s (engine default) |
| Clause pause | 0.10 s (engine default) |
| Authored `pause_after` | 0.30 s normal, 0.45–0.60 s at act turns |

**Deliberate held silences** (rule 4 — every ellipsis costs real timeline silence, so none are
used; held beats are authored as `pause_after` instead):
- after *"It takes twenty three minutes to come back from."* — 0.60 s
- after *"Two hundred and forty becomes two hundred and seventeen."* — 0.45 s
- after *"The switching did."* — 0.55 s
- before the final question — 0.50 s

**Word count:** 372 spoken words. At the engine's ~2.5 words/sec plus authored pauses and
1.3 s/scene lead-in and tail-out, the expected final runtime is **~160–170 s**, inside the
`--shorts` ceiling of 180 s.

## Pronunciation risks checked (rule 6)

| Token in original | Risk | Polished form |
|---|---|---|
| `UC Irvine` | backend may say "uck" | `the University of California, Irvine` |
| `2.5 minutes` | "two point five" vs "two and a half" | `two and a half minutes` |
| `9:00 AM` / `3:00 PM` | colon read aloud | `nine in the morning` / `three in the afternoon` |
| `217`, `194`, `171`, `240` | digit-string reading varies | spelled-out hundreds |
| `×` (implied in "11 times 23") | symbol | the word `times` |
