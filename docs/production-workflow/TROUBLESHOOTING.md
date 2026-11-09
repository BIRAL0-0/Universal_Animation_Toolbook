# TROUBLESHOOTING — production-wide triage

**Status: IMPLEMENTED + extended.** This page routes a symptom to the right stage and the
right fix. **Engine-level** failures (render, encode, voice backend, visual, audio,
tooling/environment) are documented in depth — with every entry hit in practice — in
[`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md).
Do not duplicate them here; this page adds the *pipeline-level* triage and the
non-engine stages the process doc cannot cover.

## 0. First questions (always, in order)

1. **Which stage produced this symptom?** (idea/script → Stage 1–6; spec/frames → Stage 9;
   audio → 8/10; encode/reports → 11; review → 12; delivery → 13)
2. **Is there a file that proves it?** Reports (`*_report.json`,
   `*_validation_report.json`, `vo_manifest.json`), measured audio, decoded frames. Fix
   what a file proves; investigate what only a person claims.
3. **Read the report before the console.** `status`, `voiced`, `warnings`, `voice_backend`,
   `voice_diagnosis` in `<stem>_report.json` answer most questions.

## 1. Master symptom table

### Pipeline (Stages 1–7) — PROCESS-STANDARD stages

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "The idea scored high but we can't animate it" | Feasibility scored against the wrong engine (or not scored at all) | Re-score criterion 10 against `universal_toolbook/process/08_LIMITS.md`; name the change or mark out of scope |
| Verbatim script fails `validate --script` after polish | Polish changed *words*, not just punctuation | Restore the word stream; punctuation-only changes are the verbatim mode's allowance (see `SCRIPT_WORKFLOW.md` §Stage 6); word-level TTS changes need explicit user approval recorded in `decisions.md` |
| Film came out far shorter/longer than planned | Script padded or dense relative to the words÷2.5 budget | Fix in the *script* (Stage 5), never by pushing voice rate past the documented range |
| A line reads with a weird pause | Ellipsis or fragment in the polished script | Re-apply the polish prompt (punctuation *is* the timing design); the compactor keeps ellipsis pauses deliberately |
| Two characters sound the same | One model in `voice_backend` | Assign distinct voices/rates; mix accents (`VOICE_GENERATION.md` §8.2) |
| A sentence is simply missing from the audio | Line failed all TTS backends (the quiet case) | Check `vo_manifest.json` interval count vs dialogue count; fix network/backend, drop stale chunks, re-render (`VOICE_GENERATION.md` §8.5) |

### Engine (Stages 8–11)

→ [`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md).
Index of the entries there, for routing:

| Area | Entries |
| --- | --- |
| Render/encode | Edge unreachable on line one; silent master (exit 3); re-render mixes old+new frames; render slower than estimated; chunk-log duration confusion |
| Visual | flat-blue/no-face characters; floating squat; clipped subtitles; board never appears / appears too late / empty panel / collides; missing prop; dark empty stage; identical characters |
| Audio | same voice twice; clipped words; BGM drowns narration; `volumedetect` prints nothing |
| Tooling/env | PEP 668 pip; `@napi-rs/canvas` toBuffer; `validate --help` traceback; delivery to a viewer that can't download |

### QC & publishing (Stages 12–13)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Validation report `valid: true` but a frame is obviously wrong | The report proves structure, not taste | That's what the human frame review is for (`QUALITY_CONTROL.md` §12.2); fix in `episode.json` |
| Chapters timestamps don't match the audio you hear | Hand-edited chapters file | Regenerate from the render (the file is generated, never hand-written) |
| Viewer/preview can't play or download the MP4 | Raw `http.server` has no Range support; viewer blocks video | `tools/serve_downloads.py` (Range-capable) → `run_studio.py player` → SVG storyboard → text set + rebuild command, in that order |
| Download page serves a 404 for the master | Broken symlink in `downloads/` | Symlinks point into `outputs/`; restore the master mirror first (`outputs/README.md`), then re-check the link |
| Thumbnail looks nothing like the film | Poster not regenerated from the shipped master | Re-grab the hero frame from the *final* master (`ffmpeg -ss <t>`) and re-run `make_poster.js` |
| CI docs job fails after a docs change | A quoted path no longer resolves | `python3 tools/check_docs.py` locally; fix the path (docs are executable claims — a broken path means a reader will improvise) |
| CI specs job fails | An `examples/` spec or the template now warns | `python3 tools/validate_specs.py`; fix the spec (or the engine change that broke it) |
| "Docs are out of date" | A change shipped without its doc update | That's the maintenance rule's failure — apply it retroactively *and* log the gap in `WORKFLOW_CHANGELOG.md` |

## 2. Recovery procedures (the three that matter most)

**Interrupted render.**
Re-run the exact same command with `--resume`. Voice artifacts are skipped if present;
finished chunks are reused. If you edited the spec meanwhile, see next.

**Spec changed after a partial render.**
`rm output/.work_<stem>/episode_retimed.json output/.work_<stem>/vo_manifest.json`
(keep `vo_cache`), `rm -rf output/.work_<stem>/chunks_*`, re-run the same command with
`--resume`. Unchanged lines re-use the voice cache; nothing else does.

**Shipped film needs a change.**
New master = new filename (never overwrite). Edit spec → validate → stills → draft →
master → QC → promote to `outputs/<film>/` with an updated `NOTES.md` (new sha256, new
rebuild command). Record the change in `work/<slug>/decisions.md`.

## 3. What is NOT recoverable in this pipeline

- Post-hoc audio edits (no post step — re-render).
- A frame drawn with a broken engine state (re-render after fixing the engine; run the
  test suite first).
- Voice identity across *different* backends (Edge voice ≠ its Piper alias — expect the
  fallback voice to sound different from the cloud one; pick deliberately with
  `--voice piper` when identity matters more than quality).
