# VOICEOVER — The First Plank

| Speaker | Engine | Voice | Rate | Pitch | Role |
|---|---|---|---|---|---|
| narrator | Kokoro | `am_michael` | +1% | −1 Hz | repository PRIMARY default; all spoken lines |

- `af_bella` is the preferred secondary voice, but this fable has exactly one speaking role and
  one silent on-screen actor, so no secondary voice is used.
- Piper is fallback only; `--voice auto` is the render mode. The default narrator is not changed.
- The polished script in `SCRIPT_POLISHED.md` is copied verbatim into `episode.json`.
- **Backend actually reported by the render:** `kokoro-offline:am_michael` in
  `renders/draft_9x16_report.json`, `final_report.json` and
  `renders/final_16x9_report.json`. All three reports say `voiced: true`, `warnings: []`.
- **Subjective listening:** no claim of listening is made in this project. Audio QA uses the
  measured mixed WAV, report fields and full decode only.
