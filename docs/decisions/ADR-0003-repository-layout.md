# ADR-0003 — Repository reorganization and single source of truth

**Date:** 2026-11-09 · **Status:** Accepted

## Context

Before this change the repository had 263 tracked files, five competing agent-instruction
documents, two master-prompt candidates, two change logs, two start pages, two architecture maps,
three locations for distributable artifacts and several ignored scratch roots. A future agent had
no unambiguous answer to "which file is authoritative?". The baseline evidence and measured
dependency graph are in [`../architecture/BASELINE_INVENTORY.md`](../architecture/BASELINE_INVENTORY.md).

## Decision

Adopt one authoritative location per responsibility:

| Concern | Owner |
|---|---|
| Agent rules, architecture boundaries, skill activation | `AGENTS.md` |
| Permanent procedures for AI agents | `skills/` (six skills, one primary) |
| Reusable production runtime | `universal_toolbook/` (unchanged engine layout, see ADR-0002) |
| Master per-video prompt + project skeleton | `templates/` |
| Each finished video | `projects/<slug>/` |
| Technical documentation | `docs/architecture/`, `docs/getting-started/`, `docs/development/`, `docs/production/`, `docs/troubleshooting/`, `docs/decisions/` |
| Reference episode specs | `examples/` |
| Regression protection | `tests/unit/`, `tests/integration/`, `tests/regression/`, `tests/production/`, `tests/fixtures/` |
| Maintenance / QA tools | `tools/` |
| Developer entry points | `scripts/` |
| Durable finished packages and benchmark evidence | `deliverables/` |
| Temporary work, renders, previews, cache, logs | `runtime/` (git-ignored) |

Specific actions:

1. Consolidate the former operating rules, start page and kit session prompt into `AGENTS.md`;
   leave only short compatibility redirects where historical links require them.
2. Remove the kit's duplicate master prompt, second start page and repository map; migrate their
   unique creative and architectural content into the skills, the kit README and `docs/architecture/`.
3. Move the 25 detailed stage documents into `docs/production/` as the single production-detail
   location; relocate setup, environment, roadmap and decision material to their owning folders.
4. Preserve the English-only voiceover polish standard **byte-for-byte** at its new canonical path,
   with its SHA-256 guard updated and its internal relative links kept valid.
5. Unify distributable artifacts under `deliverables/`; keep historical projects, benchmark samples
   and release archives intact; remove only broken hand-off symlinks and verified unused duplicates.
6. Replace scattered ignored scratch roots with one `runtime/` tree and update CLI defaults, CI,
   docs and tools to use it.
7. Add `tools/validate_structure.py`, `tests/unit/`, `scripts/new_project.py` and
   `scripts/verify_fresh_checkout.py` so the layout is enforced, a project can be created
   deterministically, and a fresh checkout can be verified end to end.
8. Keep `tools/check_docs.py` as the single link validator, with a documented legacy alias map so
   historical project records continue to resolve without editing their prompts.

## Consequences

- Agents read one rule file, activate named skills, and follow one master prompt.
- The kit stays copyable: skills are repository-level knowledge, not runtime dependencies.
- Historical projects and benchmark evidence are relocated, not deleted.
- New documentation must use canonical paths; historical records are exempt via the alias map.
- CI and fresh-checkout simulation protect the layout against regression.

## Verification

- `python3 tools/validate_structure.py` — required paths, skills, single master prompt, project
  archives, runtime hygiene, voice defaults, no generated media in source directories, link check.
- `python3 tools/check_docs.py` — every Markdown path claim resolves.
- `python3 tools/validate_specs.py`, JS regression, Python integration, unit + production tests,
  `run_studio.py check`, silent draft render and kit-standalone validation all pass.
- `scripts/verify_fresh_checkout.py` clones the branch, installs dependencies, runs every gate and
  renders the minimal episode silently in the fresh clone.
- Before/after counts, LOC and a file-by-file migration report are recorded in the final delivery
  report and [`CHANGELOG.md`](../../CHANGELOG.md).
