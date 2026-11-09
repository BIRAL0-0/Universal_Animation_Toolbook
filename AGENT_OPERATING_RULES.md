# AGENT OPERATING RULES — the standing production contract

**Status: PERMANENT.** These rules are part of the repository, not of any one conversation.
Every session that touches this repo — including a session whose only user message is
*"Create a new video."* — is bound by them. [`START_HERE.md`](START_HERE.md) links here so the
rules load before any work begins.

The reusable machinery lives in `universal_toolbook/`. The reusable *process* lives here and in
[`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](templates/MASTER_VIDEO_PRODUCTION_PROMPT.md).
Individual productions live in [`projects/`](projects/).

---

## 1. AUTOMATIC VIDEO CREATION MODE

**Any request to create, make, generate or produce a video activates the full production workflow
below.** The user does not have to repeat the master prompt, explain the workflow, or walk the
agent through individual stages. All of these are complete authorisation:

- "Create a new video."
- "Make a stickman animation about discipline."
- "Create a video titled What Happens If You Stop Using Your Phone?"
- "Here is my script. Turn it into an animation."
- "Make another video like the previous one."
- "Find a viral topic and create a video."

### 1.1 Classify the input first

| Case | Signal | What the agent does |
|---|---|---|
| **1 — general request** | no topic given | research current topics, evaluate, select, title, script, then produce. Do not wait for the user to pick a topic unless an essential decision genuinely needs them. |
| **2 — topic or title given** | a subject or title supplied | research *that subject* and its competition, find angles, improve the title only if intent is preserved, script, produce. Never abandon their subject because another topic looks more popular. |
| **3 — complete script given** | the user's script is the source material | read it fully; check structure, flow, clarity, pacing, grammar, repetition; improve hook/transitions/conclusion where warranted; preserve meaning and facts; polish with the repository standard; save original **and** polished; then produce. Flag any change that would alter meaning instead of making it silently. |
| **4 — reference video given** | an existing video as inspiration | inspect it, analyse its craft, adopt transferable qualities, then build an **original** concept. Never copy a creator's complete video. |
| **5 — "another one"** | a repeat request | reuse the established system, saved templates, working configs and lessons. Still: fresh topic research where appropriate, a new independent project folder, a new video-specific prompt, previous files untouched, previously fixed errors not repeated. |

### 1.2 Run the stages in order, automatically

1. Input analysis · 2. topic research where appropriate · 3. fact-checking and content development ·
4. title and concept finalisation · 5. scriptwriting or polishing · 6. save original and polished
scripts · 7. **save the complete video-specific prompt before production** · 8. storyboard and scene
breakdown · 9. character and visual design · 10. asset creation · 11. animation · 12. Kokoro
voiceover · 13. music and sound effects · 14. audio/video synchronisation · 15. full MP4 render ·
16. final video inspection · 17. fix and re-render where required · 18. save all project materials ·
19. update reusable production knowledge · 20. deliver the video and the report.

Complete each stage before dependent stages begin. Independent tasks may run in parallel.
**Never skip a stage silently** — a skipped stage is recorded in `PRODUCTION_LOG.md` with a reason.

### 1.3 Decide without asking

Do not interrupt production for ordinary implementation decisions: which animation tool, how to
divide scenes, which render method, which sound effects, how to structure the storyboard, how to
configure the encoder. Make an informed decision and document it.

Ask the user **only** when an essential creative decision cannot reasonably be inferred, or when
proceeding risks changing their intended meaning.

**Format default:** the requested format if specified; otherwise YouTube Shorts vertical 9:16 for
short-form content, regular 16:9 for long-form.

### 1.4 Script quality precedes animation

Never animate an unreviewed script. Before scenes exist: check the hook, remove repetition,
improve transitions, make the narration sound natural, confirm it is understandable, check pacing
and approximate duration, verify factual statements, and give every scene a clear visual purpose.
Save `SCRIPT_ORIGINAL.md`, `SCRIPT_POLISHED.md` and `SCRIPT_CHANGELOG.md`. Polish with
[`docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md`](docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md),
**used exactly as it exists — byte-for-byte, never rewritten, replaced, weakened or removed.**

---

## 2. PER-VIDEO PROMPT ARCHIVE (permanent)

Every new video gets its own folder under `projects/`, created **before** production starts, and
containing at minimum: `PROMPT.md`, `RESEARCH.md`, `TOPIC_SELECTION.md`, `SCRIPT_ORIGINAL.md`,
`SCRIPT_POLISHED.md`, `SCRIPT_CHANGELOG.md`, `STORYBOARD.md`, `CHARACTERS.md`, `SCENE_PLAN.json`,
`VOICEOVER.md`, `ASSET_MANIFEST.json`, `PRODUCTION_LOG.md`, `QA_REPORT.md`, `episode.json`,
`final.mp4`, plus `projects/<slug>/assets/`, `projects/<slug>/audio/`, `projects/<slug>/renders/`.

- Every project starts from [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](templates/MASTER_VIDEO_PRODUCTION_PROMPT.md),
  is customised with its own research, and the finalised prompt is saved **before** production.
- Deviations from the saved prompt are recorded in `PRODUCTION_LOG.md` with reasons.
- **Old prompts are never overwritten.** New videos create new folders.
- [`tests/production/test_repo_hygiene.py`](tests/production/test_repo_hygiene.py) fails if any
  project archive is incomplete — the rule is enforced, not merely documented.

## 3. SELF-HEALING (permanent)

When anything fails — research, asset generation, animation, TTS, rendering, encoding, QA — do not
retry endlessly and do not work around it without understanding it. Record the error and stage,
find the root cause, reproduce where possible, research a reliable fix, implement it, add a
regression test or validation check, update documentation, update the master template if the
failure exposed a missing instruction, then retry the stage and verify.

Maintain and update:
[`docs/production/KNOWN_ISSUES.md`](docs/production/KNOWN_ISSUES.md),
[`docs/production/LESSONS_LEARNED.md`](docs/production/LESSONS_LEARNED.md),
[`docs/production/PIPELINE_CHANGELOG.md`](docs/production/PIPELINE_CHANGELOG.md),
[`tests/production/`](tests/production/).

Keep fixes reusable rather than hardcoded to one video. Add tests for fixed bugs. **Never claim a
failure is resolved without verification.** Never claim a visual or audio test passed if it was
not actually performed.

## 4. HOUSE CONTENT RULES

1. **No channel name in the repository.** No `channel_name` value, watermark, or channel branding
   anywhere in any file. The engine's optional watermark field stays empty / omitted.
   Enforced by `tests/production/test_repo_hygiene.py::test_no_channel_name_anywhere`.
2. **English-only narration** unless a request explicitly says otherwise.
3. **Voice priority:** Kokoro `am_michael` as the default primary narrator, `af_bella` as the
   preferred secondary, other Kokoro voices only when they genuinely suit a character, Piper only
   as fallback.
4. **Originality:** reference videos inform craft only. No copyrighted character, script, scene or
   animation is reproduced.
5. **Facts:** never describe a topic as viral on a guess. Label measured performance, observed
   trends and predictions distinctly, and keep a research log with sources and dates.
6. **Licences:** respect and record the licence and attribution of every audio asset used.

## 5. SESSION SAFETY (temporary environment)

Assume the sandbox disappears. Before ending a session: save project source, every video-specific
prompt, scripts and storyboards, generated assets, audio, final MP4s, benchmark and QA reports;
prepare a downloadable archive; and record the exact reproduction steps. Never finish with the only
copy of a deliverable trapped in temporary storage.

## 6. GIT DISCIPLINE

Work on the assigned branch. Commit meaningful milestones. Push to the assigned branch only.
Open a PR when appropriate. Run the relevant tests. Investigate failures at root cause. Check CI
when it is decision-relevant. Merge only when required checks pass and changes are verified.
