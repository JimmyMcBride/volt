---
updated: "2026-07-26T05:51:12Z"
---
Volt has no implementation architecture yet. Architecture choices remain downstream of the language thesis, experimental design, and minimum semantic core.

## Current Repository Boundaries

- `.brain/`: project memory, context, and session policy.
- `.plan/`: GitHub backend configuration and local metadata mirror; not canonical planning content.
- `docs/`: durable knowledge and architecture context.
- `AGENTS.md`: agent entry contract.

## External Planning Boundaries

- GitHub Discussions own brainstorms and shaping.
- GitHub Issues own specifications and execution readiness.
- GitHub Milestones and Projects own sequencing.

## Guardrails

- Do not infer runtime or compiler architecture from the repository.
- Keep language semantics separate from implementation choices.
- Require an approved GitHub spec before architecture or implementation work.
