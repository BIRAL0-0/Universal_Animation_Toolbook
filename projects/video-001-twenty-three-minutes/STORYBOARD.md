# STORYBOARD.md — video-001

**Film:** *What If Every Notification Cost You 23 Minutes?*
**Delivery:** 1080×1920 (9:16) @ 30 fps, ~165 s, 10 scenes.
**Authored stage:** 1920×1080; the renderer reframes to portrait with a subject-aware crop rather
than stretching, so all coordinates below are authored-stage normalised values (`x`, `y` in
0…1 of width, `y` also accepted in px for props/boards per engine convention).

Per the master brief, every scene below defines: **objective · characters · poses/actions ·
background · camera position and movement · animation timing · narration segment · SFX ·
transition to the next scene.**

The counter is realised as an in-world **`digital_clock` prop** (LED readout) plus **`stat_cards`
/ `bar_chart` boards**. There is no above-the-head HUD primitive in the engine — see
`SCRIPT_CHANGELOG.md` change #1.

---

## S01 — THE COUNTER  (~17 s)

| | |
|---|---|
| **Objective** | Hook inside 10 seconds. Put a visible budget of minutes in the air before the viewer knows what it is. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `stretch_wake` (0.0–5.5 s, `x` 0.40) → `idle_stand` (5.5–17 s, `x` 0.42), expression `focused` → `curious` at 6.0 s |
| **Background** | `bedroom_late`, `bed` prop at `x` 0.22 (z −4), dawn sky, accent `#38bdf8` |
| **Camera** | Shot 1 (0.0 s): zoom 1.06→1.10, focus (0.46, 0.58), hard cut. Shot 2 `cue_on "two hundred and forty"`: zoom 1.14→1.22 push onto the clock, focus (0.70, 0.52), `move_dur` 1.8 |
| **Timing** | Clock `digital_clock` at `x` 0.70, `elevation` 150, `time_text "240"`, `led_color "#22d3ee"`, `blink false` |
| **Narration** | "Kai wakes up on a Tuesday morning…" / "Two hundred and forty. That is his focus." / "That is every minute of attention he gets today." / KAI: "What is that?" / "He cannot see it. But it is already counting down." |
| **SFX** | Room tone; bed creak on `stretch_wake`; a soft synthetic chime when the clock resolves; footstep-free (static beats) |
| **Transition out** | Hard cut on the final word — no fade, keeps the hook tight |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S02 — THE RULE  (~18 s)

| | |
|---|---|
| **Objective** | State the mechanism plainly and cite it. This is the film's information payload. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `pace_think` (0.0–9.0 s, `from_x` 0.30 → `to_x` 0.46) → `talk_explain` (9.0–18 s, `x` 0.46), expression `curious` → `focused` |
| **Background** | `mind_space` — deliberately placeless so the two numbers are the only objects in frame. Accent `#22d3ee` |
| **Camera** | Shot 1 (0.0 s): zoom 1.02→1.06, focus (0.44, 0.56). Shot 2 `cue_on "twenty three minutes to come back"`: zoom 1.10→1.18, focus (0.52, 0.54), `move_dur` 2.0, `cut true` |
| **Timing** | `stat_cards` board `cue_on "two seconds"`, `hold_sec` 7.5, `build_dur` 1.0, two cards: `2 SECONDS / TO READ IT` and `23 MINUTES / TO GET BACK` |
| **Narration** | "Here is the rule nobody tells you." / "A notification takes about two seconds to read." / "It takes twenty three minutes to come back from." / "That is not a metaphor." / "Researchers at the University of California, Irvine measured it in real offices." / "The average was twenty three minutes and fifteen seconds." |
| **SFX** | Low pulse bed; a single clean tick on the word "twenty three"; card whoosh on build |
| **Transition out** | Hard cut to the office — the abstraction ends, the workday begins |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S03 — FIRST DRAIN  (~18 s)

| | |
|---|---|
| **Objective** | The first cost, and the fact that it is unfelt. Establish the phone→counter causality. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `sit_desk_type` (0.0–7.0 s, `x` 0.36, `seated true`, `focused`) → `phone_scroll` (7.0–13.0 s, `x` 0.36, `curious`) → `sit_desk_type` (13.0–18 s, `focused`) |
| **Background** | `modern_office`, `clean_desk` prop at `x` 0.36 (z −4, auto split-depth so the tabletop passes over his legs and under his hands), `digital_clock` at `x` 0.74 `elevation` 140 |
| **Camera** | Shot 1 (0.0 s): zoom 1.04→1.08, focus (0.40, 0.58). Shot 2 `cue_on "his phone lights up"`: zoom 1.12→1.20 push to the phone, focus (0.36, 0.60), `move_dur` 1.6. Shot 3 `cue_on "two hundred and seventeen"`: snap to the clock, focus (0.74, 0.50), zoom 1.18, `cut true` |
| **Timing** | Clock `time_text` reads `240` until `cue_on "two hundred and forty becomes"`, then a second clock instance reads `217` with `led_color "#f59e0b"` (amber = first warning) |
| **Narration** | "At nine in the morning, his phone lights up on the desk." / "He reads it, he smiles, and he goes back to work." / "Or he thinks he goes back to work." / KAI: "Two seconds. That is nothing." / "Two hundred and forty becomes two hundred and seventeen." / "He does not feel a thing, and that is exactly the problem." |
| **Boards** | `phone_card` `cue_on "lights up"`, `sender "UNKNOWN • 9:02 AM"`, `incoming ["You around? Quick one."]`, `hold_sec` 4.5 |
| **SFX** | Notification ping (bright, short); keyboard typing bed under `sit_desk_type`; a descending two-note motif as the clock drops |
| **Transition out** | Hard cut |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S04 — ESCALATION  (~18 s)

| | |
|---|---|
| **Objective** | Repetition with acceleration. The viewer must feel the drain before Kai does. |
| **Characters** | KAI (alone) |
| **Poses / actions** | Three `phone_scroll` beats: (0.0–6.0 s, `x` 0.36, `curious`) → (6.0–12.0 s, `x` 0.36, `tense`) → (12.0–18 s, `x` 0.36, `tired`) |
| **Background** | `modern_office`, same desk geometry as S03 (**deliberately identical framing** — the repetition is the point), accent shifting `#f59e0b` → `#fb7185` |
| **Camera** | Shot 1 (0.0 s): zoom 1.06→1.10. Shot 2 `cue_on "and another, and another"`: zoom 1.14→1.24, `move_dur` 2.4, tightening with each buzz. Shot 3 `cue_on "one seventy one"`: focus (0.74, 0.50), zoom 1.26, hard cut |
| **Timing** | Three clock states: `194`, then `171`, `led_color "#fb7185"` (rose = accelerating) |
| **Narration** | "Then another one arrives, and another, and another." / "The counter drops. Two hundred and seventeen, one ninety four, one seventy one." / "Each one felt free, and none of them were." / "He is not losing seconds." / "He is losing the return trip, every single time." |
| **Boards** | Three `phone_card` instances at `cue_on` each "another", senders `GROUP CHAT • 10:14 AM` / `NEWS • 11:02 AM` / `WORK • 11:41 AM`, each `hold_sec` 2.8, staggered `x` so they stack visibly |
| **SFX** | Three pings at rising pitch and shortening interval — the audio alone should feel like pressure |
| **Transition out** | Hard cut to the white analytical space |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S05 — THE ARITHMETIC  (~15 s)

| | |
|---|---|
| **Objective** | Make it countable. Turn a feeling into a number the viewer can check. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `point_board` (0.0–8.0 s, `x` 0.30, `facing` 1, `shocked`) → `check_watch` (8.0–15 s, `x` 0.30, `worried`) |
| **Background** | `tech_lab` — clean, instrument-panel feel. Accent `#f59e0b` |
| **Camera** | Shot 1 (0.0 s): zoom 1.02→1.06, focus (0.44, 0.56). Shot 2 `cue_on "more than four hours"`: zoom 1.12→1.20 onto the chart, focus (0.62, 0.52), `move_dur` 2.0 |
| **Timing** | `bar_chart` `cue_on "eleven notifications"`, `hold_sec` 6.5, bars: `TIME LOST` value 1.0 colour `#fb7185` and `TIME HE FELT` value 0.03 colour `#94a3b8` — the visible near-zero bar **is** the argument |
| **Narration** | "By lunchtime, Kai has answered eleven notifications." / "Eleven times twenty three minutes is more than four hours." / "He started the day with eight." / "The work on his desk has not moved an inch." |
| **SFX** | Chart draw-on ticks; a low thud on "four hours" |
| **Transition out** | Cross-fade 0.55 s — the only soft transition in the film, marking the shift from analysis to consequence |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S06 — EMPTY AFTERNOON  (~14 s)

| | |
|---|---|
| **Objective** | The anti-climax. Nothing dramatic happens — that is what makes it dangerous. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `sit_desk_slump` (0.0–7.0 s, `x` 0.38, `exhausted`) → `head_in_hands` (7.0–14 s, `x` 0.38, `exhausted`) |
| **Background** | `bedroom_late` re-used as a dusk interior, `messy_desk` prop at `x` 0.38 (**the desk is now messy — the only set change, so the day's passage is legible on mute**), accent `#64748b` (deliberately desaturated) |
| **Camera** | Shot 1 (0.0 s): zoom 1.10→1.04, a slow **pull back** — the frame opens up around him as the day empties. Shot 2 `cue_on "the counter reads nine"`: snap to the clock, focus (0.76, 0.50), zoom 1.22, `cut true` |
| **Timing** | Clock `time_text "009"`, `led_color "#ef4444"` (red), `blink true` — the only blinking clock in the film |
| **Narration** | "At three in the afternoon, the counter reads nine." / "Nothing dramatic happened. No crash, and no disaster." / KAI: "Where did the day go?" / "It went into the gaps between things." |
| **SFX** | BGM drops out almost entirely; room tone only; one distant traffic pass |
| **Transition out** | Cross-fade into `mind_space` |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S07 — THE REAL THIEF  (~16 s)

| | |
|---|---|
| **Objective** | The revelation. It is not the phone. It is the switching. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `kneel_lookup` (0.0–8.0 s, `x` 0.42, `tired`) → `stand_up_resolve` (8.0–16 s, `x` 0.42, `determined`) |
| **Background** | `mind_space`, accent `#22d3ee` returning (the idea-space colour from S02 — the film rhymes) |
| **Camera** | Shot 1 (0.0 s): zoom 1.04→1.08, low focus (0.44, 0.62). Shot 2 `cue_on "two other tasks slip in"`: zoom 1.12→1.20 onto the chain, focus (0.60, 0.52), `move_dur` 2.2. Shot 3 `cue_on "the switching did"`: pull to 1.06, focus (0.44, 0.56), `blend_sec` 0.55, no cut — the reveal resolves gently |
| **Timing** | `flow_chain` board `cue_on "nobody goes straight back"`, `hold_sec` 8.0, nodes: `THE TASK` → `THE BUZZ` → `TASK TWO` → `TASK THREE` → `BACK, EVENTUALLY` |
| **Narration** | "Here is the part that surprised the researchers." / "Nobody goes straight back to what they were doing." / "Two other tasks slip in first, every single time." / "So the phone did not steal his time." / "The switching did." |
| **SFX** | Reveal sting (soft, not a hit); chain nodes tick on as they build; a held silence before "The switching did." |
| **Transition out** | Hard cut |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S08 — ONE SMALL THING  (~14 s)

| | |
|---|---|
| **Objective** | The change must be small. Nothing heroic — that is what makes it available to the viewer. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `pick_up_floor` (0.0–5.0 s, `x` 0.40, `determined`) → `stand_from_desk` (5.0–9.5 s, `x` 0.38) → `idle_stand` (9.5–14 s, `x` 0.40, `determined`) |
| **Background** | `modern_office`, `clean_desk` at `x` 0.38 — **the desk is clean again**, rhyming with S03 and marking the reset visually. Accent `#34d399` (green, first time) |
| **Camera** | Shot 1 (0.0 s): zoom 1.06→1.10. Shot 2 `cue_on "face down"`: zoom 1.16→1.22, focus (0.40, 0.60), `move_dur` 1.6, close on the phone |
| **Timing** | `phone_card` `cue_on "turns the phone face down"`, `sender "EVERYTHING • 3:47 PM"`, `call_declined "ALL NOTIFICATIONS OFF"`, `hold_sec` 5.0 |
| **Narration** | "So Kai does one small thing." / "He turns the phone face down, and he puts it in the drawer." / "It is not dramatic, and it is not heroic." / "It is just out of sight." |
| **SFX** | Drawer slide and a soft wooden thud; the ping motif from S03–S04 returns **once** and is cut short — the sound of a notification dying |
| **Transition out** | Hard cut, with a 0.4 s time-card |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S09 — ONE HOUR LATER  (~14 s)

| | |
|---|---|
| **Objective** | The A/B proof. Same room, same work, one variable changed. This is reference 2's rewind structure, rebuilt as a contrast cut rather than a literal replay. |
| **Characters** | KAI + SAM (**two characters — the engine maximum, deliberately reached exactly once**) |
| **Poses / actions** | KAI `sit_desk_type` (0.0–14 s, `x` 0.34, `seated true`, `focused`). SAM `walk` (0.0–5.0 s, `from_x` 0.78 → `to_x` 0.66) → `listen_nod` (5.0–9.0 s, `x` 0.66, `smile`) → `walk` (9.0–14 s, `from_x` 0.66 → `to_x` 0.80) |
| **Background** | `modern_office`, warm accent `#34d399`, `clean_desk` at `x` 0.34 |
| **Camera** | Shot 1 (0.0 s): zoom 1.04→1.08, focus (0.40, 0.58). Shot 2 `cue_on "did you finish it"`: pan to Sam, `focus_x_from` 0.40 → `focus_x_to` 0.66, zoom 1.12, `move_dur` 1.8, `cut false`, `blend_sec` 0.5. Shot 3 `cue_on "and I stayed"`: back to Kai, focus (0.34, 0.58), zoom 1.20, `cut true` |
| **Timing** | Clock `time_text "217"`, `led_color "#34d399"` — **the same number as S03's post-drop value, unchanged.** The unchanged clock is the entire beat |
| **Narration** | "One hour later, the counter has not moved." / "Two hundred and seventeen minutes, still sitting there." / SAM: "Did you finish it?" / KAI: "I started it. And I stayed." |
| **SFX** | Warm room tone; keyboard bed; no pings at all — the absence is the sound design |
| **Transition out** | Slow cross-fade to the summit |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

## S10 — THE PRICE  (~20 s)

| | |
|---|---|
| **Objective** | Conclusion and direct address. Hand the question to the viewer. |
| **Characters** | KAI (alone) |
| **Poses / actions** | `look_horizon` (0.0–11.0 s, `x` 0.44, `determined`) → `chest_hand_sincere` (11.0–16.0 s, `x` 0.44) → `point_emphasis` (16.0–20 s, `x` 0.44, `focused`) |
| **Background** | `sunrise_summit` — the only exterior, the only horizon, the only warm light in the film. Accent `#fbbf24` |
| **Camera** | Shot 1 (0.0 s): zoom 1.00→1.04, wide, focus (0.48, 0.54) — the widest frame in the film. Shot 2 `cue_on "ask one question"`: zoom 1.10→1.18 push to a close, focus (0.44, 0.56), `move_dur` 2.4. Shot 3 on the final question: hold at 1.20 |
| **Timing** | `checklist_card` board `cue_on "ask one question"`, `hold_sec` 5.0, single item: `WHAT WILL THIS COST ME?` |
| **Narration** | "Your attention was never free." / "Every buzz has a price, and you pay it in minutes you do not get back." / "Scientists measured how long we hold a single screen." / "It fell from two and a half minutes to forty seven seconds." / "So before you unlock your phone, ask one question." / "What is this going to cost me?" |
| **SFX** | BGM swells to its only full-height moment, then resolves; a single soft bell under the final question |
| **Transition out** | Fade to the end card (source attribution) |
| **Portrait** | Engine defaults (no manual overrides): auto-focus follows the active character and `fitBoardToPortraitViewport` re-fits every board into the safe crop. Hand-authored `portrait_focus*` overrides were removed 2026-11-09 — see KI-009 and PRODUCTION_LOG. |

---

## Pacing summary

| Scene | Est. length | Cumulative | Act |
|---|---|---|---|
| S01 | 17 s | 0:17 | Hook |
| S02 | 18 s | 0:35 | Hook / premise |
| S03 | 18 s | 0:53 | Escalation |
| S04 | 18 s | 1:11 | Escalation |
| S05 | 15 s | 1:26 | Escalation |
| S06 | 14 s | 1:40 | Collapse |
| S07 | 16 s | 1:56 | Revelation |
| S08 | 14 s | 2:10 | Change |
| S09 | 14 s | 2:24 | Proof |
| S10 | 20 s | 2:44 | Close |

Runtime is **speech-locked**, not declared: the engine retimes every scene to the generated audio,
so these are planning estimates. The `--shorts` gate requires ≤180 s. Estimated 165 s leaves ~15 s
of headroom.

## Mute-legibility map (reference 1's test)

With the audio off, the frame sequence must still read:

```
clock 240  →  2s vs 23min cards  →  phone + clock 217  →  three stacked phones
→  bar chart (huge loss / tiny felt)  →  messy desk + red clock 009  →  task chain
→  phone face-down + green  →  clean desk + clock still 217  →  horizon + question card
```

Colour also carries it alone: **cyan → amber → rose → grey → green → gold**, i.e. curiosity,
warning, acceleration, emptiness, recovery, resolve.

## Retention decisions

- The hook is a number, not a logo or a cold scene — the viewer is mid-premise by 0:08.
- A state change happens every 14–18 s, so there is no quiet patch longer than one beat.
- The only two soft transitions in the film (S05→S06, S09→S10) mark act boundaries; everywhere
  else is a hard cut, which keeps the pace up on a Shorts surface.
- The final line is a question addressed to the viewer, which is also the comment prompt.
