---
updated: "2026-07-26T07:53:08Z"
---
# Project Architecture

Volt has no compiler implementation architecture yet. Architecture choices remain downstream of the research protocol, language kernel, and separately approved GitHub specs.

## Current Repository Boundaries

- `.brain/`: concise project memory and status pointers.
- `.plan/`: GitHub backend configuration and local metadata mirror; not canonical planning content.
- `docs/`: durable knowledge and architecture context, not specification ownership.
- `research/`: executable protocol, schemas, evidence traceability, metrics, and deterministic fixtures.
- `AGENTS.md`: agent entry contract.

The current branch implements research-layer calculations only. It does not contain a lexer, parser, resolver, type checker, effect checker, exhaustiveness checker, interpreter, DiagnosticV1 implementation, or semantic-diff engine.

## External Planning Boundaries

- GitHub Discussion #1 owns shaping.
- GitHub Issues own specifications and execution readiness.
- GitHub Milestones and Projects own sequencing.
- Existing Issues #4–#6 remain unapproved until the owner explicitly approves their updated specs.

## Proposed Downstream Compiler Direction

Subject to separate approval, the future pipeline remains:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

To support safe repository evolution, the resolved and typed program should expose a deterministic program graph.

Proposed node coverage:

- definitions and references;
- imports and module boundaries;
- callers and callees;
- public types and contracts;
- ADT variants and match sites;
- declared effects and operations; and
- related tests.

Proposed edges explain why a site is affected: defines, references, imports, calls, constrains, matches, uses-effect, and tested-by.

For public type, contract, effect, or module-boundary changes, impact analysis should return stable affected-symbol identifiers, missing propagation sites, and dependency reasons. Stable ordering and complete node/edge coverage are requirements, not implementation choices.

## Repository Diagnostics Direction

DiagnosticV1 remains the proposed versioned public envelope. Repository-aware additions should remain backward-compatible and machine-readable, including affected declarations, missing propagation, dependency reasons, and a bounded repair surface. Repair actions remain declarative and are never automatically applied.

## Semantic Diff Direction

A future semantic diff may report public-contract, effect-set, ADT-variant, match-coverage, and unexpected behavior-surface changes. It must distinguish facts from heuristics and must not collapse dimensions into an authoritative score.

This is a deferred direction. The current branch records research schemas and metric fixtures only.

## Guardrails

- Do not claim compiler behavior that has not been implemented and tested.
- Do not expand the v0 language feature set to implement impact analysis.
- Keep semantic requirements separate from implementation architecture.
- Prefer deterministic stable identifiers and ordering.
- Require approved GitHub specs before compiler, repository-diagnostic, or semantic-diff implementation.
