# TTS benchmark samples (committed)

Representative **real outputs** from the 2026-11-03 benchmark — the same audio the
pipeline would generate. Full results and all 24 raw WAVs are in
`output/tts/benchmark/` (git-ignored; re-run the benchmark to regenerate).

| File | Engine / voice | Script |
| --- | --- | --- |
| `kokoro_af_bella_conversational.mp3` | Kokoro-82M `af_bella` (female, bright) | conversational |
| `kokoro_af_bella_dramatic.mp3` | Kokoro-82M `af_bella` | dramatic |
| `kokoro_af_bella_educational.mp3` | Kokoro-82M `af_bella` | educational |
| `kokoro_af_bella_energetic_youtube.mp3` | Kokoro-82M `af_bella` | energetic YouTube |
| `kokoro_am_michael_energetic_youtube.mp3` | Kokoro-82M `am_michael` (male, warm) | energetic YouTube |
| `piper_en_US-ryan-medium_conversational.mp3` | Piper `en_US-ryan-medium` (male, US) | conversational (comparison) |

The benchmark scripts' full text is embedded in
[`docs/production-workflow/TTS_BENCHMARK.md`](../../docs/production-workflow/TTS_BENCHMARK.md).

**These are raw engine outputs** (24 kHz Kokoro / 22 kHz Piper, 16-bit). The
production path adds resample → RMS −16 dBFS normalize → soft peak limit
(`generate_voiceover.py` does this by default) — so production audio will be at a
consistent loudness across voices even though the raw levels here differ.

**Subjective quality requires human listening.** This directory exists so a human
can actually hear what was benchmarked before deciding which voice to keep.

## Attribution (required for the model weights)

Kokoro-82M weights are **CC-BY-4.0** — using them in a published video requires
attribution:

> "Speech generated with Kokoro-82M (https://huggingface.co/hexgrad/Kokoro-82M),
> CC-BY-4.0."

See `docs/production-workflow/TTS_BENCHMARK.md` §Licensing for the full list.
