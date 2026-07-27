---
updated: "2026-07-27T04:04:52Z"
---
Volt now has an approved, executable language-kernel contract. It still has no compiler or runtime implementation. Issue #4 owns the canonical v0 grammar, static semantics, exact effects, exhaustive matching, public-change obligations, formatter contract, and conformance inputs. Issue #5 owns the future compiler, interpreter, DiagnosticV1, program graph, and executable conformance behavior.

## Current Boundaries

- `.brain/`: concise durable project context.
- `.plan/`: Plan backend configuration and GitHub metadata pointers only.
- `docs/`: durable knowledge, not canonical specifications.
- `research/`: approved protocol v1.1, evidence, schemas, metrics, and fixtures.
- `language/`: machine-readable Issue #4 kernel contract and future compiler conformance inputs.
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
- Issue #6 owns task construction, hidden tests, harnesses, run manifests, raw results, and execution after approval.

## Downstream Compiler Boundary

Subject to Issue #5 approval, the future pipeline remains:

`SourceFile → tokens → AST → resolved program → typed/effect-checked program → interpreter`

The resolved/typed program graph should cover definitions, references, imports, callers, public contracts, ADT variants, matches, effects, operations, and related tests. DiagnosticV1 should remain versioned and backward-compatible while carrying stable repository-impact facts and declarative repair surfaces. Semantic diff remains a future direction.

## Guardrails

- Do not claim parser, formatter, resolver, checker, interpreter, or impact behavior before Issue #5 implements and tests it.
- Do not expand the approved v0 feature set without reopening Issue #4.
- Keep research tooling separate from compiler architecture.
- Keep the twelve-case coverage map separate from the Issue #6 benchmark corpus.
- Require approved GitHub specs before compiler, repository-diagnostic, semantic-diff, or study work.
