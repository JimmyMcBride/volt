---
updated: "2026-07-27T03:18:37Z"
---
Volt has no approved compiler or runtime architecture. Issue #4 now locks the Volt v0 language kernel, canonical grammar, static semantics, exact effects, exhaustive matching, public-change obligations, and formatter contract. Issue #5 still owns and blocks compiler/interpreter architecture.

## Current Boundaries

- `.brain/`: concise durable project context.
- `.plan/`: Plan backend configuration and GitHub metadata pointers only.
- `docs/`: durable knowledge, not canonical specifications.
- `research/`: executable protocol, evidence, schemas, metrics, and fixtures.
- GitHub Discussion #1: canonical shaping.
- GitHub Issues: canonical specs and execution readiness.
- GitHub Milestones/Projects: sequencing.

## Research Tooling

- Node.js 24 dependency-free ES modules implement protocol validation, metrics, and decision rules.
- Approved protocol v1.1 adds deterministic research-layer safe-evolution measures; both Volt hypotheses remain unvalidated pending confirmatory results.
- Issue #6 will own task construction, hidden tests, harnesses, run manifests, raw results, and execution after approval.

## Proposed Compiler Direction

Subject to Issue #5 approval, a future resolved/typed program graph should cover definitions, references, imports, callers, public contracts, ADT variants, matches, effects, operations, and related tests. Public type, contract, effect, or module-boundary changes should yield deterministic affected-symbol lists, missing propagation sites, and dependency reasons.

DiagnosticV1 should remain versioned and backward-compatible while carrying stable repository-impact facts and declarative repair surfaces. Semantic diff is a future direction only.

## Guardrails

- Do not claim or test compiler impact behavior before a compiler exists.
- Do not expand the v0 feature set for impact analysis.
- Keep research tooling separate from unapproved compiler architecture.
- Require approved GitHub specs before compiler, repository-diagnostic, or semantic-diff work.
