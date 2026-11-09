# TTS TROUBLESHOOTING

Symptoms → causes → fixes, in the order you are most likely to hit them in the
Arena sandbox. Everything here has been observed or reproduced in this
environment.

## 1. "Kokoro model files missing … Run: python3 universal_toolbook/setup_tts.py"

**Cause:** fresh sandbox — `runtime/cache/tts/kokoro.onnx` / `voices.npz` were not
persisted (or `cache/` was pruned).

**Fix:**
```bash
.venv/bin/python universal_toolbook/setup_tts.py
```
Downloads ~98 MB from github.com in ~1–2 min, SHA-256 verified.

## 2. "kokoro-onnx package is not installed"

**Cause:** fresh `.venv` (the sandbox venv is wiped between sessions).

**Fix:**
```bash
.venv/bin/pip install kokoro-onnx "piper-tts[alignment]"
# or just:
.venv/bin/python universal_toolbook/setup_tts.py
```
If the venv itself is gone:
```bash
python3 -m venv .venv && .venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
```

## 3. Edge TTS fails on every line (the normal sandbox state)

`speech.platform.bing.com` is **not reachable** from this sandbox, so
`--voice auto` (or `--voice edge`) lines fail and the chain falls through to the offline
engines. **This is expected, not a bug.** In `auto` mode Kokoro (if set up)
covers everything before Edge is even tried; in `edge` mode Piper rescues the
failed lines. If a render still ends `COMPLETE_SILENT`, Kokoro and Piper are
both missing — run `setup_tts.py`.

## 4. A model download fails / is truncated

* GitHub **release assets** (`.../releases/download/...`) redirect to
  `release-assets.githubusercontent.com`, which is blocked here. Do **not**
  try to fetch Kokoro weights from release URLs — use `setup_tts.py`, which
  fetches from git blobs on `api.github.com` (reachable) with SHA-256 pins.
* A corrupted `runtime/cache/tts/*.onnx` is detected (SHA-256 mismatch) and
  re-downloaded automatically by `setup_tts.py`.
* `huggingface.co` is blocked: no HF-based download will work in this sandbox,
  ever. (On your own machine with HF access you can drop any Kokoro ONNX
  export into `runtime/cache/tts/` and point `TTS_MODEL_DIR` at it.)

## 4a. v1.0 voices missing / `Voice af_heart not found` (or similar)

**Cause:** `runtime/cache/tts/voices-v1.0-en.npz` was not built (setup step 4
failed or was skipped), or you requested a v1.0-only voice while only the
11-voice v0.19 set is present. The subsystem still works — 11 v0.19 voices
stay available, and any missing name falls back to the default voice with a
clear `WARNING [kokoro]: voice '…' is not available … Using documented
fallback 'am_michael'` line on stderr (and `voice_fallback: true` in the
result metadata).

**Fix:**
```bash
.venv/bin/python universal_toolbook/setup_tts.py    # rebuilds step 4 (33 pinned .pt files, ~20 s)
.venv/bin/python universal_toolbook/generate_voiceover.py --voices   # 44 voices expected
```
The converter needs no PyTorch (`universal_toolbook/tools/convert_kokoro_v1_voices.py` decodes
the torch `.pt` single-tensor format with stdlib + numpy). If step 4 fails
repeatedly (e.g. the upstream repo moved), the v0.19 set is unaffected —
the failure is reported, never silent.

## 5. Generation is slower than expected

* **RTF on a 2 vCPU / 3.8 GB box is ~0.6–0.85 when idle** (Kokoro int8,
  ONNX Runtime; the original 4-voice benchmark measured 0.59–0.63, later
  sandbox re-provisions measured ~0.82 for identical audio) and degrades
  further when other CPU work runs in parallel — measure generation alone,
  or expect a 60 s narration to take ~35–90 s.
* `speed` does not change total work much; it changes output duration.
* Long text is chunked internally by `kokoro-onnx`; no change needed.
* Keep `runtime/cache/tts/` on the same disk (no network FS here anyway).

## 6. Audio quality complaints

| symptom | check / fix |
| --- | --- |
| one segment much louder/quieter than others | re-run with processing (default): `generate_voiceover.py` normalizes RMS to −16 dBFS; `validate_audio.py` shows per-file RMS |
| clicks at joins | the concatenation inserts the configured pauses (sentence 0.25 s / paragraph 0.6 s); check `voices.json → segmentation` if they feel off |
| a name/acronym mispronounced | add an entry to `universal_toolbook/tts/config/pronunciation_dictionary.json` (spoken spelling only; approved text is never changed), re-run — only affected segments' signatures change |
| clipping reported by validate | raise `limit_dbfs` headroom (e.g. −1.0) or lower `normalize_rms_dbfs` (e.g. −18) in `voices.json` |
| too much silence inside a segment | internal dead-air compaction happens in the pipeline path; for standalone jobs, `validate_audio.py --max-silence 1.0` locates it |
| voice sounds wrong for a speaker alias | `generate_voiceover.py --voices` prints the alias map; aliases live in `voices.json → engines.<name>.aliases` |
| fallback voice is faster/slower than the one requested | that is the voice's natural pace (Piper ryan is noticeably faster than the Kokoro defaults — see `TTS_VOICE_COMPARISON.md`). `speed` adjusts it (Kokoro 0.5–2.0; Piper via `length_scale = 1 ÷ speed`), but by policy we do not slow a fallback voice to imitate the primary — pick a voice that fits the genre instead |

## 7. Resume / manifest problems

* **"duration … deviates from expected"** on re-run: the segment was generated
  with different text/settings. Fix the input (or use `--force` for a clean
  start) — the stale file is then regenerated.
* **Changing the pronunciation dictionary** invalidates segments whose spoken
  text changed (signature mismatch) — they regenerate automatically; others
  are kept.
* **Manifest says `failed` for a segment:** the error string is stored on the
  segment (`manifest.json → segments[].error`). Re-run the same command — only
  failed segments regenerate.
* **Want a completely fresh job:** `--force` (or use a new `--out` directory).

## 8. `run_studio.py render` gives `COMPLETE_SILENT` (exit 3)

Order of diagnosis (mirrors `_voice_diagnosis`):
1. `kokoro_ready` false? → `setup_tts.py`.
2. `edge_tts` missing? → `pip install -r universal_toolbook/requirements.txt`
   (moot in the sandbox — Edge is unreachable anyway).
3. Piper voices missing? → `setup_tts.py` (step 4).
4. All of the above true but still silent? check the render log's
   `voice_backend` field — it names the backend that actually produced audio
   (e.g. `kokoro-offline:am_michael`). If it says `text-led`, synthesis threw;
   run one line manually to see the error:
   ```bash
   echo "Test line." > /tmp/t.txt && .venv/bin/python universal_toolbook/generate_voiceover.py --input /tmp/t.txt --out /tmp/tts_test
   ```
   For a deliberately silent draft use `--allow-silent` or `--voice none`.

## 9. Memory / resource alarms

* Kokoro int8 peaks around **0.7 GB RAM** — fine on the 3.8 GB sandbox, but
  avoid running the video renderer and TTS generation at the same time on this
  box.
* Disk: weights 98 MB + Piper ~126 MB + audio jobs (a minute of narration ≈
  4 MB WAV / 1.5 MB MP3). `runtime/renders/` is where jobs accumulate; prune old jobs
  if disk gets tight (keep what you still need — nothing is auto-deleted).

## 10. "I re-provisioned the sandbox and nothing works"

Everything is rebuildable with two commands:
```bash
python3 -m venv .venv && .venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
.venv/bin/python universal_toolbook/setup_tts.py
```
Generated audio from previous sessions is gone unless you downloaded the
workspace; re-run your `generate_voiceover.py` command (or restore the
downloaded folder — manifests make it resumable).
