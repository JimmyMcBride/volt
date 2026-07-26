---
updated: "2026-07-26T07:22:30Z"
---
# Project Overview

Volt is a greenfield research project for an experimental programming language and toolchain designed around AI coding models and autonomous software-engineering agents.

## Vision

Make agent-produced software easier to generate correctly, repair efficiently, and audit by humans by reducing semantic ambiguity and providing precise machine-readable feedback.

Volt is a research instrument first. Becoming a production language depends on evidence that its constraints and tooling improve agent outcomes enough to justify their costs.

## Product Thesis

Existing languages optimize primarily for human authors and retrofit agent workflows through prompts, linters, and external tools. Volt tests whether language semantics, canonical forms, contracts, diagnostics, and tooling can improve first-pass correctness and repair efficiency under controlled comparison.

The working principle is **semantic compression**: maximize how much programmer intent valid source communicates while minimizing ambiguity and plausible incorrect interpretations.

## Current Stage

- The evidence synthesis and preregistered protocol in [GitHub Issue #3](https://github.com/JimmyMcBride/volt/issues/3) are approved and implemented as executable artifacts under `research/`.
- The evidence matrix distinguishes prior evidence, counterevidence, limitations, and unvalidated Volt hypotheses.
- The protocol defines three causal estimands, four explanatory semantic-compression metrics, exact decision rules, and schemas for later study manifests and results.
- No controlled Volt study has run, so the central hypothesis remains unvalidated.
- Language semantics, compiler architecture, and benchmark execution remain blocked on separately approved GitHub specs.
- Brain owns durable knowledge under `.brain/` and `docs/`; GitHub owns planning through Discussions, Issues, Milestones, and Projects.

## Near-Term Goal

Review the completed Issue #3 artifacts, then shape and explicitly approve the language-kernel spec before any compiler implementation.

## Durable Research Context

- [Volt Research Hypothesis](./research-hypothesis.md)
- [Executable Research Artifacts](../research/README.md)

## Canonical Planning Source

[Volt language thesis and minimum semantic core](https://github.com/JimmyMcBride/volt/discussions/1)
