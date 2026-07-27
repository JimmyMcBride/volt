---
updated: "2026-07-27T05:12:53Z"
---
# Project Architecture

Volt now has an approved language-kernel contract and a reference Node.js 24 / strict TypeScript 6 toolchain implementing GitHub Issue #5. The implementation is deliberately a deterministic research frontend and tree-walking interpreter, not a production backend.

## Current Repository Boundaries

- `.brain/`: concise project memory and status pointers.
- `.plan/`: GitHub backend configuration and local metadata mirror; not canonical planning content.
- `docs/`: durable knowledge and architecture context, not specification ownership.
- `research/`: approved protocol, schemas, evidence traceability, metrics, and deterministic fixtures.
- `language/`: Issue #4 kernel contract, canonical grammar, conformance inputs, formatter goldens, public-change fixtures, and protocol feature coverage.
- `toolchain/`: lexer, parser, resolver, checker modes, formatter, typed IR, program graph, impact facts, DiagnosticV1, repository loader, capability adapters, interpreter, CLI, schemas, and executable conformance tests.
- `AGENTS.md`: agent entry contract.

The repository intentionally contains no semantic-diff engine, optimizer, transpiler, VM, native backend, package manager, LSP, benchmark corpus, or controlled study harness.

## Kernel Contract Surface

`language/kernel/kernel-v0.json` is the machine-readable semantic contract. `language/grammar/volt-v0.ebnf` is the exact grammar. Supporting manifests freeze accepted/rejected examples, every grammar and static-rule category, all deferred and excluded boundaries, formatter input/output pairs, stable public-change obligation ordering, and compatibility with the twelve approved protocol workload slots.

The language validator protects those contracts from drift. The reference toolchain consumes the frozen fixtures in executable lexer-through-interpreter conformance tests.

## Reference Toolchain

The implemented pipeline is:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

`AstV1`, `NormalizedAstV1`, `TypedIrV1`, `ProgramGraphV1`, `DiagnosticV1`, repository manifests, run manifests, checker profiles, and runtime capability interfaces have versioned schemas. Stable graph edges explain impact through defines, references, imports, calls, constrains, matches, uses-effect, and tested-by reasons.

Full and `static_obligations_erased` checker modes share parsing, resolution, AST/IR, graph facts, formatting, interpretation, and diagnostic rendering. The erased mode omits only the approved profile codes and propagates `Unknown` across erased boundaries. Public-change analysis returns stable symbols, declarations, files, sites, missing propagation sites, dependency reasons, and bounded declarative repairs.

The `volt check`, `run`, `test`, and `fmt` commands load the explicit repository manifest defined by `toolchain/schema/repository-manifest-v1.schema.json`. Runtime capability registries are exact, synchronous, deterministic, and network-free. Exit codes distinguish success (`0`), program/test diagnostics (`1`), and CLI/internal failures (`2`).

## Semantic Diff Direction

A future semantic diff may report public-contract, effect-set, ADT-variant, match-coverage, and unexpected behavior-surface changes. It must distinguish facts from heuristics and must not collapse dimensions into an authoritative score. This remains deferred.

## Guardrails

- Do not claim behavior outside the executable conformance suite.
- Do not expand the approved v0 language feature set without reopening Issue #4.
- Keep language contracts separate from executable compiler architecture.
- Keep the protocol coverage map separate from the Issue #6 benchmark corpus.
- Require approved GitHub specs before semantic-diff or study implementation.
