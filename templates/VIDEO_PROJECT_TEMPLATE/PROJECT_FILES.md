# Project archive checklist — authoritative

Every folder under [`projects/`](../../projects/) is an independent, never-overwritten production.
`scripts/new_project.py` creates this structure; `tests/production/test_repo_hygiene.py` enforces
the required files; `tools/validate_structure.py` checks the whole repository.

```
projects/<slug>/
├── PROMPT.md             # customised copy of templates/MASTER_VIDEO_PRODUCTION_PROMPT.md — saved FIRST
├── RESEARCH.md           # sources, dates, [M]/[O]/[P] labels, confidence table
├── TOPIC_SELECTION.md    # chosen topic, rejected alternatives, rubric score
├── SCRIPT_ORIGINAL.md    # exact input script (verbatim when supplied)
├── SCRIPT_POLISHED.md    # TTS-ready narration, polished byte-for-byte with the immutable standard
├── SCRIPT_CHANGELOG.md   # per change: line touched + rule that justified it
├── STORYBOARD.md         # per-scene objective, action, camera, board, narration, SFX, transition
├── CHARACTERS.md         # mirrors episode.json `cast` exactly
├── SCENE_PLAN.json       # derived from episode.json by tools/make_scene_plan.py
├── ASSET_MANIFEST.json   # assets, licences, attribution
├── VOICEOVER.md          # voices, engine, rate/pitch, backend actually used
├── PRODUCTION_LOG.md     # ordered stage records, deviations, failures and fixes
├── QA_REPORT.md          # measured gates, inspected frame paths, sign-off, limitations
├── episode.json          # single source of truth for scenes (no channel_name key)
├── final.mp4             # delivered master (created by render)
├── assets/               # per-video stills and QA frames
├── audio/                # mixed master WAV / per-video audio
└── renders/              # drafts and secondary masters
```

## Rules

1. Create the folder and save `PROMPT.md` **before** any scene, asset or audio work.
2. `episode.json` is authoritative for what is on screen. Derive `SCENE_PLAN.json`; never maintain
   two hand-written scene plans.
3. `CHARACTERS.md` mirrors `cast`; do not maintain a competing character design.
4. Record every deviation from the saved prompt in `PRODUCTION_LOG.md`.
5. Reports contain only numbers produced by files from this run. Never claim an unperformed check.
6. Old projects and their prompts are never overwritten. New videos get new folders.
7. Generated scratch does not belong here: use `runtime/` for temporary work; this folder keeps
   the project's own durable evidence and final deliverables.
