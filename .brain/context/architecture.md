---
updated: "2026-07-27T17:41:59Z"
---
Volt has an approved language-kernel contract, a strict TypeScript reference toolchain, and an offline controlled-study harness. Issue #15 amends the Issue #4 kernel before calibration: Volt-authored value/module identifiers are lowerCamelCase, type/effect/variant identifiers are UpperCamelCase, and underscores are rejected.

`package.json` defines the Node.js 24 / strict TypeScript build, validation, test, corpus-generation, and gated benchmark entrypoints. Runtime dependencies remain zero; `package-lock.json` and `tsconfig.json` freeze reproducible installation and compilation.

## Current Boundaries

- `.brain/`: concise durable project context.
- `.plan/`: Plan backend configuration and GitHub metadata pointers only.
- `docs/`: durable knowledge, not canonical specifications.
- `research/`: approved protocol v1.1, evidence, schemas, metrics, and fixtures.
- `language/`: machine-readable kernel 0.2.0 contract, grammar, canonical naming, and conformance inputs.
- `toolchain/`: executable lexer-through-interpreter pipeline, schemas, and conformance tests.
- `benchmark/`: offline corpus, treatment/baseline adapters, hidden/mutation checks, fake/replay harness, authorization gates, analysis, schemas, and tests.
- GitHub Discussion #1: canonical shaping.
- GitHub Issues: canonical specs and execution readiness.
- GitHub Milestones/Projects: sequencing.

## Language Kernel Artifacts

- `language/grammar/volt-v0.ebnf` freezes the single canonical grammar.
- `language/kernel/kernel-v0.json` version 0.2.0 records Issue #15's naming amendment and the existing lexical, resolution, type, operator, effect, matching, identity, public-change, formatter, feature-boundary, and protocol-compatibility rules.
- The lexer recognizes underscore-bearing ASCII tokens only so the parser can emit precise `K_NAME_UNDERSCORE` diagnostics. Wrong case emits `K_NAME_CONVENTION` based on identifier role.
- The formatter preserves valid spelling and refuses invalid identifiers rather than silently renaming them.
- Accepted module fixtures demonstrate sorted multi-name imports: `import modules.domain.{Person, Role}`. Importing an ADT also imports its constructors, so `Admin` is available without `Role.Admin`.
- `language/conformance/` maps every grammar/static-rule category and includes explicit underscore and wrong-case rejection evidence.
- `language/public-change/fixtures.json` fixes deterministic stable identities using canonical Volt names.

## Reference Toolchain Boundary

The pipeline is:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

Full and erased checker modes share canonical naming, resolution, runtime, AST/IR, graph facts, identities, formatting, and rendering. Naming diagnostics are retained in the erased profile. The alias-permissive condition permits only frozen keyword aliases and cannot enable snake_case. Semantic diff remains deferred.

## Benchmark Boundary

`benchmark/corpus/` contains one content-addressed four-module seed, four calibration tasks, twelve private confirmatory tasks, complete expected impact/preservation manifests, 128 retained mutants, finite treatment aliases, three descriptive baselines, and unapproved authorization/model templates. Volt seed, task solutions, filenames derived from modules, entrypoints, and stable symbol identities use camelCase. Protocol/research IDs and external-baseline conventions remain unchanged.

Normal verification contains no provider boundary or network import. Live calibration and confirmatory execution remain behind separate owner-approved frozen manifests and spend ceilings.

## Guardrails

- Do not claim behavior outside executable conformance.
- Do not expand the approved v0 feature set without a GitHub-approved amendment.
- Do not permit snake_case through any Volt treatment condition.
- Do not rename protocol, research, diagnostic, CLI, JSON, artifact, Rust, or Gleam identities merely to resemble Volt source.
- Require approved GitHub specs before new compiler, semantic-diff, or study work.
- Normal verification and offline replay must make no live provider calls or incur model spend.
