# QA REPORT — video-001 "What If Every Notification Cost You 23 Minutes?"

Date: 2026-11-09 · Branch arena/0c65af06-universal-animation-toolbook
Verdict: **PASS — shippable.** Every number below was measured from the rendered artifacts in this
folder; every frame claim was verified by opening the PNG. Nothing here is asserted from intent.

## 1. Deliverables

| Artifact | Path | Measured |
|---|---|---|
| Shorts master (9:16) | `final.mp4` | 1080×1920, 30 fps, h264 High + AAC 44.1 kHz stereo, 158.96 s, 14.25 MB |
| Regular master (16:9) | `renders/final_16x9.mp4` | 1920×1080, 30 fps, 158.96 s, 10.38 MB |
| Draft (look-dev) | `renders/draft_9x16.mp4` | 540×960, 158.96 s |
| Mixed audio | `.work_final/master_audio.wav` | 44.1 kHz stereo, 158.96 s |
| Chapters | `final_chapters.txt` | 10 chapters, one per scene |
| QA frames | `assets/qa_frames/*.png` | 8 frames, timestamps below |

## 2. Container / completeness (STAGE I, automated + manual)

- ffprobe: `Duration: 00:02:38.96`, video `1080x1920 yuv420p 30 fps`, audio: aac LC, 44100 Hz, stereo, 195 kb/s.
- Full decode `-f null -`: **no errors** (`full_decode_ok: true`) — no corrupt/missing frames.
- Start/end: first frame shows S01 bedroom + clock 7:14 AM; last frame shows S10 sunset card.
  No black screens at head or tail (checked frames at 0.5 s / 158.5 s during draft review; masters
  decoded end-to-end).
- Aspect gate (KI-007): `final_validation_report.json` → `dimensions_match_aspect: true`,
  `valid: true` for both masters. Draft re-check after the engine fix: pixels 540×960, not 960×540.

## 3. Audio loudness & mix (STAGE G, measured from the mixed WAV)

| Metric | Value | House target (process/05_AUDIO.md) | Verdict |
|---|---|---|---|
| Peak | **−1.17 dBFS** | −3 … −1 | PASS |
| RMS | **−17.50 dBFS** | −16 … −19 | PASS |
| Duration | 158.96 s | ≤180 s (Shorts) | PASS |
| Near-silent 1 s windows | 0 of 158 | — | PASS (no dead air) |

History (KI-008): the first master measured peak −1.72 / RMS **−24.07** dBFS. Windowed analysis
showed the whole *active* mix was quiet (median active window −24.2), and diagnosis showed brief
transients (pings/plosives) pinned the peak at a 22 dB crest factor, so gain alone could not help
and an RMS-envelope compressor could not see the transients. Engine fix: 3 ms fast-attack peak
limiter (thr −10 dBFS, 6:1, 120 ms release) + bounded make-up (+7.45 dB applied, cap +8 dB, never
attenuates, never clips). Re-render → −1.17 / −17.50. Regression: `tests/production/test_ki008_mix_loudness.py` (4/4).

Narration is Kokoro offline (`af_bella` Bella as narrator, `am_michael` Kai, `am_liam` Sam —
voices chosen per policy: Michael primary where a male lead speaks, Bella preferred secondary as
narrator). BGM ducked −9.5 dB under speech; credits in `final_report.json` and §7.

## 4. Visual verification (frames actually opened and inspected)

Draft board frames (`renders/draft_9x16_visual_audio_cues.json` → board_pop + 1.6 s) after the
portrait-override removal (KI-009): S01 @7.13 s stat cards + Kai centred, S05 @77.37 s bar chart +
Kai present (previously clipped/absent), S09 @104.52 s both characters in crop.

Final-master frames (`assets/qa_frames/`), all inspected by eye:

| Frame | Act colour | What was verified |
|---|---|---|
| t006.36 | cyan | S01 bedroom, clock, Kai waking; no clipping at crop edges |
| t025.43 | cyan | **stat-card board fully inside crop**, "2 SEC / 23 MIN" legible, Kai centred gesturing |
| t047.69 | green | S03 street, phone card in band, Kai walking mid-stride |
| t071.53 | rose | S05 night office: exhausted face, glowing phone, desk+lamp — emotion reads |
| t095.38 | rose | S06 flow chain board legible in band |
| t119.22 | green | S08 "CALL DECLINED · ALL NOTIFICATIONS OFF" card legible; Kai mid-sit pose, subtitle in safe area |
| t139.88 | amber | S09 Sam + Kai both in crop during her line (auto-focus followed the speaker) |
| t154.19 | amber | S10 sunset, "2.5 MIN / 47 SEC" board legible, character centred |

Subtitles sit inside the Shorts safe area in every frame; info band (top third) is always either a
legible board or clean environment — no board was ever expected in speech-less stills (KI-003).

## 5. Content & continuity

- Duration 158.96 s ≤ 180 s Shorts limit; 10 scenes; validate warnings `[]`.
- Fact base (RESEARCH.md): 23 min 15 s refocus cost (Mark, 2008) ✅ quoted as "about twenty-three
  minutes"; ~2 intervening tasks ✅; attention 2.5 min→47 s (2004→2024 studies) ✅ in S10 card;
  the 275-unlocks/day figure was **excluded** (insufficient sourcing).
- Character consistency: Kai (white/brown hair) and Sam (pink) identical across all frames;
  reference sheets in `assets/`; poses vary per scene (walk, sit, slump, stand, gesture).
- No copyrighted material from the two reference videos: concept, script, art and boards are
  original (see REFERENCE_ANALYSIS.md).

## 6. Open cosmetic items (not blocking)

- KI-002 (cosmetic): top band looks empty in *stills*; in the film it is the timed info band — by design.
- Portrait engine zoom (`cameraZoomScale > 1` mis-centres) remains deferred; not used in this video.

## 7. Licences & attribution

- Music (auto-credited in-video end card + `final_report.json`): "Where Stars Fall", "The Distant
  Sun (Monomyth 1)", "The Restoration (Monomyth 12)" — Scott Buckley, **CC BY 4.0** (attribution
  given); "Softly" — Loyalty Freak Music, **CC0**.
- Voices: Kokoro-82M (Apache-2.0) offline; no paid APIs anywhere in the pipeline.
- Fonts/graphics: engine-drawn vector primitives, no third-party font files.

## 8. Reproduction

```bash
.venv/bin/python setup_tts.py --check            # Kokoro weights cached under cache/tts
.venv/bin/python tools/produce_video.py projects/video-001-twenty-three-minutes
```
Full re-render ≈ 35 min on 2 CPUs (draft ≈ 4 min, each master ≈ 8 min). Chunk caches under
`renders/.work_*` and `projects/*/.work_*` resume; delete them after episode/dimension edits.
