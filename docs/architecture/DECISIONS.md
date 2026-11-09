# Architecture decisions

Decisions are recorded as ADRs in [`../decisions/`](../decisions/README.md):

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](../decisions/ADR-0001-remotion-evaluation.md) | Remotion knowledge integrated; Remotion runtime **not adopted** | Accepted |
| [ADR-0002](../decisions/ADR-0002-engine-layout.md) | Keep the flat `universal_toolbook/engine/` layout; document conceptual layers | Accepted |
| [ADR-0003](../decisions/ADR-0003-repository-layout.md) | One authoritative location per responsibility; self-contained kit; runtime separation | Accepted |

New architecture decisions must be added as a new ADR, linked here, and recorded in
[`CHANGELOG.md`](../../CHANGELOG.md). An ADR that proposes a new runtime dependency must include a
tested technical evaluation, not a preference.
