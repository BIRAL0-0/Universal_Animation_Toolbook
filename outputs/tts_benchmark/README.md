# TTS voice samples (committed)

**Real outputs** from the 2026-11-09 voice-expansion benchmark
(`universal_toolbook/tools/tts_voice_benchmark.py`) — the same audio the
pipeline would generate, run standalone with the production processing
chain (resample 44.1 kHz → peak pre-pass → RMS −16 dBFS → soft limit
−0.5 dBFS), 128 kbps MP3. So differences between files are *voice*
differences, not level differences.

Full 4-script results for the 14 shortlisted voices + 2 Piper voices are in
`output/tts/benchmark2/` (git-ignored; re-run the harness to regenerate).
Style cards for the 13 remaining v1.0-only voices are in
`output/tts/style_cards/` (git-ignored).

## Listening set

| File | Voice | Why it's here |
| --- | --- | --- |
| `kokoro_am_michael_energetic_youtube.mp3` | `am_michael` (male, warm) — **primary default** | reference standard |
| `kokoro_am_michael_v1_conversational.mp3` | `am_michael_v1` | v1.0 re-recording — A/B against `am_michael` |
| `kokoro_af_bella_conversational.mp3` | `af_bella` (female, bright) — **secondary** | reference standard |
| `kokoro_af_bella_energetic_youtube.mp3` | `af_bella` | same voice, energetic script |
| `kokoro_af_bella_educational.mp3` | `af_bella` | same voice, technical script |
| `kokoro_af_bella_dramatic.mp3` | `af_bella` | same voice, dramatic script |
| `kokoro_af_bella_v1_conversational.mp3` | `af_bella_v1` | v1.0 re-recording — A/B against `af_bella` |
| `kokoro_am_onyx_conversational.mp3` | `am_onyx` (deep male) | documentary / trailer |
| `kokoro_am_liam_conversational.mp3` | `am_liam` (warm male) | conversational |
| `kokoro_am_fenrir_conversational.mp3` | `am_fenrir` (young male) | casual / gaming |
| `kokoro_am_eric_conversational.mp3` | `am_eric` (steady male) | explainer |
| `kokoro_af_heart_conversational.mp3` | `af_heart` (warm female) | conversational / hosting |
| `kokoro_af_jessica_conversational.mp3` | `af_jessica` (bright female) | energetic YouTube |
| `kokoro_af_aoede_conversational.mp3` | `af_aoede` (soft female) | calm / meditative |
| `kokoro_af_kore_conversational.mp3` | `af_kore` (neutral female) | professional narration |
| `kokoro_bf_alice_conversational.mp3` | `bf_alice` (British female) | UK narration |
| `kokoro_bm_daniel_conversational.mp3` | `bm_daniel` (British male) | UK narration |
| `piper_en_US-ryan-medium_conversational.mp3` | Piper `en_US-ryan-medium` | fallback comparison (fastest pace) |
| `piper_en_GB-alan-medium_conversational.mp3` | Piper `en_GB-alan-medium` | fallback comparison (pace matches `am_michael`) |

The 4 benchmark scripts (conversational / energetic_youtube / educational /
dramatic) are reproduced verbatim in
[`docs/production-workflow/TTS_BENCHMARK.md`](../../docs/production-workflow/TTS_BENCHMARK.md)
§4. Compare **same script, different voice** for character; the full
4-script set for the shortlisted voices is in `output/tts/benchmark2/mp3/`.

**Subjective quality requires human listening** — this directory exists so a
human can hear what was benchmarked before deciding which voice to keep. The
recommendations in `TTS_VOICE_COMPARISON.md` §6 are provisional until you
listen.

## Attribution (required for the model weights)

Kokoro-82M weights are **CC-BY-4.0** — using them in a published video
requires attribution:

> "Speech generated with Kokoro-82M (https://huggingface.co/hexgrad/Kokoro-82M),
> CC-BY-4.0."

The v1.0 voice set is the same CC-BY-4.0 voice collection (fetched from
`remsky/Kokoro-FastAPI` git objects; see `setup_tts.py` step 4). Piper
voices are per-voice licensed (Apache-2.0/MIT per the mirror). See
`docs/production-workflow/TTS_BENCHMARK.md` §Licensing.
