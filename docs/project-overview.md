---
updated: "2026-07-27T03:07:00Z"
---
# Project Overview

Volt is an experimental programming-language research project for AI coding models and autonomous software-engineering agents.

## Vision

Make agent-produced software easier to generate correctly, evolve safely, repair efficiently, and audit. The primary maintenance objective is:

> AI agents should safely understand, modify, and extend existing Volt codebases with fewer unintended changes, incomplete repository-wide edits, and repair steps.

The guiding principle is: **every requested change has an explicit machine-readable impact surface, and unrelated behavior remains unchanged.**

Greenfield generation is necessary but insufficient. A useful agent-focused language must also make small changes stay small, expose every required propagation site, and preserve behavior outside the request.

Volt remains a research instrument. Promotion toward a production language depends on controlled evidence that its constraints and tooling improve outcomes enough to justify their costs.

## Product Thesis

Volt tests whether explicit static obligations, canonical syntax, narrow modules, structured diagnostics, and future repository-aware impact analysis improve:

1. first-pass correctness and bounded repair; and
2. safe evolution of existing repositories.

The working principle is **semantic compression**: maximize how much programmer intent valid source communicates while minimizing ambiguity and plausible incorrect interpretations. It is an explanatory vector, not an authoritative composite score.

## Current Stage

- GitHub [Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) contains four full, distinct promotion briefs and remains the canonical shaping source.
- [Issue #2](https://github.com/JimmyMcBride/volt/issues/2) and Issues [#3](https://github.com/JimmyMcBride/volt/issues/3)–[#6](https://github.com/JimmyMcBride/volt/issues/6) are reconciled under [Milestone #1](https://github.com/JimmyMcBride/volt/milestone/1) with the approved dependency graph.
- Issue #3 contains the owner-approved protocol v1.1, including safe repository evolution as a primary outcome and the six-comparison multiplicity, power, support, and falsification rules.
- The protocol retains twelve existing-repository tasks: three each for state extension, invariant change, effect addition, and cross-module contract change.
- Deterministic research-layer metrics and fixtures cover propagation completeness, preservation, semantic blast radius, impact prediction, stale contracts, unrequested behavior changes, repair locality, and descriptive reviewability.
- No controlled Volt study has run. Both Volt-specific hypotheses remain unvalidated.
- No compiler exists. Program-graph impact analysis, repository diagnostics, and semantic diff remain proposed directions blocked on separately approved GitHub specs.
- Brain owns concise durable knowledge under `.brain/` and `docs/`; GitHub owns planning through Discussions, Issues, Milestones, and Projects.

## Near-Term Goal

Merge the verified Issue #3 implementation, then review Issue #4 as the next canonical spec. Language-kernel implementation remains blocked until Issue #4 receives its own explicit approval.

## Durable Research Context

- [Volt Research Hypothesis](./research-hypothesis.md)
- [Executable Research Artifacts](../research/README.md)

## Canonical Planning Source

[Volt language thesis and minimum semantic core](https://github.com/JimmyMcBride/volt/discussions/1)
