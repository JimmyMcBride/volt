---
updated: "2026-07-26T07:53:40Z"
---
Volt is an experimental programming-language research project for AI coding models and autonomous software-engineering agents.

## Primary Objective

AI agents should safely understand, modify, and extend existing Volt codebases with fewer unintended changes, incomplete repository-wide edits, and repair steps.

Guiding principle: every requested change has an explicit machine-readable impact surface, and unrelated behavior remains unchanged. Greenfield correctness remains important but is insufficient by itself.

## Stage

- [GitHub Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) is the canonical shaping source.
- [Issue #2](https://github.com/JimmyMcBride/volt/issues/2) is the research initiative under the [Volt v0 milestone](https://github.com/JimmyMcBride/volt/milestone/1).
- [Issue #3](https://github.com/JimmyMcBride/volt/issues/3) owns the approved v1.0 research protocol. This branch proposes v1.1 safe-evolution endpoints and is `pending_reapproval` because primary outcomes, multiplicity, power, and falsification change.
- Issues [#4](https://github.com/JimmyMcBride/volt/issues/4), [#5](https://github.com/JimmyMcBride/volt/issues/5), and [#6](https://github.com/JimmyMcBride/volt/issues/6) remain unapproved.
- No compiler or controlled Volt study exists. Both Volt hypotheses remain unvalidated.
- GitHub owns planning; Brain retains concise status, mission, risks, and links.

## Product Priorities

- Safe repository evolution with explicit impact surfaces.
- Deterministic, explicit behavior and stable ordering.
- Machine-checkable contracts, effects, matches, and failures.
- Preservation of behavior outside the requested change.
- Structured diagnostics that support bounded agent repair.
- Experimental evidence before broad compiler investment.
