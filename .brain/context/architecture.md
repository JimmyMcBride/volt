---
updated: "2026-07-27T05:45:59Z"
---
Volt has an approved language-kernel contract and an implemented Issue #5 reference toolchain. Issue #4 owns the canonical v0 grammar and semantics. `toolchain/` owns the strict TypeScript lexer-through-interpreter pipeline, two checker modes, versioned AST/IR/graph/diagnostic contracts, repository impact facts, deterministic capabilities, manifest loading, formatter, and CLI.

## Current Boundaries

- `.brain/`: concise durable project context.
- `.plan/`: Plan backend configuration and GitHub metadata pointers only.
- `docs/`: durable knowledge, not canonical specifications.
- `research/`: approved protocol v1.1, evidence, schemas, metrics, and fixtures.
- `language/`: machine-readable Issue #4 kernel contract and future compiler conformance inputs.
- `toolchain/`: executable Issue #5 reference frontend, interpreter, schemas, and conformance tests.
- GitHub Discussion #1: canonical shaping.
- GitHub Issues: canonical specs and execution readiness.
- GitHub Milestones/Projects: sequencing.

## Language Kernel Artifacts

- `language/grammar/volt-v0.ebnf` freezes the single canonical grammar.
- `language/kernel/kernel-v0.json` records lexical, resolution, type, operator, effect, matching, stable-identity, public-change, formatter, feature-boundary, and protocol-compatibility rules.
- `language/schema/kernel.schema.json` fixes the public kernel envelope.
- `language/fixtures/` contains content-addressed accepted and representative rejected Volt sources.
- The accepted module fixtures demonstrate sorted multi-name imports: `import modules.domain.{Person, Role}`. Importing an ADT also imports its constructors, so `Admin` is available without `Role.Admin`.
- Canonical identifier ordering uses locale-independent lexicographic code-unit comparison; formatter goldens include mixed upper/lower import names to prevent environment drift.
- `language/conformance/` maps every grammar production and static-rule category, records all required rejection categories, and provides one case for every deferred and excluded feature.
- `language/formatter/golden.json` freezes canonical formatting inputs, outputs, and assertions for Issue #5.
- `language/public-change/fixtures.json` fixes five deterministic stable-identity obligation sets.
- `language/benchmark/coverage.json` proves the twelve protocol workload slots require only approved v0 features; it is not the benchmark corpus.
- `language/lib/kernel-validation.mjs` validates these contracts without claiming parser or compiler behavior.

## Research Tooling

- Node.js 24 dependency-free ES modules implement protocol and kernel validation, metrics, and decision rules.
- Approved protocol v1.1 adds deterministic research-layer safe-evolution measures; both Volt hypotheses remain unvalidated pending confirmatory results.
- Issue #6 owns offline task construction, hidden tests, treatment adapters, harnesses, run manifests, replay fixtures, raw-result schemas, and analysis tooling.
- Live calibration and confirmatory execution sit behind separate owner-approved frozen manifests and spend ceilings.

## Reference Toolchain Boundary

The implemented pipeline is:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

Full and erased checker modes share syntax, resolution, runtime, AST/IR, graph facts, identities, formatting, and rendering. The erased mode is controlled by the content-hashed profile in `toolchain/profile/`. The manifest contract at `toolchain/schema/repository-manifest-v1.schema.json` explicitly names the source root, run entrypoint, tests, checker mode, and deterministic capability adapters. Semantic diff remains deferred.

## Guardrails

- Do not claim behavior outside the executable Issue #5 conformance surface.
- Do not expand the approved v0 feature set without reopening Issue #4.
- Keep research tooling separate from compiler architecture.
- Keep the twelve-case coverage map separate from the Issue #6 benchmark corpus.
- Require approved GitHub specs before compiler, repository-diagnostic, semantic-diff, or study work.
- Normal verification and offline harness replay must make no live provider calls or incur model spend.
