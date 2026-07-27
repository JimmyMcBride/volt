---
updated: "2026-07-27T05:45:59Z"
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

- GitHub [Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) remains the canonical shaping source.
- [Issue #2](https://github.com/JimmyMcBride/volt/issues/2) and Issues [#3](https://github.com/JimmyMcBride/volt/issues/3)–[#6](https://github.com/JimmyMcBride/volt/issues/6) are reconciled under [Milestone #1](https://github.com/JimmyMcBride/volt/milestone/1).
- Issues #3, #4, and #5 are implemented, merged, and closed.
- Issue #5 provides the strict TypeScript reference frontend, two checker modes, canonical formatter, stable AST/typed IR/program graph, repository-impact facts, DiagnosticV1, deterministic capability adapters, tree-walking interpreter, repository manifest, and `check`, `run`, `test`, and `fmt` CLI.
- Issue #6 is refined and owner-approved for offline corpus, hidden-test, treatment-adapter, harness, replay, schema, and analysis implementation.
- No controlled Volt study has run. Both Volt-specific hypotheses remain unvalidated. Live calibration and confirmatory execution remain separately gated.
- Brain owns concise durable knowledge under `.brain/` and `docs/`; GitHub owns planning through Discussions, Issues, Milestones, and Projects.

## Near-Term Goal

Implement the approved offline Issue #6 corpus and harness without live provider calls or model spend. After offline review, separately approve a frozen calibration manifest; after calibration, separately approve the powered confirmatory run and cost ceiling.

## Durable Research Context

- [Volt Research Hypothesis](./research-hypothesis.md)
- [Executable Research Artifacts](../research/README.md)

## Canonical Planning Source

[Volt language thesis and minimum semantic core](https://github.com/JimmyMcBride/volt/discussions/1)
