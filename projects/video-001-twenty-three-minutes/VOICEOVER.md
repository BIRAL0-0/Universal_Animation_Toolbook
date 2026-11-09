# VOICEOVER.md — video-001

**Film:** *What If Every Notification Cost You 23 Minutes?*
**Script source of truth:** [`SCRIPT_POLISHED.md`](SCRIPT_POLISHED.md) (copied verbatim into
`episode.json`; no editing between approval and render).
**Polishing standard:** `docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md`, used
byte-for-byte (sha256 `aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea`).

---

## Engine and voice selection

**Engine priority (master brief Part 6): Kokoro first; Piper only as fallback.**
This session's `setup_tts.py` report: `kokoro READY · piper READY` — Kokoro-82M int8 ONNX with the
v0.19 set (11 voices) merged with the v1.0 set (33 voices) = **44 selectable Kokoro voices**,
24 kHz, fully offline. Piper is retained strictly as fallback. Edge/Azure is not used.

| Speaker | Voice | Set | Rate | Pitch | Casting reason |
|---|---|---|---|---|---|
| `narrator` | **`am_michael`** | v0.19 | +1% | −1Hz | Repository PRIMARY default (`tts/config/voices.json` → `selection.default_voice`). Warm, authoritative, even pace — the right register for stating measured facts without preaching |
| `kai` | `am_liam` | v1.0 | +3% | +1Hz | Warm, friendly, natural; reads younger than Michael, so the protagonist and the narrator never blur. Used for only three lines, so distinctness matters more than range |
| `sam` | **`af_bella`** | v0.19 | +2% | +0Hz | Repository preferred SECONDARY (`selection.secondary_voices[0]`). Warm, professional, clear — a colleague, not a co-narrator |

**Why not other voices:** `am_adam` (bright/upbeat) would undercut the documentary register;
`af_sky` (bright/youthful) is wrong for the colleague's single grounded question; `am_onyx`
(deep/trailer) would over-dramatise factual lines. The brief allows other Kokoro voices only when
they genuinely suit a character or storytelling style; these three do, the rest did not.

Voice names are written **natively** (`am_michael`, not an Edge alias) in `episode.json` so the
resolution path is deterministic: `kokoro_provider.resolve_voice` passes known native names
straight through and reports any fallback via `voice_fallback()`. The rendered report's
`voice_backend` field is checked in QA to confirm Kokoro actually spoke, not Piper.

## Narration requirements and how each is met

| Requirement (brief Part 6) | How it is met | Verified by |
|---|---|---|
| Natural speaking speed | Speed 1.00 on the narrator (Kokoro default), no rate hacks; sentence lengths held to 8–16 words by the polish standard | polished script line lengths; draft listen |
| Correct pronunciation | Rule 5/6/7 of the polish standard: digits spelled out, `UC Irvine` → spoken form, `2.5` → "two and a half", times as words | `SCRIPT_CHANGELOG.md`; draft listen |
| Appropriate pauses | Engine silence compactor: sentence punctuation ≥0.42 s, comma ≥0.24 s; authored `pause_after` 0.28–0.80 s; four deliberate held silences at act turns | episode.json `pause_after`; measured inter-line gaps in the mixed WAV |
| Expressive delivery | Per-beat `expression` on characters drives lip-sync amplitude and body language; narrator cadence shaped by punctuation (rule 4) | stills + draft frames |
| Consistent volume | Single engine, single sample rate (24 kHz), one mix pass; mix targets measured on the rendered WAV | `qa_measurements.json` peak/RMS |
| No rushed narration | No line exceeds 16 words; long original sentences split at polish (changes #7, #32) | change log |
| No clipping or distortion | Mix peak target −3…−1 dBFS, measured post-render | `qa_measurements.json` |

## Line inventory

49 narration entries across 10 scenes: **41 narrator**, **5 KAI**, **1 SAM**, plus 2 KAI lines
counted above. 372 spoken words. Expected speech ≈148 s; with authored pauses and 1.3 s/scene
lead-in/tail-out the engine's validated duration is **164 s** (`run_studio.py validate`), inside
the 180 s `--shorts` ceiling.

## Music and sound design

- **BGM mode `dynamic`** — per-scene tracks crossfaded from the bundled Creative Commons catalogue:
  `reflective_piano` (S01, S06) · `chill_focus` (S02, S03, S08, S09) · `suspense_tension`
  (S04, S05, S07) · `triumph_horizon` (S10). Act mapping: curiosity → information → pressure →
  collapse → revelation → recovery → resolve.
- **Speech ducking** on; `bgm_gain` 0.72–0.92 per scene (S06 deliberately lowest — the collapse is
  near-silent by design).
- **Foley** derived from scene events by the engine: footsteps on `walk` beats, key bed under
  `sit_desk_type`, notification pings, chair/desk contact, drawer thud on S08's phone put-down.
- **Transition and emphasis sounds:** cross-fades at the two act boundaries (S05→S06, S09→S10);
  hard cuts elsewhere; accent-word subtitle glow supplies visual emphasis in sync.
- **Silence as design:** S09 contains **no** pings at all — the absence is the sound of the
  change working.

Narration sits clearly above music and effects: the mix is measured after render, and if RMS or
peak fall outside target the stage is re-run (self-healing obligation), never shipped.

## Licences

All music is from the repository's bundled Creative Commons set; track licences and attribution
are recorded in [`ASSET_MANIFEST.json`](ASSET_MANIFEST.json) and echoed into the delivery
chapters/credits file by the renderer. Kokoro and Piper models are open-weight; the voice sets are
the repository's pinned, SHA-256-verified downloads. No paid TTS service is used.
