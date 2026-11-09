# VOICEOVER POLISH PROMPT — the authoritative script-editing standard

**Status: PROCESS-STANDARD (codified).** This file is the repository's single authoritative
version of the English AI voiceover script-editing standard. The standard was first supplied
to the agent conversationally; it is codified here so the rule survives every session.
**When in doubt, this file wins** — do not edit scripts to a weaker summary of it, and do
not silently invent a competing standard. If this file is ever revised, record the revision
in [`WORKFLOW_CHANGELOG.md`](../WORKFLOW_CHANGELOG.md).

Use it at Stage 6 (see [`SCRIPT_WORKFLOW.md`](../SCRIPT_WORKFLOW.md)): apply it to the
complete script to produce the TTS-ready narration the engine will speak.

---

## The prompt (copy-paste form)

```text
You are editing an English script for AI text-to-speech voiceover. Rewrite it so a neural
voice delivers it the way a skilled late-night podcast host would read it aloud: natural,
conversational, unhurried but never flat.

HARD RULES
1. Preserve the original tone, meaning, and word choices of the story. You are making the
   text *spoken-ready*, not rewriting the story. No new claims, no dropped beats, no
   different punchline.
2. Fix grammar and sentence structure: complete sentences in the right order, no fragments
   left dangling where a pause will swallow them, no run-ons that force the voice into a
   single breath.
3. Write conversational English, not written English. Shorten sentences for the ear: aim
   for 8–16 words per sentence; break any sentence that would take more than one breath.
   Vary length deliberately — one long line after two short ones is rhythm, not error.
4. Make punctuation *mean* a pause.
   - A comma buys a short beat; a full stop a clear one; a semicolon a held breath.
   - Use an ellipsis (...) ONLY for a deliberate dramatic pause — every ellipsis costs
     real silence on the timeline.
   - Prefer commas and short sentences over stacking clauses.
5. Numbers and symbols must be written as they will be spoken:
   - "9 PM" → "nine in the evening" (or "nine PM" if the tone allows abbreviations)
   - "40-90 seconds" → "forty to ninety seconds"
   - "1.5x" → "one and a half times"
   - Percent signs → "percent"; slashes → "per" or "out of"; arrows → "leads to" / "becomes".
   Never leave a token a reader pronounces but a listener would not.
6. Technical terminology must be pronunciation-safe: spell out anything the voice might
   mispronounce, or rephrase to the common spoken form. Jargon keeps its meaning but gets
   a listener's path.
7. Brand names and proper nouns: keep them, but prefer the form people actually say ("the
   toolbook", "Piper", "H.264" → "H two sixty-four" or "the H-two-sixty-four codec").
8. Output the complete polished script, in the same structure and scene order as the input.
   Nothing omitted, nothing added beyond what delivery requires.

VERBATIM MODE (only when the user's exact words must be preserved)
9. Keep every word, in order. You may then change ONLY punctuation and spacing to shape
   pauses (e.g. "just... started" → "just started"; "step two. Slid backward" → "step two,
   slid backward"). If a word-level change is required for the voice to speak it correctly,
   do NOT make it — flag it as a proposed change with your reason, and wait for approval.

OUTPUT
The polished script only, plus a short change log: each change, the line it touched, and
which rule above justified it.
```

---

## Why each rule exists (engine grounding)

| Rule | What the engine does that makes it matter |
| --- | --- |
| 2 Fragments | TTS renders each `dialogue` entry as one audio line; a fragment line produces a clipped intonation and a one-word subtitle that gets merged with the next line into a two-row card. |
| 3 Sentence length | Subtitles are per-line; long lines wrap into two rows (sits lower, can cover legs). One sentence per `dialogue` entry is the authoring rule. |
| 4 Punctuation | The engine's silence compactor preserves ellipsis pauses and gives sentence punctuation ≥ 0.42 s, commas ≥ 0.24 s — so your punctuation *is* the timing design. |
| 5 Numbers/symbols | Backends spell digits inconsistently; spoken forms are deterministic. Word boundaries (which drive subtitle glow and lip-sync) are extracted from the spoken audio. |
| 6/7 Jargon, names | Mispronunciation is audible and unfixable in post — the mix is final after render. |
| 9 Verbatim mode | `validate --script` compares word tokens (punctuation-insensitive, order-sensitive). Punctuation-only edits pass; word changes fail `exact_word_match` — so they must be an explicit, user-approved exception. |

## Applying it in practice

1. Input: `work/<slug>/script_v1.md`. Output: `work/<slug>/script_polished.md`.
2. Keep the change log the prompt demands — it goes into `work/<slug>/decisions.md` so the
   Stage 6 approval is reviewable line by line.
3. After approval, the polished text is copied verbatim into `episode.json`
   (`dialogue[].text` / `scene.narration`). No further editing happens between approval and
   render — if something is wrong at draft-review time, the fix loop goes back to this
   stage (re-approval for verbatim scripts).
