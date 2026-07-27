---
updated: "2026-07-27T17:39:10Z"
---
# Project Overview

Volt is an experimental programming-language research project for AI coding models and autonomous software-engineering agents.

## Vision

Make agent-produced software easier to generate correctly, evolve safely, repair efficiently, and audit. The primary maintenance objective is:

> AI agents should safely understand, modify, and extend existing Volt codebases with fewer unintended changes, incomplete repository-wide edits, and repair steps.

The guiding principle is: **every requested change has an explicit machine-readable impact surface, and unrelated behavior remains unchanged.**

Volt remains a research instrument. Promotion toward a production language depends on controlled evidence that its constraints and tooling improve outcomes enough to justify their costs.

## Product Thesis

Volt tests whether explicit static obligations, canonical syntax, narrow modules, structured diagnostics, and repository-aware impact analysis improve first-pass correctness, bounded repair, and safe evolution of existing repositories.

The working principle is **semantic compression**: maximize how much programmer intent valid source communicates while minimizing ambiguity and plausible incorrect interpretations. It is an explanatory vector, not an authoritative composite score.

## Canonical Naming

Volt v0 has one spelling for every source identifier:

- lowerCamelCase for module segments, functions, effect operations, parameters, local bindings, record fields, and imported value names;
- UpperCamelCase for records, algebraic data types, variants, effects, and imported type names; and
- ASCII letters and digits only, with no underscores.

This is an intentional pre-calibration breaking change approved in [Issue #15](https://github.com/JimmyMcBride/volt/issues/15). Keywords, CLI flags, JSON fields, diagnostic codes, research metric/task/condition IDs, and artifact directory names do not change. The alias-permissive experiment varies keyword spellings only and does not permit snake_case identifiers.

## Current Stage

- GitHub [Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) remains the canonical shaping source.
- [Issue #2](https://github.com/JimmyMcBride/volt/issues/2) and Issues [#3](https://github.com/JimmyMcBride/volt/issues/3)–[#6](https://github.com/JimmyMcBride/volt/issues/6), plus the naming amendment [#15](https://github.com/JimmyMcBride/volt/issues/15), are sequenced under [Milestone #1](https://github.com/JimmyMcBride/volt/milestone/1).
- Issues #3–#6 are implemented and merged. Issue #15 is the active pre-calibration migration.
- The reference toolchain provides strict TypeScript implementation, two checker modes, canonical formatting, stable AST/typed IR/program graph, repository-impact facts, DiagnosticV1, deterministic capability adapters, a tree-walking interpreter, a repository manifest, and `check`, `run`, `test`, and `fmt`.
- The offline corpus, hidden-test, treatment-adapter, harness, replay, schema, baseline, authorization, and analysis scope is implemented in `benchmark/`.
- No controlled Volt study has run. Live calibration and confirmatory execution remain separately gated.
- Brain owns concise durable knowledge under `.brain/` and `docs/`; GitHub owns planning through Discussions, Issues, Milestones, and Projects.

## Near-Term Goal

Merge the canonical camelCase migration before freezing calibration inputs. Then separately approve the exact calibration model/authorization manifest; after calibration, separately approve the powered confirmatory run and cost ceiling.

## Durable Research Context

- [Volt Research Hypothesis](./research-hypothesis.md)
- [Executable Research Artifacts](../research/README.md)

## Canonical Planning Source

[Volt language thesis and minimum semantic core](https://github.com/JimmyMcBride/volt/discussions/1)
