# Lean Repository Policy — Centralized Video Outputs & Permanent History

## 1. Authoritative Video Location
- `videos/` contains completed, approved video productions.
- Each video folder contains `final.mp4` and `record.json`.
- `videos/index.json` is the authoritative catalog.

## 2. Temporary Production Workspace
- `runtime/` is Git-ignored.
- Contains `jobs/current-job/` (research, script, storyboard, assets, audio, scenes, renders, previews, logs).
- Contains `cache/` and `temp/`.

## 3. Permanent Retention
- Production engine source code (`universal_toolbook/`)
- Agent skills (`skills/`)
- Master templates (`templates/`)
- Final videos and records (`videos/`)
- Documentation (`docs/`)
- Tests (`tests/`)
- Tools (`tools/`)

## 4. Duplicate Prevention
- Consult `videos/index.json` before creating new videos.
- Check title, topic, summary, fingerprint, and tags.
- Use `universal_toolbook/config/duplicate_detection.py`.

## 5. Cleanup Procedure
- After successful delivery:
  1. Copy final MP4 to `videos/video-XXX/final.mp4`
  2. Create `record.json`
  3. Update `videos/index.json`
  4. Delete temporary files in `runtime/`
  5. Extract reusable lessons to `skills/` or `docs/`
  6. Report final location and cleanup result

