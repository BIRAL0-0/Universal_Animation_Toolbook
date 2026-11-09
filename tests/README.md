# Tests

Run the full local gate from the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r universal_toolbook/requirements.txt pytest pyyaml
npm install --prefix universal_toolbook --no-audit --no-fund
.venv/bin/python universal_toolbook/run_studio.py check
python3 tools/validate_structure.py
python3 tools/check_docs.py --verbose
python3 tools/check_workflows.py
python3 tools/validate_specs.py
node tests/regression/run_all_tests.js
python3 tests/integration/test_studio_pipeline.py
.venv/bin/python -m pytest tests/production tests/unit -q
python3 scripts/verify_fresh_checkout.py
```

CI runs the equivalent checks in [`.github/workflows/verify.yml`](../.github/workflows/verify.yml);
it installs dependencies on GitHub-hosted runners, so no local `.venv` is needed there.

| Directory | Responsibility | Invocation |
|---|---|---|
| [`unit/`](unit/) | repository shape, skill activation references, generated-file and duplicate-prompt invariants | `pytest tests/unit -q` |
| [`integration/`](integration/test_studio_pipeline.py) | the Python voice/audio/mix pipeline and loud voice-failure contract | `python tests/integration/test_studio_pipeline.py` |
| [`regression/`](regression/run_all_tests.js) | the Node canvas renderer, action coverage, builds, hairstyles and geometry checks | `node tests/regression/run_all_tests.js` |
| [`production/`](production/) | docs paths, workflow YAML, environment readiness, project hygiene, asset/audio/render contracts | `pytest tests/production -q` |
| [`fixtures/`](fixtures/) | static inputs for those contract tests | used by the suites above |

Do not put a generated render, WAV, PNG, cache or log in `tests/`; use
[`runtime/`](../runtime/README.md). A test may create its own `tmp_path` fixture.
The historical root-level test entry points were moved into `integration/` and
`regression/` on 2026-11-09; use the paths above.
