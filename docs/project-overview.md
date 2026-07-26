---
updated: "2026-07-26T05:37:21Z"
---
Volt is a brand-new programming language designed for AI agents that create, inspect, transform, and verify software, while keeping programs understandable and governable by humans.

## Product Thesis

Existing languages optimize primarily for human authors and retrofit agent workflows through prompts, linters, and external tools. Volt will explore whether language semantics, syntax, contracts, diagnostics, and tooling can make agent-written software safer, more deterministic, and easier to review.

## Current Stage

- Inception and language discovery.
- No implementation language, runtime, execution model, syntax, or package model selected.
- No source code, tests, build system, CI, or deployment surface exists yet.
- Brain owns durable project memory under `.brain/` and `docs/`.
- Plan owns product shaping and execution contracts under `.plan/`.

## Near-Term Goal

Define a bounded language thesis and minimum viable semantic core before choosing implementation architecture.

## Open Design Questions

- What programs should Volt make unusually easy or safe for agents to produce?
- Is Volt general-purpose, orchestration-focused, or intentionally narrower?
- Which semantics must be deterministic, inspectable, and capability-controlled?
- What is the smallest useful compiler/interpreter and toolchain?
- How should agents receive structured diagnostics and machine-checkable repair guidance?
