---
updated: "2026-07-27T03:47:53Z"
---
# Project Architecture

Volt has an approved language-kernel contract but no compiler or runtime implementation. Architecture choices for the executable frontend, DiagnosticV1, interpreter, and program graph remain downstream of separately approved GitHub Issue #5.

## Current Repository Boundaries

- `.brain/`: concise project memory and status pointers.
- `.plan/`: GitHub backend configuration and local metadata mirror; not canonical planning content.
- `docs/`: durable knowledge and architecture context, not specification ownership.
- `research/`: approved protocol, schemas, evidence traceability, metrics, and deterministic fixtures.
- `language/`: Issue #4 kernel contract, canonical grammar, conformance inputs, formatter goldens, public-change fixtures, and protocol feature coverage.
- `AGENTS.md`: agent entry contract.

The current branch intentionally contains no lexer, parser, resolver, type checker, effect checker, exhaustiveness checker, executable formatter, interpreter, DiagnosticV1 implementation, semantic-diff engine, or benchmark corpus.

## Kernel Contract Surface

`language/kernel/kernel-v0.json` is the machine-readable semantic contract. `language/grammar/volt-v0.ebnf` is the exact grammar. Supporting manifests freeze accepted/rejected examples, every grammar and static-rule category, all deferred and excluded boundaries, formatter input/output pairs, stable public-change obligation ordering, and compatibility with the twelve approved protocol workload slots.

The dependency-free validator protects those contracts from drift. It does not parse Volt source. Executable conformance remains an Issue #5 acceptance requirement.

## Downstream Compiler Direction

Subject to Issue #5 approval, the future pipeline remains:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

The resolved and typed program should expose a deterministic program graph covering definitions, references, imports, callers, public contracts, ADT variants, matches, effects, operations, and related tests. Edges should explain why a site is affected: defines, references, imports, calls, constrains, matches, uses-effect, and tested-by.

For public type, contract, effect, or module-boundary changes, impact analysis should return stable affected-symbol identifiers, missing propagation sites, and dependency reasons. DiagnosticV1 remains the proposed versioned public envelope. Repair actions remain declarative and are never automatically applied.

## Semantic Diff Direction

A future semantic diff may report public-contract, effect-set, ADT-variant, match-coverage, and unexpected behavior-surface changes. It must distinguish facts from heuristics and must not collapse dimensions into an authoritative score. This remains deferred.

## Guardrails

- Do not claim compiler behavior that has not been implemented and tested.
- Do not expand the approved v0 language feature set without reopening Issue #4.
- Keep language contracts separate from executable compiler architecture.
- Keep the protocol coverage map separate from the Issue #6 benchmark corpus.
- Require approved GitHub specs before compiler, repository-diagnostic, semantic-diff, or study implementation.
