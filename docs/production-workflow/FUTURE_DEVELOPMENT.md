# FUTURE DEVELOPMENT — roadmap

**Status: PLANNED.** Nothing on this page exists. Items are labeled with the roadmap id
(`F#`) that other documents cross-reference. Priorities weigh **usefulness** (does it
unblock or de-risk the pipeline?), **feasibility** (with the current architecture?),
**cost** (build + maintenance), and **dependencies** (what must exist first).

Ground rules for evaluating new ideas against this list:

- Do not present a speculative feature as an existing capability anywhere in the docs.
- An item graduates to **IMPLEMENTED** only when its code, tests, and doc updates land in
  the same PR — and the graduation is recorded in [`WORKFLOW_CHANGELOG.md`](WORKFLOW_CHANGELOG.md).
- Every item names what it would replace in the current PROCESS-STANDARD flow, so the
  human procedure remains the fallback.

---

## P0 — small, high value, no dependencies

| ID | Item | What it is | What implementation requires | Replaces / improves |
| --- | --- | --- | --- | --- |
| **F4** | **SRT/VTT caption export** | A an export_captions.py CLI (`<work_dir>` in, a caption file out) built from the word timings already in `episode_retimed.json` / `vo_manifest.json` | ~150 lines; the timing data exists today; unit-test against a rendered film's manifest | Gives YouTube real caption files (accessibility + search) instead of burned-in-only subs. Stage 13 kit gains a `captions.srt` line |

## P1 — meaningful production upgrades

| ID | Item | What it is | What implementation requires | Dependencies |
| --- | --- | --- | --- | --- |
| **F17** | **Idea scoring tool** | a score_idea.py CLI taking a brief file parses the rubric table and computes/validates the weighted total | Encode the weights from `VIRAL_POTENTIAL_EVALUATION.md`; markdown table parse; test fixtures | None (rubric is already the standard) |
| **F15** | **Production cost estimator** | an estimate_cost.py CLI over a compiled spec → TTS line count × avg words, render-time estimate from the measured table, disk | ~100 lines over `compileEpisode` output | None |
| **F16** | **Script skeleton, full** | Extend `universal_toolbook/tools/script_helper.py parse` from the narration-skeleton (generic cast/setting, `scene.narration`) to a *dialogue-shaped* skeleton: suggested speaker splits, `dialogue[]` entries, per-scene `pause_after`, real `voices` draft | Larger; needs the intake rules (2.5 w/s budget, 46-char lines) encoded | Stage 5 authoring speed; still human/agent-authored, not generated |
| **F6** | **Character reference sheet** | a make_reference_sheet.py CLI over an episode spec renders every `cast` entry standing/posing on one canvas — the "character reference image" this pipeline lacks | Reuses `character_rig.js` drawing; new render mode | Stage 9 design review; catches clone-cast early |
| **F5** | **Thumbnail pipeline (1280×720)** | `tools/make_poster.js --thumbnail` mode: small-size title layout, ≤ 2 MB check, side-by-side A/B candidates from real frames | Extension of existing tool (already draws from real frames) | Stage 13 kit gains a ready thumbnail |
| **F7** | **Stage-level production state** | A `work/<slug>/state.json` written by the agent at each stage completion (stage, inputs, outputs, approvals) — machine-readable resume | Convention + small helper; no engine change | Makes the resume table in `COMPLETE_WORKFLOW.md` checkable instead of eyeballed |
| **F8** | **Production history ledger** | Append-only ledger JSONL under outputs/ (one line per film): one line per shipped film (slug, date, spec commit, voice_backend, duration, size, sha256) | Tiny; derived from existing `NOTES.md` data | Channel-level memory for Stage 1/2 research ("what did we ship, what worked") |
| **F3** | **YouTube publish automation** | Optional a youtube_publish.py CLI behind an explicit per-video approval token: OAuth client, upload + metadata call, dry-run mode, credentials outside the repo | OAuth setup + credential storage policy + a hard "no approval token → refuse" gate; the ASK-FIRST rule in `SESSION_PROMPT.md` stays the law | Stage 13 upload step; **human upload remains the default** |

## P2 — larger or lower urgency

| ID | Item | What it is | What implementation requires |
| --- | --- | --- | --- |
| **F1** | **Analytics feedback loop** | Read back views/retention per video, append to the film folder + ledger, feed Stage 1/2 research | YouTube Analytics API (after F3 exists) or manual CSV import first (cheaper, no API) |
| **F2** | **Trend research assistant** | a research.py CLI that queries whatever research sources are reachable (YouTube search, trends) and drafts the evidence section of briefs | Source access is the real dependency (network, APIs); design it to degrade to "no sources reachable — prediction only" |
| **F10** | **Aspect set: 1:1 / 4:5** | New crop profiles in `portrait_framing.js` + CLI choices + safe-area tables | Renderer work + new geometry tests; Instagram/TikTok deliverables |
| **F9** | **More voices / other languages** | More voices in the alias maps (Kokoro ships 11; Piper mirror has more) and a non-English pipeline | Voice fetch + alias-map changes + a non-English test film; engine text is English-centric today. Kokoro's weight set also has multilingual exports (e.g. the v1.1-zh model) that would need a vocab/phonemizer change. |
| **F11** | **4K masters** | `--aspect-ratio 16:9 --scale 2` style flag through the chunk renderer | Renderer/encode budget work; 4× pixels, linear time cost |
| **F12** | **Phoneme-level lip sync** | Real visemes from the TTS phoneme stream where the backend exposes it | Voice-engine work. Piper now exposes per-phoneme alignments (via `piper-tts[alignment]`; the TTS subsystem already derives word timings from them) — the gap is mapping phonemes to visemes in `voice_engine.py`. Kokoro's int8 export has **no** phoneme/duration output (re-exporting the model with the kokoro-onnx exporter would add it). Quality bar: it must beat amplitude sync in side-by-side review. |
| **F13** | **SFX library** | Drop-in audio files for foley cues instead of synthesized ones (with per-cue selection in `episode.json`) | `audio_mixer.py` + a catalog + licensing docs |
| **F14** | **Batch generation** | Render a queue of episode specs (e.g., a season) with per-item reports and a stop-on-gate | Orchestrator over the existing CLI; resume per item |

## Explicitly out of scope (recorded so the question stops recurring)

- Neural video/image *generation* as the animation engine — the deterministic renderer is
  the product; its consistency and reproducibility are the point.
- Voice cloning of specific real people (engine + policy limit — `08_LIMITS.md`).
- A general "AI writes the channel" autopilot — the human approval gates (Stages 3, 4/6,
  12, 13) are load-bearing and stay human.
