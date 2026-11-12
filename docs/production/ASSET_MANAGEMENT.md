# ASSET MANAGEMENT — the lifecycle of everything a production touches

**Status: IMPLEMENTED conventions** (folder rules from
[`docs/architecture/SYSTEM_OVERVIEW.md`](../../docs/architecture/SYSTEM_OVERVIEW.md) and
[`deliverables/RESULTS.md`](../../deliverables/RESULTS.md)) **extended with the working-area conventions
for Stages 1–7** (`runtime/work/` layout), which are new in this documentation set and are the
standard from today forward.

The single identity rule: **one film = one slug = one project folder.** Every asset of a
film is reachable from `runtime/work/<slug>/` (working life) or `deliverables/<film>/` (durable life)
without asking anyone.

---

## 1. The two halves of storage

| Half | What | In git? |
| --- | --- | --- |
| **Working area** — `runtime/work/` (and `runtime/work/ideas/`) | Everything mid-production: briefs, scripts, skeletons, the episode spec, stills, drafts | **No** — git-ignored on purpose. Regenerable or personal. |
| **Durable area** — `deliverables/<film>/` | The result: master (only if < ~50 MB) + the full text set (chapters, reports, validation, cues, storyboard, NOTES.md, and now `publishing.md`) | **Yes** — the durable channel for results. Rules: [`deliverables/RESULTS.md`](../../deliverables/RESULTS.md) |
| **Build area** — `runtime/renders/` and `runtime/renders/.work_<stem>/` | Renders, chunks, voice cache, mixed audio | **No** — build artifacts; `runtime/renders/` is git-ignored, `.work_*` directories are deleted/rebuilt |
| **Kit** — `universal_toolbook/` | Engine, fonts, bundled BGM, template, process docs | **Yes** — the self-contained production kit |

Never commit renders, stills, voice WAVs, or chunk files. Large media that must survive a
transfer goes to the `deliverables/the_wall_you_agreed_with/` page (symlinked into `deliverables/`) or is served
(`python3 tools/serve_downloads.py`), not committed.

## 2. Project folder layout (the standard)

```
runtime/work/
  ideas/
    README.md                 niche framing (audience, formats, what worked)
    <slug>.md                 one brief per researched idea (IDEA_RESEARCH template)
  <slug>/
    idea.md                   the selected brief — the project's memory
    decisions.md              every user decision + approval, timestamped (selection,
                              sample choice, narration approval, QC sign-off, publish)
    samples/
      sample_1_<approach>.md  Stage 4 previews
    script_v1.md              Stage 5 complete script (or the user's verbatim text)
    script_polished.md        Stage 6 TTS-ready narration (what the engine speaks)
    skeleton.json             optional script_helper.py parse output
    episode.json              the authored spec (what the engine renders)
    stills_16x9/  stills_9x16/  full-resolution QA stills
    (drafts: /tmp/draft/*.mp4 — scratch; only the master is a deliverable)

runtime/renders/                        (git-ignored; build artifacts)
  <slug>_master_16x9.mp4       the master (+ _chapters/_report/_validation/_cues sidecars)
  .work_<stem>/                voice cache, retimed timeline, chunks, master_audio.wav

deliverables/<film>/                (committed; the durable result)
  the_<film>_<aspect>.mp4      master mirror, only if < ~50 MB
  chapters.txt  report.json  validation.json  cues.json
  storyboard.svg               optional
  publishing.md                Stage 13 kit (title/description/tags/chapters plan)
  NOTES.md                     master path, bytes, sha256, exact rebuild command,
                               voice_backend actually used
  script.md                    per-scene text (the films in this repo do this — keep it)
  stills/S01.jpg …             optional, for a project that retains stills
```

**Slug rules.** Lowercase, underscores, stable for the life of the project
(`the_staircase`, `the_wall_you_agreed_with`). The film folder under `deliverables/` uses the
same slug (or its display name as in existing folders — `deliverables/RESULTS.md` governs).
Master filenames carry the aspect: `…_16x9` / `…_9x16` (or `1080x1920` as the newer
convention does).

## 3. Asset lifecycle, stage by stage

| Asset | Created at | Lives at | Retired when |
| --- | --- | --- | --- |
| Research briefs | Stage 1 | `runtime/work/ideas/<slug>.md` | dropped ideas: one-line reason in-file, file kept (evidence of why) |
| Selected idea | Stage 3 | `runtime/work/<slug>/idea.md` | never (it is the project memory; copied into `deliverables/<film>/` context if the user wants it archived) |
| Sample scripts | Stage 4 | `runtime/work/<slug>/samples/` | after direction chosen (kept — they're cheap and show the decision path) |
| Complete script | Stage 5 | `runtime/work/<slug>/script_v1.md` | never for the life of the project (verbatim projects: this is the legal baseline) |
| Polished script | Stage 6 | `runtime/work/<slug>/script_polished.md` | superseded only by a re-approved version (version it: `script_polished_v2.md`, note in `decisions.md`) |
| Episode spec | Stage 9 | `runtime/work/<slug>/episode.json` | the render that ships is the truth; a shipping spec is copied into `deliverables/<film>/episode.json` when the user wants reproducibility (see `examples/the_staircase_episode.json` for an authored example) |
| QA stills | Stage 9 | `runtime/work/<slug>/stills_*/` | any time after master passes QC |
| Draft MP4s | Stage 9 | scratch in tmp (never committed) | session end |
| Voice WAVs (per line) | Stage 8 | `runtime/renders/.work_<stem>/vo_cache/` | with the work dir — but **reused across re-renders** (the cost-avoidance cache) |
| Retimed timeline + manifest | Stage 10 | `runtime/renders/.work_<stem>/` | with the work dir (regenerated from the voice cache in seconds) |
| Mixed audio | Stage 11 | `runtime/renders/.work_<stem>/master_audio.wav` | measured at QC, then with the work dir |
| Chunks / silent master | Stage 11 | `runtime/renders/.work_<stem>/` | with the work dir |
| Master + sidecars | Stage 11 | `runtime/renders/` | promoted to `deliverables/<film>/` at delivery; the `runtime/renders/` copy may then be deleted |
| Poster | Stage 13 | `deliverables/<film>/` (or `deliverables/the_wall_you_agreed_with/`) | never (it's the thumbnail) |
| Publishing kit | Stage 13 | `deliverables/<film>/publishing.md` | updated after publish with the final used values |

## 4. "Image asset" categories — what applies and what does not

This pipeline has **no generated image or video assets** — the engine draws everything, so
the classic asset categories map like this:

| Classic category | Here |
| --- | --- |
| Character reference images | The `cast` block of `episode.json` **is** the character reference (one definition, all scenes). There is no reference-image generation; a *reference sheet render* is a roadmap item (F6). |
| Background images | `environment` presets / parametric `setting` — code, not files. |
| Generated animation clips | Chunks in `runtime/renders/.work_<stem>/chunks_WxH/` (intermediate MP4 slices, not per-scene clips). |
| Sound-effect files | None on disk — foley is synthesized at mix time from the compiled scene events (list: `*_visual_audio_cues.json`). |
| Background music files | Bundled CC tracks in `universal_toolbook/assets/bgm/` (catalog: `BGM_CATALOG.json`, licenses: `CREATIVE_COMMONS_LICENSES.md`); user-supplied tracks by absolute path via `--bgm`. |
| Subtitle files | Burned into the master (no separate file); an SRT export is a roadmap item (F4). |

## 5. Versioning, cleanup, recovery

- **Masters are never overwritten** (standing rule from `README.md`): a new render that
  replaces a shipped master gets a new filename, and the change is stated.
- **Reports are never hand-edited** — copied verbatim from render output; `NOTES.md` records
  sha256 so integrity is checkable.
- **Recovery of a lost render:** every shipped film's `NOTES.md` contains the exact rebuild
  command and the spec it came from; rebuilding is the designed recovery path
  (~8 MB per 2 min at crf 24 — cheap).
- **Recovery of a lost working state:** `runtime/work/` is not in git. `decisions.md` is the
  project's auditable memory — if a `runtime/work/` folder is missing, `decisions.md` (and, once
  shipped, `deliverables/<film>/`) tells you exactly which stage to resume at
  ([`COMPLETE_WORKFLOW.md`](COMPLETE_WORKFLOW.md) resume table).
- **Cleanup:** scratch goes to `/tmp`; `runtime/renders/.work_<stem>/` is deleted when a project's
  master is shipped and accepted (or kept if re-voicing/re-rendering is likely — it is the
  cheap path); `runtime/work/<slug>/stills_*` and the tmp draft files die with the project.

## 6. Avoiding unnecessary regeneration (and wasted spend)

1. **Voice cache first.** `sha1(voice|rate|pitch|text)` keys mean unchanged lines never
   re-synthesize. Reuse the output *stem* when re-rendering the same film (the cache is
   per-work-dir) — see [`VOICE_GENERATION.md`](VOICE_GENERATION.md) §8.4 for the exact
   keep/delete procedure.
2. **Stills before drafts, drafts before masters.** The 90 % of visual bugs that exist are
   visible in 2-second stills renders.
3. **`--resume` on every master command.** Interrupted or repeated encodes reuse chunks.
4. **Edit the spec, not the render.** There is no post step; a "quick fix" is always
   spec → validate → stills → (draft) → master.
5. **Approve before you burn.** The Stage 6 narration approval exists precisely so the
   expensive stages run once on final text.
6. **`--max-chunks` for long films** to bound a session, finishing later with the same
   `--resume` command.
