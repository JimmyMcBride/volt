---
updated: "2026-07-26T05:39:44Z"
---
Volt has no implementation architecture yet. Language semantics must be shaped before selecting a compiler or interpreter architecture.

## Current Boundaries

- `.brain/`: project memory and agent context.
- `.plan/`: brainstorms, specs, roadmap, and planning metadata.
- `docs/`: durable project and architecture documentation.
- `AGENTS.md`: agent entry contract.

## Architecture Guardrails

- Do not infer an implementation language, VM, bytecode, runtime, or package model from the empty repo.
- Keep semantic requirements separate from bootstrap technology choices.
- Promote architecture only after an approved spec or explicit project decision.
