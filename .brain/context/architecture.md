---
updated: "2026-07-26T05:51:12Z"
---
Volt has no implementation architecture yet. Language semantics must be shaped before selecting a compiler or interpreter architecture.

## Current Boundaries

- `.brain/`: durable project memory and agent context.
- `.plan/`: Plan backend configuration, GitHub metadata mirror, and compatibility pointers only.
- `docs/`: durable project knowledge that is not planning state.
- `AGENTS.md`: agent entry contract.
- GitHub Discussions: canonical discovery and shaping.
- GitHub Issues: canonical specs and execution readiness.
- GitHub Milestones/Projects: canonical initiative and delivery sequencing.

## Architecture Guardrails

- Do not infer an implementation language, VM, bytecode, runtime, or package model from the empty repo.
- Keep semantic requirements separate from bootstrap technology choices.
- Promote architecture only after a GitHub-owned spec is approved.
