# Lean Repository Policy — Publishing Packages & Permanent History

> Supersedes the 2026-11-09 lean policy in two places: a completed video is now a **complete
> publishing package**, not an anonymous `final.mp4`, and the **final approved `script.md` is
> retained permanently**. See `CHANGELOG.md` v4.2.0.

## 1. Authoritative Video Location

`videos/` contains completed, approved, publishable videos. Every video is one folder:

```
videos/
└── the-cost-of-doing-nothing/
    ├── the-cost-of-doing-nothing.mp4   # filename == directory slug
    ├── script.md                        # final approved script (permanent)
    ├── thumbnail.jpg                    # designed thumbnail, not a frame grab
    └── record.json                      # title, description, pinned comment, metadata
```

Plus the catalog `videos/index.json`.

**Naming rules**

- Lowercase, hyphen-separated words, descriptive but short (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- The MP4 filename **must** match the directory slug: `videos/<slug>/<slug>.mp4`.
- Never `final.mp4`, `output.mp4`, `video1.mp4`, `movie.mp4`, `temp.mp4`.
- Never misleading clickbait in the filename. The real YouTube title lives in `record.json`
  because title and filename do not have to match.

## 2. The Five Permanent Artifacts

Permanently retain, for every completed video:

1. **Final MP4** — `<slug>.mp4`
2. **Final approved `script.md`** — title, polished narration, scene divisions, dialogue
3. **`thumbnail.jpg`** — 1280×720 (16:9 long-form) or 1080×1920 (9:16 Shorts), < 2 MB
4. **`record.json`** — YouTube title, full description, pinned comment, format, aspect, resolution,
   duration, topic, summary, key angle, tags, fingerprint, production version
5. **The `videos/index.json` entry** — compact, one per video, used for duplicate detection

Do **not** permanently retain intermediate renders, temporary thumbnails, prompt variations,
research transcripts, temporary audio, or reproducible assets. Keep reusable knowledge and skills
in their shared permanent locations (`skills/`, `docs/`, `templates/`).

Guiding principle: **every video must be a complete, identifiable, searchable, publishable creative
asset — not an anonymous MP4 file.**

## 3. Temporary Production Workspace

- `runtime/` is Git-ignored: `jobs/current-job/`, `cache/`, `temp/`, thumbnail scratch art.
- Authoring evidence (`PROMPT.md`, `RESEARCH.md`, `SCRIPT_ORIGINAL.md`, `QA_REPORT.md`, …) may live
  in `projects/<slug>/` while a video is in production. Only the five artifacts above graduate into
  `videos/`.

## 4. Publishing Metadata Standard

`record.json` required keys: `id`, `slug`, `title`, `filename`, `script`, `thumbnail`,
`youtube_description`, `pinned_comment`, `format`, `aspect_ratio`, `resolution`,
`duration_seconds`, `created_at`, `topic`, `summary`, `key_angle`, `tags`, `production_version`,
`content_fingerprint`. The full description and the pinned comment live **in the JSON**, never only
in a temporary text file.

## 5. Duplicate Prevention

- Consult `videos/index.json` **before** starting a new video.
- Compare title, topic, premise, summary and key narrative angle.
- Use `universal_toolbook/config/duplicate_detection.py` (`check_duplicate` now also compares
  `key_angle`; `allow_remake=` exists for an explicitly requested sequel or remake).
- Never index an unverified video.

## 6. Cleanup & Delivery Procedure

After a video passes its production gates:

1. Move the master to `videos/<slug>/<slug>.mp4`.
2. Save the final approved script as `script.md`.
3. Save the inspected, resized thumbnail as `thumbnail.jpg`.
4. Write `record.json` (title, full description, pinned comment, metadata).
5. Add the compact entry to `videos/index.json`, including the content fingerprint.
6. Run `python3 tools/validate_publishing.py` — it must print `PASS`.
7. Delete temporary files in `runtime/`.
8. Extract reusable lessons into `skills/` or `docs/`.
9. Report the final package path and the validation result.

## 7. Other Permanent Locations

- Production engine source (`universal_toolbook/`)
- Agent skills (`skills/`)
- Master templates (`templates/`)
- Documentation (`docs/`)
- Tests (`tests/`)
- Tools (`tools/`)
