# LESSONS LEARNED — production

What each production taught the system, written so the next one does not have to rediscover it.
Newest first. Each lesson ends with **what changed in the repository** — a lesson with no change
is an opinion, not a lesson.

---

## 2026-11-09 — video-001 (*What If Every Notification Cost You 23 Minutes?*)

### L-01 · The environment is the first production stage, not a footnote
A fresh sandbox had no ffmpeg, no numpy, no canvas backend and no TTS weights. Thirty-five
minutes of the session went to rebuilding it — before a single creative decision.

**Lesson:** run the bootstrap and *prove* it (`check` → `status OK`, `setup_tts.py` → engines
READY, one smoke render) before authoring anything. Record the exact commands.
**Changed:** `KNOWN_ISSUES.md` KI-004; bootstrap block in `README.md` §2; the
`tests/production/test_environment_readiness.py` checklist.

### L-02 · Kokoro weights ship over GitHub git-blobs, not Hugging Face
The sandbox allowlist excludes huggingface.co but includes `api.github.com`. The repository
already pins `kokoro.onnx` and `voices.npz` as GitHub blob SHAs with SHA-256 verification, and
fetches 33 v1.0 voices from `remsky/Kokoro-FastAPI` the same way.

**Lesson:** when a dependency looks unreachable, check whether the repo already solved it for a
narrower allowlist before inventing a new source. 92 MB downloaded in 16 s; 44 Kokoro voices ended
up available offline.
**Changed:** nothing needed — the existing `setup_tts.py` worked as designed. Documented here so
a future session does not waste time assuming TTS is impossible.

### L-03 · Author boards speech-locked, props diegetically
Speech timings are unknown until TTS runs, because the engine retimes every scene to the audio.
Anything placed with absolute seconds (`from_t` / `to_t`) drifts when the scene stretches;
anything placed with `cue_on` lands on the spoken beat automatically.

**Lesson:** use `cue_on` for every information-bearing visual; reserve absolute-time props for
set dressing whose exact timing does not matter (a desk clock showing 9:02 reads fine whenever it
appears). This removed an entire class of sync bugs before the first render.
**Changed:** the scene table in `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` §6 states it;
`projects/video-001-.../STORYBOARD.md` applies it.

### L-04 · One number, spoken, is the strongest hook available in this niche
Research found the breakout comparable (*DOPAMINE*, 584,787 views on a 21.6K-sub channel) built on
a single visual metaphor. Our own film's hook is one number appearing in frame within eight
seconds.

**Lesson:** pick the metaphor before the script, and let every scene either advance it or break
it. If a scene does neither, cut the scene.
**Changed:** master template §3 rule 3 now requires the metaphor to be named in the prompt.

### L-05 · Validate is a gate, not a report
`run_studio.py validate` returned `"warnings": []` on the first authored spec, which is what let
the stills pass be trusted. The validator catches unknown actions, props, boards, environments and
bad portrait focus values — the exact mistakes that render silently as `idle_stand` or a missing
object.

**Lesson:** never render on a spec with warnings. The warnings are cheap; a rendered surprise is
not.
**Changed:** master template §10 rule 1; `AGENTS.md` §1.2 stage ordering.

### L-06 · Two characters is a hard ceiling — design the cast around it
The engine collides three actors at 1920. The film was written for one protagonist plus one
colleague who appears in exactly two scenes and shares a frame in one.

**Lesson:** treat the ceiling as a creative constraint, not a limitation: a second character who
appears rarely reads as an *event*, which is stronger than a permanent duo.
**Changed:** master template §4 hard-constraint line.

### L-07 · House rules need tests, not paragraphs
"No channel name anywhere" and "the polish prompt is byte-for-byte immutable" are both one-line
rules that a tired session will break. Prose does not stop that; a failing test does.

**Lesson:** every permanent house rule gets a regression test in `tests/production/` on the day it
is declared.
**Changed:** `tests/production/test_repo_hygiene.py` (repo-wide channel-name scan, polish-prompt
sha256, project-archive completeness, template existence, auto-creation wiring).

### L-08 · Evidence discipline is a format, not a mood
Every view count in `RESEARCH.md` is tagged **[M]** measured / **[O]** observed / **[P]**
predicted, and every reference claim **[V]** / **[I]** / **[A]**. That made it trivial to see that
the 166× Short-vs-long gap inside the reference channel is distribution, not proof.

**Lesson:** label evidence at capture time. Retro-labelling produces confident prose built on
guesses.
**Changed:** master template §2 requires the taxonomy; `RESEARCH.md` structure enforces it.

### L-09 · The sandbox will vanish; the archive must not
Renders and `runtime/work/` are git-ignored by design, so a finished MP4 living only in `runtime/renders/` dies with
the session.

**Lesson:** the final MP4 belongs in `projects/<slug>/final.mp4` (not ignored), alongside its
prompt, scripts, stills, audio and QA report. A project that cannot be re-rendered from its own
folder is not finished.
**Changed:** master template §11; `test_every_project_has_a_complete_archive`.

### Removed example outputs leave stale documentation references
When removing a production output, run `python3 tools/check_docs.py` and replace links with existing examples. Keep the documentation gate enabled; do not create empty placeholder directories to hide broken references.

### L-10 · Stills and drafts are not the master
A corrected still or voiced draft can look perfect while the delivered master still carries the
old geometry. Speech-locked boards are absent from TTS-less stills, and `--resume` can reuse a
retimed spec from before an edit.

**Lesson:** after any board/geometry change, extract and actually open final-master board-cue
frames. Record the measured portrait overrides in the reusable brief.
**Changed:** master template §9/§10, PC-009 / PC-010, KI-010 and the unit regression test.

### L-11 · `--resume` remembers the old film
A corrected draft is not proof that a corrected master was rendered. Resume caches contain a
retimed spec and finished chunks; both can survive an edit to the authoritative spec.

**Lesson:** tie every resume cache to the spec hash, invalidate on change, and inspect the final
master — not the draft — after any geometry correction.
**Changed:** `tools/produce_video.py`, PC-012, KI-011 and a unit regression test.
