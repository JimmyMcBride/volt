---
updated: "2026-07-26T07:23:39Z"
---
Volt has no approved compiler or language-runtime architecture yet. The evidence-informed candidate is recorded in [GitHub Discussion #1](https://github.com/JimmyMcBride/volt/discussions/1) and remains blocked on separately approved GitHub Issue specs.

## Current Boundaries

- `.brain/`: durable project memory and agent context.
- `.plan/`: Plan backend configuration, GitHub metadata mirror, and compatibility pointers only.
- `docs/`: durable project knowledge that is not planning state.
- `research/`: executable deliverables for the approved research protocol in GitHub Issue #3.
- `AGENTS.md`: agent entry contract.
- GitHub Discussions: canonical discovery and shaping.
- GitHub Issues: canonical specs and execution readiness.
- GitHub Milestones/Projects: canonical initiative and delivery sequencing.

## Research Protocol Tooling

- `package.json` declares Node.js 24 and dependency-free ES modules for protocol validation, semantic-compression metrics, and thesis decision rules.
- JSON Schema contracts cover the approved protocol, frozen run manifests, trajectory results, and complete analysis reports.
- `research/test/` contains deterministic fixtures for every metric and decision path.
- Issue #6 owns corpus construction, harnesses, model pinning, raw results, and study execution; it must consume these contracts without changing scientific decision rules.

## Candidate Reference Toolchain

- Node.js 24 LTS with strict TypeScript 6.x.
- Handwritten lexer and recursive-descent/Pratt parser.
- Resolution, type, effect, and exhaustiveness passes followed by a deterministic tree-walking interpreter.
- This remains a promotion input, not authorization to implement the compiler.

## Architecture Guardrails

- Keep research-protocol tooling separate from the unapproved compiler architecture.
- Keep semantic requirements separate from bootstrap technology choices.
- Do not expand into production backends, package infrastructure, IDE integration, or automatic repair before evidence and approved specs justify them.
- Promote and approve architecture through the GitHub-owned spec workflow before implementation.
