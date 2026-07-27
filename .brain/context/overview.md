---
updated: "2026-07-27T05:45:59Z"
---
Volt is an experimental programming-language research project for AI coding models and autonomous software-engineering agents.

## Primary Objective

AI agents should safely understand, modify, and extend existing Volt codebases with fewer unintended changes, incomplete repository-wide edits, and repair steps.

Guiding principle: every requested change has an explicit machine-readable impact surface, and unrelated behavior remains unchanged. Greenfield correctness remains important but is insufficient by itself.

## Stage

- [GitHub Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) is the canonical shaping source and contains four full, distinct promotion briefs.
- [Issue #2](https://github.com/JimmyMcBride/volt/issues/2) is the reconciled research initiative under the [Volt v0 milestone](https://github.com/JimmyMcBride/volt/milestone/1).
- [Issue #3](https://github.com/JimmyMcBride/volt/issues/3), [Issue #4](https://github.com/JimmyMcBride/volt/issues/4), and [Issue #5](https://github.com/JimmyMcBride/volt/issues/5) are implemented, merged, and closed.
- [Issue #6](https://github.com/JimmyMcBride/volt/issues/6) has an offline corpus, hidden/mutation suite, treatment and baseline adapters, isolated fake/replay harness, schemas, authorization gates, and analysis implementation on its execution branch.
- Live calibration and confirmatory execution remain separately gated by exact frozen manifests and owner-approved spend ceilings.
- No controlled Volt study has run. Both Volt hypotheses remain unvalidated.
- GitHub owns planning; Brain retains concise status, mission, risks, and links.

## Product Priorities

- Safe repository evolution with explicit impact surfaces.
- Deterministic, explicit behavior and stable ordering.
- Machine-checkable contracts, effects, matches, and failures.
- Preservation of behavior outside the requested change.
- Structured diagnostics that support bounded agent repair.
- Experimental evidence before broad compiler investment.
