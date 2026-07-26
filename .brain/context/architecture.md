---
updated: "2026-07-26T06:34:31Z"
---
Volt has no approved implementation architecture yet. The evidence-informed candidate architecture is recorded in [GitHub Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) and must be promoted into, reviewed in, and approved as a GitHub Issue spec before implementation.

## Current Boundaries

- `.brain/`: durable project memory and agent context.
- `.plan/`: Plan backend configuration, GitHub metadata mirror, and compatibility pointers only.
- `docs/`: durable project knowledge that is not planning state.
- `AGENTS.md`: agent entry contract.
- GitHub Discussions: canonical discovery and shaping.
- GitHub Issues: canonical specs and execution readiness.
- GitHub Milestones/Projects: canonical initiative and delivery sequencing.

## Candidate Reference Toolchain

- Node.js 24 LTS with strict TypeScript 6.x.
- Handwritten lexer and recursive-descent/Pratt parser.
- Resolution, type, effect, and exhaustiveness passes followed by a deterministic tree-walking interpreter.
- This is a promotion input, not authorization to implement.

## Architecture Guardrails

- Keep semantic requirements separate from bootstrap technology choices.
- Do not expand into production backends, package infrastructure, IDE integration, or automatic repair before evidence and approved specs justify them.
- Promote and approve architecture through the GitHub-owned spec workflow before implementation.
