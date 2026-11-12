# Developer entry points

These scripts belong to the development repository, **not** to the copyable runtime kit. The kit
never imports or executes them.

| Script | Purpose | Typical use |
|---|---|---|
| [`new_project.py`](new_project.py) | create a new independent `projects/<slug>/` from the master prompt and project checklist; refuses to overwrite | `python3 scripts/new_project.py video-003-topic --title "..."` |
| [`verify_fresh_checkout.py`](verify_fresh_checkout.py) | clone the current branch, install deps, run every gate, render a silent draft, check the kit standalone | `python3 scripts/verify_fresh_checkout.py` |

Repository maintenance and QA tools live in [`tools/`](../tools/README.md). Agent procedures live
in [`skills/`](../skills/README.md); rules live in [`AGENTS.md`](../AGENTS.md).
