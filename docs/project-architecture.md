---
updated: "2026-07-27T17:39:10Z"
---
# Project Architecture

Volt has an approved language-kernel contract, a deterministic Node.js 24 / strict TypeScript 6 reference toolchain, and an offline controlled-study harness. The implementation is a research frontend and tree-walking interpreter, not a production backend.

## Current Repository Boundaries

- `.brain/`: concise project memory and status pointers.
- `.plan/`: GitHub backend configuration and local metadata mirror; not canonical planning content.
- `docs/`: durable knowledge and architecture context, not specification ownership.
- `research/`: approved protocol, schemas, evidence traceability, metrics, and deterministic fixtures.
- `language/`: kernel contract, canonical grammar and naming, conformance inputs, formatter goldens, public-change fixtures, and protocol feature coverage.
- `toolchain/`: lexer, parser, resolver, checker modes, formatter, typed IR, program graph, impact facts, DiagnosticV1, repository loader, capability adapters, interpreter, CLI, schemas, and executable conformance tests.
- `benchmark/`: corpus generation, content-addressed tasks, hidden and mutation checks, treatment/baseline adapters, isolated fake/replay trajectories, artifact storage, authorization gates, statistical analysis, schemas, and offline tests.
- `AGENTS.md`: agent entry contract.

The repository intentionally contains no semantic-diff engine, optimizer, transpiler, VM, native backend, package manager, LSP, live model-provider adapter, calibration results, or confirmatory results.

## Kernel Contract Surface

`language/kernel/kernel-v0.json` is the machine-readable semantic contract. Version 0.2.0 records the Issue #15 naming amendment: lowerCamelCase value/module names, UpperCamelCase type/effect/variant names, and no underscores in Volt-authored identifiers. `language/grammar/volt-v0.ebnf` is the exact grammar.

The lexer deliberately recognizes a broader ASCII identifier token so invalid underscores receive an exact source-located `K_NAME_UNDERSCORE` diagnostic. The parser enforces case by identifier role. The formatter only accepts valid programs and never silently guesses a rename, avoiding collisions. The resolver, stable identities, IR, graph, interpreter, repository manifests, and public-change facts consume the canonical spelling unchanged.

Supporting manifests freeze accepted/rejected examples, every grammar and static-rule category, all deferred/excluded boundaries, formatter pairs, stable public-change ordering, and compatibility with the twelve approved protocol workload slots. The language validator protects those contracts from drift.

## Reference Toolchain

The pipeline is:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

`AstV1`, `NormalizedAstV1`, `TypedIrV1`, `ProgramGraphV1`, `DiagnosticV1`, repository manifests, run manifests, checker profiles, and runtime capability interfaces have versioned schemas. Stable graph edges explain impact through defines, references, imports, calls, constrains, matches, uses-effect, and tested-by reasons.

Full and `static_obligations_erased` modes share parsing, canonical naming, resolution, AST/IR, graph facts, formatting, interpretation, and diagnostic rendering. Naming diagnostics remain retained in the erased condition. The `alias_permissive` condition permits only its frozen keyword aliases and continues to reject snake_case identifiers.

The `volt check`, `run`, `test`, and `fmt` commands load `toolchain/schema/repository-manifest-v1.schema.json`. Runtime capability registries are exact, synchronous, deterministic, and network-free. Exit codes distinguish success (`0`), program/test diagnostics (`1`), and CLI/internal failures (`2`).

## Controlled-Study Harness

`benchmark/corpus/` freezes one deterministic four-module event-registration seed, four non-scored calibration tasks, twelve private confirmatory tasks, finite treatment aliases, descriptive baseline parity, model templates, and fail-closed authorization templates. All Volt conditions use canonical camelCase. Research IDs and the idiomatic strict TypeScript, Rust, and Gleam baselines retain their own conventions.

Each task contains requested behavior, non-goals, expected impact sites, preservation assertions, static/runtime invariants, hidden checks, retained mutants, expected solutions, and content hashes. `benchmark/lib/` implements four causal Volt conditions, three descriptive baselines, private hidden-test execution, deterministic fake/replay models, fresh trajectory state, first-submission tool restrictions, three-turn repair limits, randomization, failure retention, artifact indexing, authorization/spend enforcement, six estimands, approved inference procedures, power bounds, and eleven separate measurements.

Calibration and confirmatory commands remain inactive beyond validation of an exact owner-approved manifest. Normal verification performs no provider calls, network access, or spend.

## Guardrails

- Do not claim behavior outside the executable conformance suite.
- Do not expand the approved v0 language feature set without a GitHub-approved amendment.
- Do not permit snake_case through the alias-permissive condition.
- Keep protocol and research IDs stable; change only Volt-authored identifiers and identities derived from them.
- Keep language contracts separate from executable compiler architecture.
- Keep calibration, causal Volt, and descriptive baseline artifacts in distinct namespaces.
- Never expose hidden outcomes, credentials, or provider secrets to model-visible context.
- Require separate owner approval before calibration and again before confirmatory execution.
