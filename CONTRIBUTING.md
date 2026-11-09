# Contributing

This repository is both a reusable production kit and a development repository. Please keep the
boundary intact: [`AGENTS.md`](AGENTS.md) defines the rules, and
[`docs/development/CODE_ORGANIZATION.md`](docs/development/CODE_ORGANIZATION.md) explains where
code belongs.

## Before you start

1. Read [`AGENTS.md`](AGENTS.md) and the skill for the area you are changing
   ([`skills/README.md`](skills/README.md)).
2. Set up the environment: [`docs/getting-started/INSTALL.md`](docs/getting-started/INSTALL.md).
3. Record the baseline: `python3 universal_toolbook/run_studio.py check`.

## Rules for changes

- **One authoritative location.** Engine changes go in `universal_toolbook/`; procedure changes go
  in `skills/`; rules go in `AGENTS.md`; technical detail goes in `docs/`; protection goes in
  `tests/`. Do not add a second copy of a prompt, config, architecture map or procedure.
- **Preserve the kit.** `universal_toolbook/` must never depend on repository-level `tools/`,
  `scripts/`, `skills/`, `tests/`, `projects/` or `docs/`. Verify a copied kit with
  `scripts/verify_fresh_checkout.py`.
- **Preserve invariants.** `am_michael` stays the default narrator; the English voiceover polish
  prompt stays byte-for-byte intact; no channel name; no generated media in source directories.
- **Document in the same change.** Code, docs, tests and `CHANGELOG.md` ship together.
- **Add regression protection.** Engine edits require a test in `tests/regression/` or
  `tests/integration/`; process edits require a check in `tests/unit/` or `tests/production/`.

## Required checks

```bash
python3 tools/validate_structure.py
python3 tools/check_docs.py
python3 tools/check_workflows.py
python3 tools/validate_specs.py
node tests/regression/run_all_tests.js
python3 tests/integration/test_studio_pipeline.py
python3 -m pytest tests/unit tests/production -q
python3 scripts/verify_fresh_checkout.py
```

See [`docs/development/TESTING.md`](docs/development/TESTING.md) for what each gate protects and
[`.github/workflows/verify.yml`](.github/workflows/verify.yml) for CI.

## Commits and pull requests

Work on the assigned branch. Commit logical milestones with descriptive messages, push only to the
assigned branch, and open a PR from it. Diagnose failing checks at root cause; never merge with a
failing required check, a broken kit, missing documentation or unverified claims.
