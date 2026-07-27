---
updated: "2026-07-27T03:07:00Z"
---
Volt is an experimental programming-language research project for AI coding models and autonomous software-engineering agents.

## Primary Objective

AI agents should safely understand, modify, and extend existing Volt codebases with fewer unintended changes, incomplete repository-wide edits, and repair steps.

Guiding principle: every requested change has an explicit machine-readable impact surface, and unrelated behavior remains unchanged. Greenfield correctness remains important but is insufficient by itself.

## Stage

- [GitHub Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) is the canonical shaping source and contains four full, distinct promotion briefs.
- [Issue #2](https://github.com/JimmyMcBride/volt/issues/2) is the reconciled research initiative under the [Volt v0 milestone](https://github.com/JimmyMcBride/volt/milestone/1).
- [Issue #3](https://github.com/JimmyMcBride/volt/issues/3) contains the owner-approved v1.1 safe-evolution research protocol; its implementation is verified in PR #7 pending merge.
- Issues [#4](https://github.com/JimmyMcBride/volt/issues/4), [#5](https://github.com/JimmyMcBride/volt/issues/5), and [#6](https://github.com/JimmyMcBride/volt/issues/6) are reconciled, materially distinct, and blocked by the approved dependency graph.
- Repeated Plan promotion preview is idempotent: Issues #2–#6 are unchanged, Milestone #1 and all ten relationships are reused, and no GitHub Project was created.
- No compiler or controlled Volt study exists. Both Volt hypotheses remain unvalidated.
- GitHub owns planning; Brain retains concise status, mission, risks, and links.

## Product Priorities

- Safe repository evolution with explicit impact surfaces.
- Deterministic, explicit behavior and stable ordering.
- Machine-checkable contracts, effects, matches, and failures.
- Preservation of behavior outside the requested change.
- Structured diagnostics that support bounded agent repair.
- Experimental evidence before broad compiler investment.
