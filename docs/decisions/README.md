# Architecture decision records

| ADR | Title | Decision |
|---|---|---|
| [ADR-0001](ADR-0001-remotion-evaluation.md) | Remotion skill evaluation | Integrate framework-independent knowledge into the local animation skill; **do not adopt Remotion/React/Three.js/Lottie/Tailwind** |
| [ADR-0002](ADR-0002-engine-layout.md) | Keep the flat engine layout | Document conceptual engine layers instead of a risky physical module rewrite |
| [ADR-0003](ADR-0003-repository-layout.md) | Repository reorganization | One authoritative location per responsibility; self-contained kit; skills, docs, projects, tests, deliverables and runtime separated |

Format: context → evidence → decision → consequences → verification. New ADRs are numbered
sequentially, linked from [`../architecture/DECISIONS.md`](../architecture/DECISIONS.md) and
recorded in [`CHANGELOG.md`](../../CHANGELOG.md).
