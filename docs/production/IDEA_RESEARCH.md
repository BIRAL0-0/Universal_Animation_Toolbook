# IDEA RESEARCH — Stage 1 & Stage 3

**Status: PROCESS-STANDARD.** No research tool exists in this repository. This document is
the standard a human or agent follows; its output is a file, not a chat message.

Stage 1 (research & discovery) and Stage 3 (present & select) live here because they are one
conversational loop: research feeds a shortlist, the shortlist gets a user decision, and the
user's answer ("more ideas", "combine A and B", "different style") sends the loop back around.

Related: [`VIRAL_POTENTIAL_EVALUATION.md`](VIRAL_POTENTIAL_EVALUATION.md) (Stage 2, the
scoring rubric), [`SCRIPT_WORKFLOW.md`](SCRIPT_WORKFLOW.md) (what happens after selection).

---

## 1.1 What counts as an idea in this system

An idea that can actually be produced here is: **one story, ≤ ~2 principal on-screen
characters, tellable in 2D vector animation with the engine's action/environment/prop
library, in 40 seconds (Shorts) to several minutes (long-form).**

Before researching deep, read
[`universal_toolbook/process/08_LIMITS.md`](../../universal_toolbook/process/08_LIMITS.md) —
the engine's real capability boundary. Ideas that need crowds, 3D, real people's likenesses,
photo compositing, or a different aspect ratio will score low on production feasibility and
should be filtered early, not discovered at Stage 9.

## 1.2 Research procedure

Work in `runtime/work/ideas/` (git-ignored working area — create it with `mkdir -p runtime/work/ideas`).

1. **Frame the niche.** Write the channel's positioning in `runtime/work/ideas/README.md`:
   audience, tone, formats already used, what has and hasn't worked (ask the user for
   numbers from past uploads if they can share them).
2. **Research current signals**, using whatever legitimate sources are reachable:
   - YouTube search results and channel pages in the niche (trending titles, formats,
     view counts, upload dates).
   - Google Trends (where reachable) for topic demand and trajectory.
   - Social platforms and public discussions for emerging topics and recurring viral formats.
   - In a sandboxed agent environment: the available web search tools. If nothing is
     reachable, **say so explicitly** in the brief and mark every claim as prediction-only.
3. **Collect, then evaluate.** For each candidate idea, gather *observed evidence*
   (specific videos, view counts, dates, search signals) and keep it strictly separate from
   *interpretation* (why this suggests demand). A brief with no observations and a confident
   interpretation is a hallucination — label it that way.
4. **Score** each idea with the rubric in
   [`VIRAL_POTENTIAL_EVALUATION.md`](VIRAL_POTENTIAL_EVALUATION.md).
5. **Shortlist** the 3–5 strongest; drop the rest with a one-line reason in the brief
   (so "why wasn't X chosen?" is answerable later).

### Evidence hygiene

- Record the **date** of every observation.
- Cite concrete items (a specific video's title + channel + view count), not "people like
  this kind of content".
- Distinguish *format evidence* (this structure performs) from *topic evidence* (this topic
  has demand) — the engine produces the format; the topic is what the user must still
  believe in.
- Saturation is a first-class signal: 20 near-identical videos from the last month is
  evidence against, not for, an idea.

## 1.3 The idea brief (one file per idea)

Save each to `runtime/work/ideas/<slug>.md`:

```markdown
# <Idea title>

- **Date:** YYYY-MM-DD
- **Status:** researched | shortlisted | selected | dropped (<reason>)
- **Concept (≤ 3 sentences):**
- **Target audience:**
- **Why people might watch it:**
- **Opening hook (the first 3–8 seconds, concretely):**
- **Suggested style:** cel | parchment   (see process/01_INTAKE.md §1.1)
- **Storytelling format:** (e.g., 4-act fable, essay with proof-objects, two-character debate)
- **Estimated duration:** (e.g., 46 s vertical Short | 2:45 16:9)
- **Observed evidence:** (dated, specific; or "none — prediction only")
- **Competition / saturation:**
- **Potential weaknesses:**
- **Production feasibility vs engine limits:** (actions, environments, cast size, aspect)
- **Viral-potential score:** (table from VIRAL_POTENTIAL_EVALUATION.md)
```

The brief is the idea's **memory**. Everything later (script, style, delivery target)
derives from it; if a decision contradicts the brief, the brief gets a note, not a silent
rewrite.

## 1.4 Presenting the shortlist (Stage 3)

Present at most 5 ideas, strongest first, each as: title · one-paragraph concept · target
audience · why people might watch it · opening hook · suggested style · storytelling format ·
estimated duration · key evidence · main weakness · **score with a one-line explanation of
what drove it**.

Then state the decision options verbatim, because the user expects all of them:

1. **Select** an idea.
2. **Request more ideas** (widen research; say which angle to widen).
3. **Reject all** (reset; the agent asks what was wrong — usually a wrong niche frame).
4. **Ask for improvements** to specific ideas (loop back into research/scoring for those).
5. **Combine compatible ideas** (merge briefs into one file; re-score the hybrid).
6. **Modify the topic** (new brief, same research base where useful).
7. **Request a different animation style** (re-run the style recommendation, e.g., cel →
   parchment per the rule of thumb in
   [`universal_toolbook/process/01_INTAKE.md`](../../universal_toolbook/process/01_INTAKE.md)).

**On selection:**

```bash
mkdir -p runtime/work/<slug>
cp runtime/work/ideas/<slug>.md runtime/work/<slug>/idea.md
```

`runtime/work/<slug>/idea.md` now travels with the project through every later stage (see
[`ASSET_MANAGEMENT.md`](ASSET_MANAGEMENT.md) for the full project folder layout).

**Hard rule:** no Stage 4 work — no scripts of any length — before the selection resolves.
The brief says where the line is; an agent that starts scripting unselected ideas is
spending production time on content the user may not want.
