# Roadmap: volt

Created: 2026-07-26T05:35:48Z

## Overview

Volt starts with product and language discovery, then narrows into one executable vertical slice. Dates and version numbers remain unset until the semantic core is approved.

## Phase 1: Language Thesis

Goal: Define who Volt serves, which agent workflows it improves, and what it will not attempt.

Exit criteria:
- Target workloads and users are explicit.
- Differentiators from existing languages plus agent tooling are testable.
- Security, determinism, and human-governance principles are bounded.
- Major non-goals are recorded.

## Phase 2: Minimum Semantic Core

Goal: Specify the smallest coherent Volt program model.

Exit criteria:
- Syntax and semantics exist for one useful program class.
- Type, effect, error, and capability models are explicit enough to test.
- Structured diagnostics and agent repair loops have observable contracts.
- Examples cover successful execution and important failures.

## Phase 3: Bootstrap Toolchain

Goal: Execute, inspect, and verify the minimum semantic core.

Exit criteria:
- Parser and interpreter or compiler run representative programs.
- Formatter and structured diagnostics support deterministic agent use.
- Conformance tests trace directly to the approved language spec.
- Implementation architecture is documented.

## Phase 4: Agent Workflow Validation

Goal: Measure whether Volt improves agent programming outcomes.

Exit criteria:
- Repeatable tasks compare Volt against suitable baselines.
- Metrics cover correctness, repair iterations, auditability, and cost.
- Results determine whether to expand, revise, or narrow the language.

## Ordering Notes

- Language thesis precedes implementation architecture.
- Semantics precede syntax polish.
- A vertical slice precedes ecosystem or package-manager work.
- Evaluation design begins with semantics, not after implementation.

## Parking Lot

- Package ecosystem and registry.
- Native-code or bytecode optimization.
- IDE ecosystem beyond minimum language-server needs.
- Self-hosting.
- Multi-agent concurrency primitives.
