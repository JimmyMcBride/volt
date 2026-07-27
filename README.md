# Volt

![Volt banner](docs/assets/volt-banner.png)

Volt is an experimental programming language for code that will be written, reviewed, and maintained by software agents.

Generating a new function is easy compared with changing an existing system safely. A public type changes, then callers, matches, effects, imports, and tests all need to move with it. Most toolchains reveal that work through a trail of failures. Volt is exploring a different model: make the complete impact of a change explicit, stable, and machine-readable.

The goal is simple: small changes should stay small, and incomplete changes should be hard to miss.

## What Volt is trying to become

Volt treats maintenance as a language-design problem.

- Exact effect sets expose external capabilities and transitive obligations in function contracts.
- Exhaustive matching makes new states visible everywhere they need handling.
- Canonical syntax and formatting reduce equivalent ways to express the same program.
- Stable declaration and site identities let tools explain which code is affected and why.
- Versioned diagnostics carry repository impact facts and bounded repair targets, not only error messages.

That gives coding agents a tighter loop: understand the repository, identify the full change surface, make the smallest complete edit, and verify that unrelated behavior stayed untouched.

## The language at a glance

```volt
module jobs

pub type JobState {
  Queued
  Running
  Finished
}

pub effect Clock {
  fn now() -> Int
}

pub fn observedAt(state: JobState) uses {Clock} -> Int {
  match state {
    Queued -> 0
    Running -> Clock.now()
    Finished -> 0
  }
}
```

Adding another `JobState` variant creates an explicit obligation at every exhaustive match. Adding or removing an effect changes the function contract and the callers constrained by it. Volt aims to make those relationships available as compiler facts before an agent starts guessing where to edit.

## What exists today

Volt v0 has an approved semantic kernel and a working reference toolchain:

- handwritten lexer and parser;
- name resolution, type checking, exact-effect checking, and exhaustiveness checking;
- canonical formatter;
- deterministic tree-walking interpreter;
- stable AST, typed IR, program graph, and repository-impact data;
- structured `DiagnosticV1` output in text or NDJSON;
- explicit repository manifests and deterministic capability adapters; and
- `volt check`, `volt run`, `volt test`, and `volt fmt` commands.

The repository also contains the approved offline controlled-study implementation:

- a content-addressed four-module event-registration seed;
- four calibration and twelve private confirmatory maintenance tasks;
- mutation-checked hidden assertions and preregistered impact surfaces;
- four causal Volt treatment adapters and three descriptive language baselines;
- an isolated fake/replay trajectory harness with authorization and spend gates; and
- deterministic power, six-endpoint analysis, and eleven separate operational measurements.

The reference implementation uses Node.js 24 and strict TypeScript 6. It is intentionally small, deterministic, and dependency-light so the research can test Volt's ideas without hiding them behind production-backend complexity.

Volt source has one identifier spelling: lowerCamelCase for modules, functions, effect operations, parameters, local bindings, and record fields; UpperCamelCase for records, algebraic data types, variants, and effects. Underscores are rejected in Volt-authored identifiers. Protocol keys, diagnostic codes, CLI flags, and research artifact IDs retain their existing machine-facing conventions.

## Try the reference toolchain

Requirements:

- Node.js 24 or newer
- npm

Install and verify the repository:

```sh
git clone https://github.com/JimmyMcBride/volt.git
cd volt
npm ci
npm run verify
```

Build the CLI:

```sh
npm run build
```

Run it against a Volt repository with a [versioned repository manifest](toolchain/schema/repository-manifest-v1.schema.json):

```sh
node dist/toolchain/src/cli.js check --project /path/to/project
node dist/toolchain/src/cli.js run --project /path/to/project
node dist/toolchain/src/cli.js test --project /path/to/project
node dist/toolchain/src/cli.js fmt --project /path/to/project --check
```

## Why developers might care

AI coding tools are getting better at producing plausible code. Repository maintenance still exposes their weak spots: forgotten propagation sites, stale contracts, broad rewrites, and repairs that introduce unrelated changes.

Volt is built around that failure mode. Its research asks whether language constraints and repository-aware compiler facts can improve first-pass correctness and keep repairs bounded. If the hypothesis holds, developers get codebases that are easier for agents to change and easier for humans to audit.

## Research status

Volt is a research prototype, not a production language. The v0 kernel, reference interpreter, and offline benchmark harness exist, but no live calibration or controlled confirmatory study has run. Claims about better agent performance remain hypotheses until separately approved study execution is complete.

Run the network-free, spend-free benchmark validation with:

```sh
npm run check:benchmark
npm run benchmark:offline
```

See the [controlled-study harness](benchmark/README.md) for the corpus, isolation model, analysis, and separate live-execution approval gates.

The repository intentionally has no optimizer, bytecode VM, native backend, package manager, or LSP today. Those choices belong after the current evidence phase.

## License

Volt is available under the [MIT License](LICENSE).

## Follow the work

- [Language thesis and minimum semantic core](https://github.com/JimmyMcBride/volt/discussions/1)
- [Volt v0 milestone](https://github.com/JimmyMcBride/volt/milestone/1)
- [Benchmark corpus and controlled agent study](https://github.com/JimmyMcBride/volt/issues/6)
- [Self-hosted compiler readiness scorecard](https://github.com/JimmyMcBride/volt/discussions/10)
- [Project overview](docs/project-overview.md)
- [Project architecture](docs/project-architecture.md)
- [Research hypothesis](docs/research-hypothesis.md)

Volt is being built in public with one standard for progress: make the claims executable, then let the evidence decide.
